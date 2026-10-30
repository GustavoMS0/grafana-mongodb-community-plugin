import { lastValueFrom, Observable } from 'rxjs';
import {
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  MetricFindValue,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import {
  DataSourceWithBackend,
  getTemplateSrv,
  frameToMetricFindValue,
  TemplateSrv,
} from '@grafana/runtime';
import {
  defaultVariableQuery,
  MongoDBDataSourceOptions,
  MongoDBQuery,
  MongoDBQueryType,
  MongoDBVariableQuery,
} from './types';

export class DataSource extends DataSourceWithBackend<MongoDBQuery, MongoDBDataSourceOptions> {
  readonly defaultDatabase: string;

  constructor(instanceSettings: DataSourceInstanceSettings<MongoDBDataSourceOptions>) {
    super(instanceSettings);
    this.defaultDatabase = instanceSettings.jsonData?.defaultDatabase || '';
  }

  getDefaultQuery(): Partial<MongoDBQuery> {
    return {
      database: this.defaultDatabase || 'my_db',
    };
  }

  applyTemplateVariables(query: MongoDBQuery, scopedVars: ScopedVars): MongoDBQuery {
    const templateSrv = getTemplateSrv();
    const rawDatabase = query.database || this.defaultDatabase || '';

    return {
      ...query,
      database: rawDatabase ? templateSrv.replace(rawDatabase, scopedVars) : '',
      collection: query.collection ? templateSrv.replace(query.collection, scopedVars) : '',
      timestampField: query.timestampField ? templateSrv.replace(query.timestampField, scopedVars) : '',
      timestampFormat: query.timestampFormat ? templateSrv.replace(query.timestampFormat, scopedVars) : '',
      legendFormat: query.legendFormat ? templateSrv.replace(query.legendFormat, scopedVars) : '',
      labelFields: Array.isArray(query.labelFields)
        ? query.labelFields.map((field) => templateSrv.replace(field, scopedVars))
        : [],
      valueFields: Array.isArray(query.valueFields)
        ? query.valueFields.map((field) => templateSrv.replace(field, scopedVars))
        : [],
      aggregation: query.aggregation ? templateSrv.replace(query.aggregation, scopedVars, 'json') : '',
    };
  }

  query(request: DataQueryRequest<MongoDBQuery>): Observable<DataQueryResponse> {
    const templateSrv = getTemplateSrv() as TemplateSrv & {
      updateTimeRange?: (timeRange: TimeRange) => void;
    };
    if (request.range && typeof templateSrv.updateTimeRange === 'function') {
      templateSrv.updateTimeRange(request.range);
    }
    return super.query(request);
  }

  async metricFindQuery(
    query: MongoDBVariableQuery,
    options?: { scopedVars?: ScopedVars; range?: TimeRange }
  ): Promise<MetricFindValue[]> {
    const templateSrv = getTemplateSrv();
    const scopedVars = options?.scopedVars || {};
    const mergedQuery: MongoDBVariableQuery = {
      database: query?.database ?? this.defaultDatabase ?? defaultVariableQuery.database ?? '',
      collection: query?.collection ?? defaultVariableQuery.collection ?? '',
      aggregation: query?.aggregation ?? defaultVariableQuery.aggregation ?? '[]',
      fieldName: query?.fieldName ?? defaultVariableQuery.fieldName ?? '_id',
      fieldType: query?.fieldType ?? defaultVariableQuery.fieldType ?? 'string',
      allowDiskUse: query?.allowDiskUse ?? defaultVariableQuery.allowDiskUse ?? false,
      maxTimeMS: query?.maxTimeMS ?? defaultVariableQuery.maxTimeMS ?? 0,
    };

    const resolvedFieldName = mergedQuery.fieldName
      ? templateSrv.replace(mergedQuery.fieldName, scopedVars)
      : '_id';

    const target: MongoDBQuery = {
      refId: 'metricFindQuery',
      database: mergedQuery.database
        ? templateSrv.replace(mergedQuery.database, scopedVars)
        : this.defaultDatabase
          ? templateSrv.replace(this.defaultDatabase, scopedVars)
          : '',
      collection: mergedQuery.collection ? templateSrv.replace(mergedQuery.collection, scopedVars) : '',
      queryType: MongoDBQueryType.Table,
      timestampField: '',
      timestampFormat: '',
      labelFields: [],
      legendFormat: '',
      valueFields: [resolvedFieldName],
      valueFieldTypes: [mergedQuery.fieldType || 'string'],
      aggregation: mergedQuery.aggregation
        ? templateSrv.replace(mergedQuery.aggregation, scopedVars, 'json')
        : '[]',
      autoTimeBound: false,
      autoTimeBoundAtStart: false,
      autoTimeSort: false,
      schemaInference: false,
      schemaInferenceDepth: 0,
      allowDiskUse: Boolean(mergedQuery.allowDiskUse),
      maxTimeMS: mergedQuery.maxTimeMS || 0,
    };

    const dataQueryRequest = {
      ...options,
      targets: [target],
    } as DataQueryRequest<MongoDBQuery>;

    const rsp = await lastValueFrom(this.query(dataQueryRequest));
    if (rsp.error) {
      throw new Error(rsp.error.message);
    }
    if (rsp.data?.length) {
      return frameToMetricFindValue(rsp.data[0]);
    }
    return [];
  }
}
