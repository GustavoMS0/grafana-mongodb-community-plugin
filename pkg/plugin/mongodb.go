package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/pkg/errors"

	mongoOpts "go.mongodb.org/mongo-driver/mongo/options"
)

const (
	defaultSchemaInferenceDepth = 20
	maxSchemaInferenceDepth     = 1000
	defaultQueryTimeout         = 60 * time.Second
	maxDocumentsPerQuery        = 100000
)

// MongoDBDateSpecifierReplacements is a mapping from date specifiers used by
// Golang's time.Parse to those used by MongoDB's $dateFromString stage.
// If the "to" field is nil, then that indicates MongoDB has no equivalent, and
// translating any string containing it should produce an error.
var MongoDBDateSpecifierReplacements = []struct {
	from string
	to   *string
}{
	{"%", str("%%")},
	{"2006", str("%Y")},
	{"06", nil},
	{"January", str("%B")},
	{"Jan", str("%b")},
	{"15", str("%H")},
	{"01", str("%m")},
	{"1", nil},
	{"Monday", nil},
	{"Mon", nil},
	{"__2", str("%j")},
	{"002", str("%j")},
	{"02", str("%d")},
	{"_2", str("%d")},
	{"2", nil},
	{"03", nil},
	{"3", nil},
	{"04", str("%M")},
	{"4", nil},
	{"05", str("%S")},
	{"5", nil},
	{"PM", nil},
	{"-0700", str("%z")},
	{"-07", str("%z")},
}

func str(s string) *string {
	return &s
}

func ConvertGoTimeFormatToMongo(goFormat string) (mongoFormat string, err error) {
	mongoFormatBuilder := strings.Builder{}
	unsupported := make([]string, 0)
	ix := 0
	runes := []rune(goFormat)
	for ix < len(runes) {
		found := false
		for _, repl := range MongoDBDateSpecifierReplacements {
			if len(repl.from) > len(runes[ix:]) || string(runes[ix:ix+len(repl.from)]) != repl.from {
				continue
			}
			found = true
			ix += len(repl.from)
			if repl.to == nil {
				unsupported = append(unsupported, repl.from)
			} else {
				mongoFormatBuilder.WriteString(*repl.to)
			}
			break
		}
		if found {
			continue
		}
		mongoFormatBuilder.WriteRune(runes[ix])
		ix++
	}

	if len(unsupported) != 0 {
		err = fmt.Errorf(
			"MongoDB does not have an equivalent for the following date specifiers: %s",
			strings.Join(unsupported, ", "),
		)
		return "", err
	}
	return mongoFormatBuilder.String(), nil
}

