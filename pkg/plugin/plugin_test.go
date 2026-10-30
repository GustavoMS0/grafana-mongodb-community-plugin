package plugin_test

import (
	"context"
	"encoding/json"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"go.mongodb.org/mongo-driver/bson"
	bsonprim "go.mongodb.org/mongo-driver/bson/primitive"

	"github.com/meln5674/grafana-mongodb-community-plugin/pkg/plugin"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var (
	now                = time.Now()
	nowMillis          = now.Truncate(1 * time.Millisecond)
	nowSeconds         = uint32(now.Unix())
	nowFromSeconds     = time.Unix(int64(nowSeconds), 0)
	testDecimal        bsonprim.Decimal128
	testDecimalNaN     bsonprim.Decimal128
	testDecimalInf     bsonprim.Decimal128
	testDecimalAsFloat = float64(12345.6789)
)

func init() {
	var err error
	testDecimalNaN, err = bsonprim.ParseDecimal128("NaN")
	if err != nil {
		panic(err)
	}
	testDecimalInf, err = bsonprim.ParseDecimal128("Infinity")
	if err != nil {
		panic(err)
	}
}

var _ = Describe("QueryData and Datasource Lifecycle", func() {
	It("Should return a response for an uninitialized struct", func() {
		ds := plugin.MongoDBDatasource{}

		resp, err := ds.QueryData(
			context.Background(),
			&backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{RefID: "A"},
				},
			},
		)
		Expect(err).ToNot(HaveOccurred())
		Expect(resp.Responses).To(HaveLen(1), "QueryData must return a response")
	})

	It("Should initialize via NewMongoDBDatasource, handle QueryData, and Dispose cleanly", func() {
		instance, err := plugin.NewMongoDBDatasource(
			context.Background(),
			backend.DataSourceInstanceSettings{
				JSONData: []byte(`{
					"url": "mongodb://127.0.0.1:27017",
					"defaultDatabase": "metrics_db",
					"authMechanism": "SCRAM-SHA-256",
					"authSource": "admin",
					"connectTimeoutSeconds": 1,
					"maxPoolSize": 25,
					"directConnection": true
				}`),
				DecryptedSecureJSONData: map[string]string{
					"username": "testuser",
					"password": "testpassword",
				},
			},
		)
		Expect(err).ToNot(HaveOccurred())
		Expect(instance).ToNot(BeNil())

		ds, ok := instance.(*plugin.MongoDBDatasource)
		Expect(ok).To(BeTrue())
		defer ds.Dispose()

		resp, err := ds.QueryData(
			context.Background(),
			&backend.QueryDataRequest{
				Queries: []backend.DataQuery{
					{
						RefID: "A",
						JSON:  []byte(`{"collection":"cpu","queryType":"Table","valueFields":["host","usage"],"valueFieldTypes":["string","float64"],"aggregation":"[]"}`),
					},
				},
			},
		)
		Expect(err).ToNot(HaveOccurred())
		Expect(resp.Responses).To(HaveKey("A"))
	})

	It("Should fail cleanly when query has mismatched ValueFields and ValueFieldTypes", func() {
		instance, err := plugin.NewMongoDBDatasource(
			context.Background(),
			backend.DataSourceInstanceSettings{
				JSONData: []byte(`{"url": "mongodb://127.0.0.1:27017", "defaultDatabase": "test"}`),
			},
		)
		Expect(err).ToNot(HaveOccurred())
		ds := instance.(*plugin.MongoDBDatasource)
		defer ds.Dispose()

		qm := plugin.QueryModel{
			ValueFields:     []string{"field1", "field2"},
			ValueFieldTypes: []string{"string"},
		}
		_, err = qm.GetFields()
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("Value Fields and Value Field Types must be the same length (2 vs 1)"))
	})
})

