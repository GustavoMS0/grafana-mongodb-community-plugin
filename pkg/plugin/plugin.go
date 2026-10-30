package plugin

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/pkg/errors"
	"go.mongodb.org/mongo-driver/mongo"
)

var (
	_ backend.QueryDataHandler      = (*MongoDBDatasource)(nil)
	_ backend.CheckHealthHandler    = (*MongoDBDatasource)(nil)
	_ instancemgmt.InstanceDisposer = (*MongoDBDatasource)(nil)
)

// NewMongoDBDatasource creates a new datasource instance and pre-parses its settings.
func NewMongoDBDatasource(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
	ds := &MongoDBDatasource{
		settings: &settings,
	}
	if len(settings.JSONData) > 0 || len(settings.DecryptedSecureJSONData) > 0 {
		cfg, err := parseDatasourceConfig(&settings)
		if err != nil {
			return nil, err
		}
		ds.config = &cfg
	}
	return ds, nil
}

// MongoDBDatasource responds to data queries and health checks using a shared MongoDB connection pool.
type MongoDBDatasource struct {
	mu       sync.RWMutex
	settings *backend.DataSourceInstanceSettings
	config   *datasource
	client   *mongo.Client
}

func (d *MongoDBDatasource) getClient(ctx context.Context, fallbackSettings *backend.DataSourceInstanceSettings) (*mongo.Client, *datasource, error) {
	d.mu.RLock()
	if d.client != nil && d.config != nil {
		client := d.client
		cfg := d.config
		d.mu.RUnlock()
		return client, cfg, nil
	}
	d.mu.RUnlock()

	d.mu.Lock()
	defer d.mu.Unlock()

	if d.client != nil && d.config != nil {
		return d.client, d.config, nil
	}

	cfg := d.config
	if cfg == nil {
		activeSettings := d.settings
		if activeSettings == nil || (len(activeSettings.JSONData) == 0 && len(activeSettings.DecryptedSecureJSONData) == 0 && fallbackSettings != nil) {
			activeSettings = fallbackSettings
		}
		parsedCfg, err := parseDatasourceConfig(activeSettings)
		if err != nil {
			return nil, nil, err
		}
		cfg = &parsedCfg
		d.config = cfg
	}

	opts, err := cfg.buildClientOptions()
	if err != nil {
		return nil, cfg, err
	}

	connectCtx, cancel := context.WithTimeout(context.Background(), cfg.connectTimeout())
	defer cancel()

	mongoClient, err := mongo.Connect(connectCtx, opts)
	if err != nil {
		return nil, cfg, errors.Wrap(err, "Error while connecting to MongoDB")
	}

	d.client = mongoClient
	return d.client, d.config, nil
}

// Dispose cleans up the shared MongoDB client connection pool when the datasource instance is disposed.
func (d *MongoDBDatasource) Dispose() {
	d.mu.Lock()
	client := d.client
	d.client = nil
	d.mu.Unlock()

	if client != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := client.Disconnect(ctx); err != nil {
			log.DefaultLogger.Warn("Failed to disconnect MongoDB client during dispose", "error", err)
		}
	}
}

// QueryData handles multiple queries and returns multiple responses.
func (d *MongoDBDatasource) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	numQueries := 0
	if req != nil {
		numQueries = len(req.Queries)
	}
	log.DefaultLogger.Debug("QueryData called", "numQueries", numQueries)

	response := backend.NewQueryDataResponse()
	if req == nil {
		return response, nil
	}

	for _, q := range req.Queries {
		res := d.query(ctx, req.PluginContext, q)
		response.Responses[q.RefID] = res
	}

	return response, nil
}

// CheckHealth handles health checks sent from Grafana to the plugin.
func (d *MongoDBDatasource) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	log.DefaultLogger.Debug("CheckHealth called")

	err := d.ping(ctx, req)
	if err != nil {
		return &backend.CheckHealthResult{
			Status:  backend.HealthStatusError,
			Message: "Ping failed: " + err.Error(),
		}, nil
	}

	return &backend.CheckHealthResult{
		Status:  backend.HealthStatusOk,
		Message: "MongoDB is Responding",
	}, nil
}
