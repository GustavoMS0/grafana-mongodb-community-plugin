import { defaults, zip } from 'lodash';
import React, { ChangeEvent, PureComponent, SyntheticEvent } from 'react';
import {
  Alert,
  Button,
  CodeEditor,
  FieldSet,
  InlineField,
  InlineFieldRow,
  InlineFormLabel,
  InlineSwitch,
  Input,
  Select,
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataSource } from './datasource';
import {
  defaultQuery,
  MongoDBDataSourceOptions,
  MongoDBQuery,
  MongoDBQueryType,
  validateAggregationPipelineJson,
  VALUE_FIELD_TYPE_OPTIONS,
} from './types';

type Props = QueryEditorProps<DataSource, MongoDBQuery, MongoDBDataSourceOptions>;

interface State {
  aggregationError: string | null;
}

export class QueryEditor extends PureComponent<Props, State> {
  readonly labelWidth = 26;
  readonly longWidth = 48;

  readonly queryTypeOptions: Array<SelectableValue<MongoDBQueryType>> = [
    {
      label: 'Timeseries',
      value: MongoDBQueryType.Timeseries,
      description: 'Return time-indexed series of values, distinguished by a set of labels',
    },
    {
      label: 'Table',
      value: MongoDBQueryType.Table,
      description: 'Return arbitrary rows for a table or further processing',
    },
  ];

  readonly defaultQueryType: MongoDBQueryType = MongoDBQueryType.Timeseries;

  constructor(props: Props) {
    super(props);
    const initialAggregation = props.query.aggregation ?? defaultQuery.aggregation ?? '[]';
    this.state = {
      aggregationError: validateAggregationPipelineJson(initialAggregation),
    };
  }

  onDatabaseChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, database: event.target.value });
    onRunQuery();
  };

  onCollectionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, collection: event.target.value });
    onRunQuery();
  };

  onQueryTypeChange =
    (query: Props['query'], onChange: Props['onChange'], onRunQuery: Props['onRunQuery']) =>
    (newValue: SelectableValue<MongoDBQueryType>) => {
      onChange({ ...query, queryType: newValue.value ?? this.defaultQueryType });
      onRunQuery();
    };

  onTimestampFieldChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, timestampField: event.target.value });
    onRunQuery();
  };

  onTimestampFormatChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, timestampFormat: event.target.value });
    onRunQuery();
  };

  onLabelFieldChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    const newLabelFields = Array.from(query.labelFields || []);
    newLabelFields.splice(index, 1, event.target.value);
    onChange({ ...query, labelFields: newLabelFields });
    onRunQuery();
  };

  onLabelFieldAppend = () => {
    const { onChange, query, onRunQuery } = this.props;
    const currentLabels = query.labelFields || [];
    const newLabelFields = [...currentLabels, ''];
    onChange({ ...query, labelFields: newLabelFields });
    onRunQuery();
  };

  onLabelFieldRemove = (index: number) => () => {
    const { onChange, query, onRunQuery } = this.props;
    const newLabelFields = Array.from(query.labelFields || []);
    newLabelFields.splice(index, 1);
    onChange({ ...query, labelFields: newLabelFields });
    onRunQuery();
  };

  onLegendFormatChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, legendFormat: event.target.value });
    onRunQuery();
  };

  onSchemaInferenceChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, schemaInference: event.currentTarget.checked });
    onRunQuery();
  };

  onSchemaInferenceDepthChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    const parsed = parseInt(event.target.value, 10);
    onChange({ ...query, schemaInferenceDepth: Number.isNaN(parsed) || parsed < 1 ? 20 : parsed });
    onRunQuery();
  };

  onValueFieldChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    const newValueFields = Array.from(query.valueFields || []);
    newValueFields.splice(index, 1, event.target.value);
    onChange({ ...query, valueFields: newValueFields });
    onRunQuery();
  };

  onValueFieldTypeSelectChange = (index: number) => (selected: SelectableValue<string>) => {
    const { onChange, query, onRunQuery } = this.props;
    const newValueFieldTypes = Array.from(query.valueFieldTypes || []);
    newValueFieldTypes.splice(index, 1, selected?.value ?? 'float64');
    onChange({ ...query, valueFieldTypes: newValueFieldTypes });
    onRunQuery();
  };

  onValueFieldAppend = () => {
    const { onChange, query, onRunQuery } = this.props;
    const newValueFields = [...(query.valueFields || []), ''];
    const newValueFieldTypes = [...(query.valueFieldTypes || []), 'float64'];
    onChange({ ...query, valueFields: newValueFields, valueFieldTypes: newValueFieldTypes });
    onRunQuery();
  };

  onValueFieldRemove = (index: number) => () => {
    const { onChange, query, onRunQuery } = this.props;
    const newValueFields = Array.from(query.valueFields || []);
    const newValueFieldTypes = Array.from(query.valueFieldTypes || []);
    newValueFields.splice(index, 1);
    newValueFieldTypes.splice(index, 1);
    onChange({ ...query, valueFields: newValueFields, valueFieldTypes: newValueFieldTypes });
    onRunQuery();
  };

  onAutoTimeBoundChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, autoTimeBound: event.currentTarget.checked });
    onRunQuery();
  };

  onAutoTimeBoundAtStartChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, autoTimeBoundAtStart: event.currentTarget.checked });
    onRunQuery();
  };

  onAutoTimeSortChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, autoTimeSort: event.currentTarget.checked });
    onRunQuery();
  };

  onAllowDiskUseChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, allowDiskUse: event.currentTarget.checked });
    onRunQuery();
  };

  onMaxTimeMSChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    const parsed = parseInt(event.target.value, 10);
    onChange({ ...query, maxTimeMS: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed });
    onRunQuery();
  };

  onAggregationChange = (newAggregation: string) => {
    const { onChange, query, onRunQuery } = this.props;
    const validationError = validateAggregationPipelineJson(newAggregation);
    this.setState({ aggregationError: validationError });
    onChange({ ...query, aggregation: newAggregation });
    if (!validationError) {
      onRunQuery();
    }
  };

  onFormatAggregation = () => {
    const { onChange, query } = this.props;
    const current = query.aggregation || defaultQuery.aggregation || '[]';
    try {
      const parsed = JSON.parse(current);
      const formatted = JSON.stringify(parsed, null, 2);
      this.setState({ aggregationError: null });
      onChange({ ...query, aggregation: formatted });
    } catch (err) {
      this.setState({ aggregationError: validateAggregationPipelineJson(current) });
    }
  };

  resolveFieldTypeOption(currentType: string | undefined): SelectableValue<string> {
    const normalized = currentType || 'float64';
    const existing = VALUE_FIELD_TYPE_OPTIONS.find((opt) => opt.value === normalized);
    if (existing) {
      return existing;
    }
    return { label: normalized, value: normalized };
  }

  render() {
    const query = defaults(this.props.query, defaultQuery);
    const { onChange, onRunQuery, datasource } = this.props;
    const { aggregationError } = this.state;
    const isTimeseries = (query.queryType || this.defaultQueryType) === MongoDBQueryType.Timeseries;

    return (
      <>
        <FieldSet>
          <InlineFieldRow>
            <InlineField labelWidth={this.labelWidth} label="Database.Collection">
              <Input
                width={this.longWidth}
                name="database"
                type="text"
                placeholder={datasource?.defaultDatabase || 'my_database'}
                value={query.database || ''}
                onChange={this.onDatabaseChange}
              />
            </InlineField>
            <InlineField label=".">
              <Input
                width={this.longWidth}
                name="collection"
                type="text"
                placeholder="my_collection"
                value={query.collection || ''}
                onChange={this.onCollectionChange}
              />
            </InlineField>
          </InlineFieldRow>

          <InlineFieldRow>
            <InlineField labelWidth={this.labelWidth} tooltip="Type of query to execute" label="Query Type">
              <Select
                options={this.queryTypeOptions}
                value={
                  this.queryTypeOptions.find((queryType) => queryType.value === query.queryType) ??
                  this.queryTypeOptions[0]
                }
                onChange={this.onQueryTypeChange(query, onChange, onRunQuery)}
                width={this.longWidth}
              />
            </InlineField>
          </InlineFieldRow>

          {isTimeseries ? (
            <>
              <InlineFieldRow>
                <InlineField
                  labelWidth={this.labelWidth}
                  label="Timestamp Field"
                  tooltip="Field to expect in every document containing the timestamp"
                >
                  <Input
                    width={this.longWidth}
                    value={query.timestampField || ''}
                    onChange={this.onTimestampFieldChange}
                    type="text"
                    placeholder="timestamp"
                    name="timestampField"
                  />
                </InlineField>
              </InlineFieldRow>
              <InlineFieldRow>
                <InlineField
                  labelWidth={this.labelWidth}
                  label="Timestamp Format"
                  tooltip="If blank, assume timestamps are native BSON dates. Otherwise, parse the timestamp as a string in the Go time.Parse layout"
                >
                  <Input
                    width={this.longWidth}
                    value={query.timestampFormat || ''}
                    onChange={this.onTimestampFormatChange}
                    type="text"
                    placeholder="<BSON $date>"
                    name="timestampFormat"
                  />
                </InlineField>
              </InlineFieldRow>

              <InlineFieldRow>
                <InlineFormLabel
                  width={this.labelWidth}
                  tooltip="Each unique combination of these fields defines a separate time series. Nested fields are not supported, please project to a flat document"
                >
                  Label Fields
                </InlineFormLabel>
                <div>
                  {(query.labelFields || []).map((field, index) => (
                    <InlineFieldRow key={index}>
                      <Input
                        width={this.longWidth}
                        onChange={this.onLabelFieldChange(index)}
                        value={field}
                        placeholder="label_field"
                      />
                      <Button variant="secondary" onClick={this.onLabelFieldRemove(index)} type="button">
                        -
                      </Button>
                    </InlineFieldRow>
                  ))}
                  <Button variant="secondary" onClick={this.onLabelFieldAppend} type="button">
                    + Add Label Field
                  </Button>
                </div>
              </InlineFieldRow>

              <InlineFieldRow>
                <InlineField
                  labelWidth={this.labelWidth}
                  label="Legend Format"
                  tooltip={
                    "Series name override. Replacements are:\n{{.Value}}: Value field name.\n{{.Labels.field_name}}: Value of the label with name 'field_name'\n{{.Labels}}: key=value,... for all labels"
                  }
                >
                  <Input
                    width={this.longWidth}
                    value={query.legendFormat || ''}
                    onChange={this.onLegendFormatChange}
                    placeholder="{{.Value}} {{.Labels}}"
                  />
                </InlineField>
              </InlineFieldRow>

              <InlineFieldRow>
                <InlineField
                  label="Automatic Time-Bound"
                  labelWidth={this.labelWidth}
                  tooltip="Add a stage at the end of your pipeline to $match documents where Timestamp Field is within the current dashboard time range"
                >
                  <InlineSwitch value={Boolean(query.autoTimeBound)} onChange={this.onAutoTimeBoundChange} />
                </InlineField>
                {query.autoTimeBound ? (
                  <InlineField
                    label="Time-Bound at Start"
                    labelWidth={this.labelWidth}
                    tooltip="Add the automatic time bound $match stage at the beginning of your pipeline to utilize collection indexes"
                  >
                    <InlineSwitch
                      value={Boolean(query.autoTimeBoundAtStart)}
                      onChange={this.onAutoTimeBoundAtStartChange}
                    />
                  </InlineField>
                ) : null}
                <InlineField
                  label="Automatic Time-Sort"
                  labelWidth={this.labelWidth}
                  tooltip="Add a stage at the end to $sort documents ascending by Timestamp Field"
                >
                  <InlineSwitch value={Boolean(query.autoTimeSort)} onChange={this.onAutoTimeSortChange} />
                </InlineField>
              </InlineFieldRow>
            </>
          ) : null}

          <InlineFieldRow>
            <InlineField
              label="Infer Schema"
              labelWidth={this.labelWidth}
              tooltip="If enabled, Grafana will infer field types from the first few documents returned by MongoDB"
            >
              <InlineSwitch value={Boolean(query.schemaInference)} onChange={this.onSchemaInferenceChange} />
            </InlineField>
            {query.schemaInference ? (
              <InlineField
                labelWidth={this.labelWidth}
                label="Schema Inference Depth"
                tooltip="Number of documents to inspect for schema inference"
              >
                <Input
                  width={16}
                  value={`${query.schemaInferenceDepth ?? 20}`}
                  onChange={this.onSchemaInferenceDepthChange}
                  type="number"
                  min={1}
                />
              </InlineField>
            ) : null}
          </InlineFieldRow>

          {!query.schemaInference ? (
            <InlineFieldRow>
              <InlineFormLabel
                width={this.labelWidth}
                tooltip="Fields containing measurements or recorded values along with their data types. Prefix with * if a field is nullable."
              >
                Value Fields
              </InlineFormLabel>
              <div>
                {zip(query.valueFields || [], query.valueFieldTypes || []).map(([fieldName, fieldType], index) => (
                  <InlineFieldRow key={index}>
                    <Input
                      onChange={this.onValueFieldChange(index)}
                      width={36}
                      value={fieldName || ''}
                      placeholder="field_name"
                    />
                    <InlineField label=":">
                      <Select
                        width={36}
                        options={VALUE_FIELD_TYPE_OPTIONS}
                        value={this.resolveFieldTypeOption(fieldType)}
                        allowCustomValue={true}
                        onCreateOption={(customValue) => {
                          this.onValueFieldTypeSelectChange(index)({
                            label: customValue,
                            value: customValue,
                          });
                        }}
                        onChange={this.onValueFieldTypeSelectChange(index)}
                      />
                    </InlineField>
                    <Button variant="secondary" onClick={this.onValueFieldRemove(index)} type="button">
                      -
                    </Button>
                  </InlineFieldRow>
                ))}
                <Button variant="secondary" onClick={this.onValueFieldAppend} type="button">
                  + Add Value Field
                </Button>
              </div>
            </InlineFieldRow>
          ) : null}

          <InlineFieldRow>
            <InlineField
              label="Allow Disk Use"
              labelWidth={this.labelWidth}
              tooltip="Enable allowDiskUse on the MongoDB aggregation cursor for large pipelines exceeding memory limits (MongoDB 6/7/8)"
            >
              <InlineSwitch value={Boolean(query.allowDiskUse)} onChange={this.onAllowDiskUseChange} />
            </InlineField>
            <InlineField
              label="Max Time (ms)"
              labelWidth={20}
              tooltip="Maximum execution time in milliseconds on the MongoDB server (0 = no server-side limit)"
            >
              <Input
                width={20}
                type="number"
                min={0}
                placeholder="0"
                value={query.maxTimeMS ?? 0}
                onChange={this.onMaxTimeMSChange}
              />
            </InlineField>
          </InlineFieldRow>
        </FieldSet>

        <InlineFieldRow>
          <InlineFormLabel
            width={this.labelWidth}
            tooltip="Argument to db.collection.aggregate(...), a JSON array of pipeline stage objects. Use MongoDB Extended JSON ($date, $oid) for BSON types."
          >
            Aggregation Pipeline
          </InlineFormLabel>
          <Button variant="secondary" size="sm" onClick={this.onFormatAggregation} type="button">
            Format JSON
          </Button>
        </InlineFieldRow>

        {aggregationError ? (
          <Alert title="Invalid Aggregation Pipeline JSON" severity="error">
            {aggregationError}
          </Alert>
        ) : null}

        <div style={{ resize: 'vertical' }}>
          <CodeEditor
            height="300px"
            showLineNumbers={true}
            language="json"
            value={query.aggregation || ''}
            onBlur={this.onAggregationChange}
            onSave={this.onAggregationChange}
          />
        </div>
      </>
    );
  }
}