var _ = Describe("QueryModel.GetFields", func() {
	It("Should succeed when ValueFields and ValueFieldTypes have matching lengths and valid types", func() {
		qm := plugin.QueryModel{
			ValueFields:     []string{"cpu", "host", "count"},
			ValueFieldTypes: []string{"float64", "string", "int64"},
		}
		fields, err := qm.GetFields()
		Expect(err).ToNot(HaveOccurred())
		Expect(fields).To(Equal([]plugin.Field{
			{Name: "cpu", Type: data.FieldTypeFloat64},
			{Name: "host", Type: data.FieldTypeString},
			{Name: "count", Type: data.FieldTypeInt64},
		}))
	})

	It("Should return an error when ValueFields and ValueFieldTypes have different lengths", func() {
		qm := plugin.QueryModel{
			ValueFields:     []string{"a", "b", "c"},
			ValueFieldTypes: []string{"string"},
		}
		_, err := qm.GetFields()
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(Equal("Value Fields and Value Field Types must be the same length (3 vs 1)"))
	})

	It("Should return an error when a field type is invalid", func() {
		qm := plugin.QueryModel{
			ValueFields:     []string{"a"},
			ValueFieldTypes: []string{"not_a_valid_type"},
		}
		_, err := qm.GetFields()
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("Invalid Type: not_a_valid_type"))
	})
})

var _ = Describe("Deterministic Schema Inference", func() {
	It("Should always return fields sorted alphabetically regardless of map iteration order", func() {
		docs := []map[string]interface{}{
			{
				"zebra":   "stripe",
				"alpha":   int32(10),
				"middle":  float64(3.14),
				"beta":    true,
				"ignored": "skip_me",
			},
			{
				"zebra":  "stripe2",
				"alpha":  int32(20),
				"omega":  int64(99),
				"middle": nil,
				"beta":   false,
			},
		}

		ignored := map[string]struct{}{
			"ignored": {},
		}

		for i := 0; i < 20; i++ {
			state := plugin.NewSchemaInference(ignored)
			for _, doc := range docs {
				Expect(state.UpdateDoc(doc)).To(Succeed())
			}
			fields := state.Finish()
			Expect(fields).To(Equal([]plugin.Field{
				{Name: "alpha", Type: data.FieldTypeInt32},
				{Name: "beta", Type: data.FieldTypeBool},
				{Name: "middle", Type: data.FieldTypeNullableFloat64},
				{Name: "omega", Type: data.FieldTypeNullableInt64},
				{Name: "zebra", Type: data.FieldTypeString},
			}))
		}
	})

	It("Should report type mismatches in deterministic order", func() {
		state := plugin.NewSchemaInference(nil)
		Expect(state.UpdateDoc(map[string]interface{}{
			"z_field": "hello",
			"a_field": int32(1),
		})).To(Succeed())

		err := state.UpdateDoc(map[string]interface{}{
			"z_field": int32(2),
			"a_field": "world",
		})
		Expect(err).To(HaveOccurred())
		Expect(err.Error()).To(ContainSubstring("a_field ([]int32 vs []string), z_field ([]string vs []int32)"))
	})
})

