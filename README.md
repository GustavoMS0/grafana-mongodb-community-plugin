# Grafana MongoDB Community Plugin (v2.0)

Modernized, high-performance **MongoDB Datasource Plugin** for **Grafana 11.x and 12.x**, built with the official MongoDB Go Driver (`v1.17.x`) and full support for **MongoDB 6.0, 7.0, and 8.0** (including Time Series collections, Atlas `mongodb+srv://`, `SCRAM-SHA-256`, `MONGODB-X509` mTLS, and `MONGODB-AWS`).

---

## Key Features & Architecture (v2.0)

- **Grafana 11.x & 12.x Ready:** Built on `@grafana/data`, `@grafana/runtime`, `@grafana/ui` `^11.5.0`, React 18, and `grafana-plugin-sdk-go` `v0.250.0`.
- **MongoDB 7.x & 8.x Support:** Powered by `go.mongodb.org/mongo-driver` `v1.17.3` on Go 1.24.
- **Persistent Connection Pooling:** Maintains a thread-safe, pooled `*mongo.Client` per datasource instance with automatic cleanup on `Dispose()`, eliminating per-query TCP/TLS/SCRAM handshake overhead.
- **Modern Authentication & Security:**
  - Explicit support for `SCRAM-SHA-256` (recommended for MongoDB 7/8), `SCRAM-SHA-1`, `MONGODB-X509` (mTLS), `MONGODB-AWS` (IAM), and `PLAIN` (LDAP SASL).
  - Encrypted storage for `Username`, `Password`, `Client TLS Private Key`, and full `Encrypted Connection URI` (`connectionUriSecret`) via Grafana `secureJsonData`.
  - TLS 1.2+ enforcement with custom CA bundle, SAN/ServerName override, and PKCS#1 / PKCS#8 / EC client certificates.
- **Resource & OOM Protection:**
  - Automatic server-side cursor cleanup (`defer cursor.Close`).
  - Configurable `Allow Disk Use` (`allowDiskUse`) and server-side `Max Time (ms)` (`maxTimeMS`) per query.
  - Per-query context timeout propagation and upper document safety cap (`100,000` documents per query).
- **Enhanced Query & Variable Editor:**
  - Real-time JSON syntax & stage validation with one-click **Format JSON**.
  - Interactive field type selector (`float64`, `int64`, `int32`, `uint64`, `uint32`, `string`, `bool`, `time.Time`, `json.RawMessage`, plus nullable `*` variants).
  - Deterministic alphabetical column ordering when **Infer Schema** is enabled.
  - Template variable interpolation across `database`, `collection`, `timestampField`, `legendFormat`, `labelFields`, `valueFields`, and `aggregation`.

---

## Datasource Configuration

1. Navigate to **Connections → Data sources → Add new data source** and select **mongodb-community**.
2. Configure **MongoDB Connection**:
   - **URL:** Standard `mongodb://host:27017` or DNS seed list `mongodb+srv://cluster.mongodb.net`.
   - **Encrypted Connection URI (Optional):** If your URI embeds credentials or sensitive query parameters, store it here to keep it encrypted in Grafana's database.
   - **Default Database:** Default database used when a panel or variable query leaves the database field blank.
   - **Connection Timeout (s) & Max Pool Size:** Tune connection timeout (default `10s`) and pool size (default `50`).
3. Configure **Authentication**:
   - Choose `Auto / Driver Default`, `SCRAM-SHA-256`, `SCRAM-SHA-1`, `MONGODB-X509`, `MONGODB-AWS`, or `PLAIN`.
   - Specify **Auth Source** (e.g., `admin` or `$external`) and encrypted **Username** / **Password**.
4. Configure **TLS / mTLS Security** (if enabled):
   - Provide **TLS CA Certificate**, **Expected Server Name**, and optional **Client TLS Certificate** + **Client TLS Private Key**.

---

## Querying MongoDB

### Timeseries Queries
- **Database.Collection:** Target database (falls back to Default Database) and collection.
- **Timestamp Field & Format:** Document field containing the BSON Date/Timestamp (or a string parsed using a Go `time.Parse` layout).
- **Label Fields:** Document fields whose unique combinations split results into distinct time series frames.
- **Automatic Time-Bound:** Injects a `$match` stage bounding the timestamp field to Grafana's active dashboard time range (`$__from` to `$__to`), either at the end of the pipeline or at the start (`Time-Bound at Start`) to leverage collection/timeseries indexes.
- **Automatic Time-Sort:** Appends `{"$sort": {"<timestampField>": 1}}` to the pipeline.

### Table Queries & Schema Inference
- Choose **Table** as the Query Type to return arbitrary tabular columns.
- Enable **Infer Schema** to automatically detect column types from the first *N* documents in deterministic alphabetical column order, or explicitly declare **Value Fields** and their types.

### Template Variables
You can use Grafana built-in and dashboard variables inside the aggregation pipeline:
```json
[
  {
    "$match": {
      "timestamp": {
        "$gte": { "$date": { "$numberLong": "$__from" } },
        "$lte": { "$date": { "$numberLong": "$__to" } }
      }
    }
  }
]
```

---

## Building from Source

### Prerequisites
- **Go:** `>= 1.24`
- **Node.js:** `>= 20`

### Build Commands
```bash
# Install frontend dependencies and build production bundle
npm install --legacy-peer-deps --ignore-scripts
npm run typecheck
npm run build

# Run backend unit tests and build plugin binaries
go vet ./pkg/...
go test -v -race ./pkg/...
GOOS=linux GOARCH=amd64 go build -o dist/gpx_mongodb-community_linux_amd64 ./pkg
GOOS=windows GOARCH=amd64 go build -o dist/gpx_mongodb-community_windows_amd64.exe ./pkg
```

---

## License

Licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
Originally created by [Andrew Melnick](https://github.com/meln5674/grafana-mongodb-community-plugin), modernized for Grafana 11/12 and MongoDB 7/8 by [Gustavo Martins](https://github.com/GustavoMS0).
