# Changelog

## 2.0.0 (2026-10-30)

### Breaking / Major Updates
- **Grafana 11.x & 12.x Compatibility:** Upgraded frontend SDK (`@grafana/data`, `@grafana/runtime`, `@grafana/ui` `^11.5.0`), migrated to **React 18** (`^18.2.0`), TypeScript 5.4, and updated backend SDK (`github.com/grafana/grafana-plugin-sdk-go` `v0.250.0`) with Go 1.24.
- **MongoDB 7.x & 8.x Compatibility:** Upgraded official Go MongoDB driver (`go.mongodb.org/mongo-driver` `v1.17.3`) with full support for MongoDB 6.0, 7.0, and 8.0 features.

### Performance & Reliability Improvements
- **Persistent Connection Pooling:** Rewrote `MongoDBDatasource` lifecycle management (`NewMongoDBDatasource` and `Dispose`) to maintain a thread-safe, pooled `*mongo.Client` per datasource instance rather than opening and disconnecting a new TCP/TLS connection on every query or health check.
- **Cursor Lifecycle Management:** Fixed server-side cursor leak in `query()` by ensuring `cursor.Close()` is always deferred.
- **Deterministic Schema Inference:** Sorted inferred schema fields and output frames alphabetically so table columns and time series preserve a consistent order across refreshes.
- **Memory & Timeout Guards:** Added `allowDiskUse` and `maxTimeMS` aggregation options, per-query context timeouts, and an upper document safety bound (`maxDocumentsPerQuery`) to prevent backend OOM errors.

### Security Fixes & Enhancements
- **Credential Redaction:** Removed raw logging of `backend.PluginContext` and `mongoOpts.ClientOptions` to prevent leaking `DecryptedSecureJSONData` or private keys in Grafana server logs.
- **Encrypted Connection URI:** Added `connectionUriSecret` support in `secureJsonData` for storing full `mongodb://` or `mongodb+srv://` URIs encrypted at rest.
- **Modern Authentication & mTLS:** Added explicit configuration for `SCRAM-SHA-256`, `SCRAM-SHA-1`, `MONGODB-X509`, `MONGODB-AWS`, and `PLAIN` mechanisms, custom `authSource`, TLS 1.2+ enforcement, and PKCS#1 / PKCS#8 / EC client private keys.
- **Granular Secret Resets:** Fixed `ConfigEditor` credential reset handler so resetting one secret field no longer wipes all other configured secrets.
- **Safe BSON Serialization:** Replaced unchecked slice bounds manipulation in `ToGrafanaValue` with validated Extended JSON marshaling and explicit `NaN`/`Inf` handling for `Decimal128`.

### Bug Fixes
- Fixed `len(m.ValueFields) != len(m.ValueFieldTypes)` validation bug in `model.go` that previously compared `m.ValueFields` to itself.
- Fixed `ConvertGoTimeFormatToMongo` in `mongodb.go` swallowing unsupported format errors and producing malformed error strings.
- Removed unused browser-side `mongodb` package from `package.json`.

## 0.1.0

- Initial community release.