func (d *MongoDBDatasource) query(ctx context.Context, pCtx backend.PluginContext, query backend.DataQuery) backend.DataResponse {
	start := time.Now()
	log.DefaultLogger.Debug("query called", "refId", query.RefID)
	response := backend.DataResponse{}

	var qm QueryModel
	if err := json.Unmarshal(query.JSON, &qm); err != nil {
		response.Error = errors.Wrap(err, "Invalid query JSON")
		return response
	}

	pipeline, err := qm.getPipeline(query.TimeRange.From, query.TimeRange.To)
	if err != nil {
		response.Error = errors.Wrap(err, "Failed to produce final pipeline")
		return response
	}

	mongoClient, cfg, err := d.getClient(ctx, pCtx.DataSourceInstanceSettings)
	if err != nil {
		response.Error = errors.Wrap(err, "Failed to connect to mongo")
		return response
	}

	dbName := strings.TrimSpace(qm.Database)
	if dbName == "" && cfg != nil {
		dbName = strings.TrimSpace(cfg.DefaultDatabase)
	}
	if dbName == "" {
		response.Error = fmt.Errorf("database must be specified in the query or in the datasource defaultDatabase setting")
		return response
	}

	collectionName := strings.TrimSpace(qm.Collection)
	if collectionName == "" {
		response.Error = fmt.Errorf("collection must be specified in the query")
		return response
	}

	queryCtx := ctx
	var cancel context.CancelFunc
	if qm.MaxTimeMS > 0 {
		queryCtx, cancel = context.WithTimeout(ctx, time.Duration(qm.MaxTimeMS)*time.Millisecond)
		defer cancel()
	} else if _, hasDeadline := ctx.Deadline(); !hasDeadline {
		queryCtx, cancel = context.WithTimeout(ctx, defaultQueryTimeout)
		defer cancel()
	}

	aggOpts := mongoOpts.Aggregate()
	if qm.AllowDiskUse {
		aggOpts.SetAllowDiskUse(true)
	}
	if qm.MaxTimeMS > 0 {
		aggOpts.SetMaxTime(time.Duration(qm.MaxTimeMS) * time.Millisecond)
	}

	collection := mongoClient.Database(dbName).Collection(collectionName)

	log.DefaultLogger.Info(
		"Querying MongoDB",
		"refId", query.RefID,
		"database", dbName,
		"collection", collectionName,
	)
	cursor, err := collection.Aggregate(queryCtx, pipeline, aggOpts)
	if err != nil {
		response.Error = errors.Wrap(err, "Failed to send query to mongo")
		return response
	}
	defer func() {
		closeCtx, closeCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer closeCancel()
		_ = cursor.Close(closeCtx)
	}()

	buffered := bufferedCursor{
		Cursor: cursor,
	}

	var fields []field

	if qm.SchemaInference {
		inferenceDepth := qm.SchemaInferenceDepth
		if inferenceDepth <= 0 {
			inferenceDepth = defaultSchemaInferenceDepth
		} else if inferenceDepth > maxSchemaInferenceDepth {
			inferenceDepth = maxSchemaInferenceDepth
		}
		buffering := bufferingCursor{
			Cursor: cursor,
			buffer: make([]timestepDocument, 0, inferenceDepth),
		}

		ignored := make(map[string]struct{}, 1+len(qm.LabelFields))
		if qm.QueryType == queryTypeTimeseries {
			ignored[qm.TimestampField] = struct{}{}
			for _, name := range qm.LabelFields {
				ignored[name] = struct{}{}
			}
		}

		state := NewSchemaInference(ignored)

		doc, more, err := buffering.Next(queryCtx)
		for len(buffering.buffer) < inferenceDepth && more {
			err = state.updateDoc(doc)
			if err != nil {
				break
			}

			doc, more, err = buffering.Next(queryCtx)
		}
		if err != nil {
			response.Error = errors.Wrap(err, "Schema Inference Failed")
			return response
		}
		fields = state.finish()
		log.DefaultLogger.Debug(
			"Inferred schema",
			"refId", query.RefID,
			"requestedDocs", inferenceDepth,
			"bufferedDocs", len(buffering.buffer),
			"fields", fields,
		)
		buffered.buffer = buffering.buffer
	} else {
		fields, err = qm.getFields()
		if err != nil {
			response.Error = err
			return response
		}
	}

	resolvedModel, err := qm.resolve(fields)
	if err != nil {
		response.Error = err
		return response
	}

	parser := resultParser{
		frames: map[string]*data.Frame{},
		model:  resolvedModel,
	}

	docCount := 0
	doc, more, decodeErr, err := buffered.Next(queryCtx)
	for more {
		if docCount >= maxDocumentsPerQuery {
			response.Error = fmt.Errorf("query exceeded maximum safety limit of %d documents; please add a $limit stage or narrow your time range", maxDocumentsPerQuery)
			return response
		}
		err = parser.parseQueryResultDocument(doc)
		if err != nil {
			response.Error = fmt.Errorf("Failed to convert document number %d: %s", docCount, err)
			return response
		}
		doc, more, decodeErr, err = buffered.Next(queryCtx)
		docCount++
	}
	if err != nil {
		if decodeErr {
			response.Error = errors.Wrap(err, fmt.Sprintf("Failed to decode document number %d", docCount))
			return response
		}
		response.Error = errors.Wrap(err, fmt.Sprintf("Failed to fetch result document number %d", docCount+1))
		return response
	}

	frameIDs := make([]string, 0, len(parser.frames))
	for id := range parser.frames {
		frameIDs = append(frameIDs, id)
	}
	sort.Strings(frameIDs)

	response.Frames = make([]*data.Frame, 0, len(frameIDs))
	for _, id := range frameIDs {
		response.Frames = append(response.Frames, parser.frames[id])
	}

	log.DefaultLogger.Info(
		"Query finished",
		"refId", query.RefID,
		"documents", docCount,
		"frames", len(response.Frames),
		"durationMs", time.Since(start).Milliseconds(),
	)
	return response
}

func (d *MongoDBDatasource) ping(ctx context.Context, req *backend.CheckHealthRequest) error {
	var settings *backend.DataSourceInstanceSettings
	if req != nil {
		settings = req.PluginContext.DataSourceInstanceSettings
	}
	mongoClient, cfg, err := d.getClient(ctx, settings)
	if err != nil {
		return err
	}
	timeout := time.Duration(defaultConnectTimeoutSeconds) * time.Second
	if cfg != nil {
		timeout = cfg.connectTimeout()
	}
	pingCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return mongoClient.Ping(pingCtx, nil)
}
