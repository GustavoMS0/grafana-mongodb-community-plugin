import { DataQuery, DataSourceJsonData, SelectableValue } from '@grafana/data';

export interface MongoDBQuery extends DataQuery {
  database: string;
  collection: string;
  timestampField: string;
  timestampFormat: string;
  labelFields: string[];
  legendFormat: string;
  valueFields: string[];
  valueFieldTypes: string[];
  aggregation: string;
  autoTimeBound: boolean;
  autoTimeBoundAtStart: boolean;
  autoTimeSort: boolean;
  schemaInference: boolean;
  schemaInferenceDepth: number;
  allowDiskUse?: boolean;
  maxTimeMS?: number;
}

export enum MongoDBQueryType {
  Timeseries = 'Timeseries',
  Table = 'Table',
}

export const defaultQuery: Partial<MongoDBQuery> = {
  database: 'my_db',
  collection: 'my_collection',
  queryType: MongoDBQueryType.Timeseries,
  timestampField: 'timestamp',
  timestampFormat: '',
  labelFields: ['sensorID'],
  legendFormat: '',
  valueFields: ['measurement'],
  valueFieldTypes: ['float64'],
  aggregation: JSON.stringify([
    {
      $project: {
        timestamp: 1,
        sensorID: '$metadata.sensorID',
        measurement: 1,
        _id: 0,
      },
    },
  ]),
  autoTimeBound: false,
  autoTimeBoundAtStart: false,
  autoTimeSort: false,
  schemaInference: false,
  schemaInferenceDepth: 20,
  allowDiskUse: false,
  maxTimeMS: 0,
};

export interface MongoDBVariableQuery {
  database: string;
  collection: string;
  aggregation: string;
  fieldName: string;
  fieldType: string;
  allowDiskUse?: boolean;
  maxTimeMS?: number;
}

export const defaultVariableQuery: Partial<MongoDBVariableQuery> = {
  database: 'my_db',
  collection: 'my_collection',
  aggregation: JSON.stringify([{ $group: { _id: '$label', count: { $sum: 1 } } }]),
  fieldName: '_id',
  fieldType: 'string',
  allowDiskUse: false,
  maxTimeMS: 0,
};

export type MongoDBAuthMechanism =
  | ''
  | 'SCRAM-SHA-256'
  | 'SCRAM-SHA-1'
  | 'MONGODB-X509'
  | 'MONGODB-AWS'
  | 'PLAIN';

export const AUTH_MECHANISM_OPTIONS: Array<SelectableValue<string>> = [
  {
    label: 'Auto / Driver Default',
    value: '',
    description: 'Negotiate authentication mechanism automatically based on server capabilities',
  },
  {
    label: 'SCRAM-SHA-256 (Recommended for MongoDB 7/8)',
    value: 'SCRAM-SHA-256',
    description: 'Salted Challenge Response Authentication Mechanism using SHA-256',
  },
  {
    label: 'SCRAM-SHA-1',
    value: 'SCRAM-SHA-1',
    description: 'Legacy Salted Challenge Response Authentication Mechanism using SHA-1',
  },
  {
    label: 'MONGODB-X509 (mTLS Client Certificate)',
    value: 'MONGODB-X509',
    description: 'Authenticate using X.509 client certificate subject DN ($external)',
  },
  {
    label: 'MONGODB-AWS (IAM)',
    value: 'MONGODB-AWS',
    description: 'Authenticate using AWS IAM credentials ($external)',
  },
  {
    label: 'PLAIN (LDAP SASL)',
    value: 'PLAIN',
    description: 'Authenticate using LDAP SASL PLAIN mechanism ($external)',
  },
];

export const VALUE_FIELD_TYPE_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'float64 (Double / Number)', value: 'float64', description: '64-bit floating-point number' },
  { label: '*float64 (Nullable Double)', value: '*float64', description: 'Nullable 64-bit floating-point number' },
  { label: 'int64 (64-bit Integer / Long)', value: 'int64', description: '64-bit signed integer' },
  { label: '*int64 (Nullable 64-bit Integer)', value: '*int64', description: 'Nullable 64-bit signed integer' },
  { label: 'int32 (32-bit Integer)', value: 'int32', description: '32-bit signed integer' },
  { label: '*int32 (Nullable 32-bit Integer)', value: '*int32', description: 'Nullable 32-bit signed integer' },
  { label: 'uint64 (Unsigned 64-bit Integer)', value: 'uint64', description: '64-bit unsigned integer' },
  { label: '*uint64 (Nullable Unsigned 64-bit Integer)', value: '*uint64', description: 'Nullable 64-bit unsigned integer' },
  { label: 'uint32 (Unsigned 32-bit Integer)', value: 'uint32', description: '32-bit unsigned integer' },
  { label: '*uint32 (Nullable Unsigned 32-bit Integer)', value: '*uint32', description: 'Nullable 32-bit unsigned integer' },
  { label: 'string (UTF-8 String / ObjectId)', value: 'string', description: 'Text string' },
  { label: '*string (Nullable String)', value: '*string', description: 'Nullable text string' },
  { label: 'bool (Boolean)', value: 'bool', description: 'Boolean true/false value' },
  { label: '*bool (Nullable Boolean)', value: '*bool', description: 'Nullable boolean value' },
  { label: 'time.Time (BSON Date / Timestamp)', value: 'time.Time', description: 'BSON Date/Timestamp value' },
  { label: '*time.Time (Nullable Date)', value: '*time.Time', description: 'Nullable BSON Date/Timestamp value' },
  { label: 'json.RawMessage (Nested JSON / Subdocument)', value: 'json.RawMessage', description: 'Embedded JSON object or array' },
];

export function validateAggregationPipelineJson(rawJson: string): string | null {
  const trimmed = (rawJson || '').trim();
  if (!trimmed) {
    return 'Aggregation pipeline cannot be empty. Provide a JSON array of stage objects (e.g., [{"$match": {}}]).';
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return 'Aggregation pipeline must be a JSON array of stage objects (e.g., [{"$match": {}}]).';
    }
    for (let i = 0; i < parsed.length; i++) {
      const stage = parsed[i];
      if (typeof stage !== 'object' || stage === null || Array.isArray(stage)) {
        return `Pipeline stage at index ${i} must be a JSON object.`;
      }
      if ('$out' in stage || '$merge' in stage) {
        return `Write stages ($out, $merge) are not permitted in read-only Grafana queries (found at stage ${i}).`;
      }
    }
    return null;
  } catch (err) {
    if (err instanceof Error) {
      return `Invalid JSON syntax: ${err.message}`;
    }
    return 'Invalid JSON syntax in aggregation pipeline.';
  }
}

/**
 * These are options configured for each DataSource instance.
 */
export interface MongoDBDataSourceOptions extends DataSourceJsonData {
  url?: string;
  defaultDatabase?: string;
  authMechanism?: string;
  authSource?: string;
  connectTimeoutSeconds?: number;
  maxPoolSize?: number;
  directConnection?: boolean;
  tls?: boolean;
  tlsInsecure?: boolean;
  tlsCertificate?: string;
  tlsCa?: string;
  tlsServerName?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export interface MongoDBSecureJsonData {
  username?: string;
  password?: string;
  tlsCertificateKey?: string;
  connectionUriSecret?: string;
}