var _ = Describe("ToGrafanaValue", func() {
	DescribeTable("should convert",
		func(inValue interface{}, expectedOutValue interface{}, expectedType data.FieldType, valid bool) {
			actualOutValue, actualType, err := plugin.ToGrafanaValue(inValue)
			if !valid {
				Expect(err).To(HaveOccurred())
				return
			}
			Expect(err).ToNot(HaveOccurred())
			if expectedOutValue == nil {
				Expect(actualOutValue).To(BeNil())
			} else {
				Expect(actualOutValue).To(Equal(expectedOutValue))
			}
			Expect(actualType).To(Equal(expectedType))
		},
		Entry("nil to unknown", nil, nil, data.FieldTypeUnknown, true),
		Entry("Undefined to unknown", bsonprim.Undefined{}, nil, data.FieldTypeUnknown, true),
		Entry("an int32 to an int32", int32(1), int32(1), data.FieldTypeInt32, true),
		Entry("an int64 to an int64", int64(1), int64(1), data.FieldTypeInt64, true),
		Entry("a float64 to a float64", float64(1), float64(1), data.FieldTypeFloat64, true),
		Entry("a string to a string", "Hello, world!", "Hello, world!", data.FieldTypeString, true),
		Entry("a bool to a bool", true, true, data.FieldTypeBool, true),
		Entry("a document to a json.RawMessage",
			bson.D{
				bson.E{Key: "foo", Value: int32(1)},
				bson.E{Key: "bar", Value: float64(2.5)},
				bson.E{Key: "baz", Value: "Hello, world!"},
			},
			json.RawMessage(`{"foo":1,"bar":2.5,"baz":"Hello, world!"}`),
			data.FieldTypeJSON,
			true,
		),
		Entry("a map to a json.RawMessage",
			bson.M{
				"foo": int32(1),
			},
			json.RawMessage(`{"foo":1}`),
			data.FieldTypeJSON,
			true,
		),
		Entry("a native Go map to a json.RawMessage",
			map[string]interface{}{
				"foo": int32(1),
			},
			json.RawMessage(`{"foo":1}`),
			data.FieldTypeJSON,
			true,
		),
		Entry("an array to a json.RawMessage", bson.A{int32(1), float64(2.5), "Hello, world!"}, json.RawMessage(`[1,2.5,"Hello, world!"]`), data.FieldTypeJSON, true),
		Entry("a native slice to a json.RawMessage", []interface{}{int32(1), "two"}, json.RawMessage(`[1,"two"]`), data.FieldTypeJSON, true),
		Entry("an ObjectID to a string", bsonprim.ObjectID([12]byte{0x43, 0x78, 0x42, 0x42, 0x64, 0x4d, 0x53, 0x32, 0x37, 0x4b, 0x57, 0x30}), "43784242644d5332374b5730", data.FieldTypeString, true),
		Entry("a DateTime to a Time",
			bsonprim.NewDateTimeFromTime(now),
			nowMillis,
			data.FieldTypeTime,
			true,
		),
		Entry("a Binary to a hex string",
			bsonprim.Binary{Subtype: 0, Data: []byte{0xde, 0xad, 0xbe, 0xef}},
			"deadbeef",
			data.FieldTypeString,
			true,
		),
		Entry("a Regex to a string",
			bsonprim.Regex{Pattern: ".*"},
			".*",
			data.FieldTypeString,
			true,
		),
		Entry("a JavaScript to a string",
			bsonprim.JavaScript(`console.Log("Hello, world!");`),
			`console.Log("Hello, world!");`,
			data.FieldTypeString,
			true,
		),
		Entry("a CodeWithScope to a string",
			bsonprim.CodeWithScope{Code: `console.Log("Hello, world!");`},
			`console.Log("Hello, world!");`,
			data.FieldTypeString,
			true,
		),
		Entry("a Timestamp to a time",
			bsonprim.Timestamp{T: nowSeconds, I: 0},
			nowFromSeconds,
			data.FieldTypeTime,
			true,
		),
		Entry("a Decimal to a float64",
			testDecimal,
			testDecimalAsFloat,
			data.FieldTypeFloat64,
			true,
		),
		Entry("a NaN Decimal128 to an error",
			testDecimalNaN,
			nil,
			data.FieldTypeUnknown,
			false,
		),
		Entry("an Infinite Decimal128 to an error",
			testDecimalInf,
			nil,
			data.FieldTypeUnknown,
			false,
		),
		Entry("a MinKey to a string",
			bsonprim.MinKey{},
			"primitive.MinKey{}",
			data.FieldTypeString,
			true,
		),
		Entry("a MaxKey to a string",
			bsonprim.MaxKey{},
			"primitive.MaxKey{}",
			data.FieldTypeString,
			true,
		),
		Entry("a DBPointer to a string",
			bsonprim.DBPointer{DB: "db", Pointer: bsonprim.ObjectID{}},
			`primitive.DBPointer{DB:"db", Pointer:primitive.ObjectID{0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0}}`,
			data.FieldTypeString,
			true,
		),
		Entry("a Symbol to a string",
			bsonprim.Symbol("my_symbol"),
			"my_symbol",
			data.FieldTypeString,
			true,
		),
		Entry("an unsupported Go type to an error",
			struct{ X int }{X: 1},
			nil,
			data.FieldTypeUnknown,
			false,
		),
	)
})
