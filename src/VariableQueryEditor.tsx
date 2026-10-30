import { defaults } from 'lodash';
import React, { ChangeEvent, PureComponent, SyntheticEvent } from 'react';
import {
  Alert,
  Button,
  CodeEditor,
  InlineField,
  InlineFieldRow,
  InlineFormLabel,
  InlineSwitch,
  Input,
  Select,
} from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import {
  defaultVariableQuery,
  MongoDBVariableQuery,
  validateAggregationPipelineJson,
  VALUE_FIELD_TYPE_OPTIONS,
} from './types';

interface VariableQueryProps {
  query: MongoDBVariableQuery;
  onChange: (query: MongoDBVariableQuery, definition?: string) => void;
}

interface State {
  aggregationError: string | null;
}

export class VariableQueryEditor extends PureComponent<VariableQueryProps, State> {
  readonly labelWidth = 26;
  readonly longWidth = 48;

  constructor(props: VariableQueryProps) {
    super(props);
    const initialAggregation = props.query?.aggregation ?? defaultVariableQuery.aggregation ?? '[]';
    this.state = {
      aggregationError: validateAggregationPipelineJson(initialAggregation),
    };
  }

  emitChange(nextQuery: MongoDBVariableQuery) {
    const { onChange } = this.props;
    const definition = `${nextQuery.database || '<default>'}.${nextQuery.collection || '<collection>'} (${nextQuery.fieldName || '_id'})`;
    onChange(nextQuery, definition);
  }

  onDatabaseChange = (event: ChangeEvent<HTMLInputElement>) => {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    this.emitChange({ ...query, database: event.target.value });
  };

  onCollectionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    this.emitChange({ ...query, collection: event.target.value });
  };

  onFieldNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    this.emitChange({ ...query, fieldName: event.target.value });
  };

  onFieldTypeSelectChange = (selected: SelectableValue<string>) => {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    this.emitChange({ ...query, fieldType: selected?.value ?? 'string' });
  };

  onAllowDiskUseChange = (event: SyntheticEvent<HTMLInputElement>) => {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    this.emitChange({ ...query, allowDiskUse: event.currentTarget.checked });
  };

  onMaxTimeMSChange = (event: ChangeEvent<HTMLInputElement>) => {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    const parsed = parseInt(event.target.value, 10);
    this.emitChange({ ...query, maxTimeMS: Number.isNaN(parsed) || parsed < 0 ? 0 : parsed });
  };

  onAggregationChange = (newAggregation: string) => {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    const validationError = validateAggregationPipelineJson(newAggregation);
    this.setState({ aggregationError: validationError });
    this.emitChange({ ...query, aggregation: newAggregation });
  };

  onFormatAggregation = () => {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    const current = query.aggregation || defaultVariableQuery.aggregation || '[]';
    try {
      const parsed = JSON.parse(current);
      const formatted = JSON.stringify(parsed, null, 2);
      this.setState({ aggregationError: null });
      this.emitChange({ ...query, aggregation: formatted });
    } catch (err) {
      this.setState({ aggregationError: validateAggregationPipelineJson(current) });
    }
  };

  resolveFieldTypeOption(currentType: string | undefined): SelectableValue<string> {
    const normalized = currentType || 'string';
    const existing = VALUE_FIELD_TYPE_OPTIONS.find((opt) => opt.value === normalized);
    if (existing) {
      return existing;
    }
    return { label: normalized, value: normalized };
  }

  render() {
    const query = defaults(this.props.query, defaultVariableQuery) as MongoDBVariableQuery;
    const { aggregationError } = this.state;

    return (
      <>
        <InlineFieldRow>
          <InlineField labelWidth={this.labelWidth} label="Database.Collection">
            <Input
              width={this.longWidth}
              name="database"
              type="text"
              placeholder="my_database"
              onChange={this.onDatabaseChange}
              value={query.database || ''}
            />
          </InlineField>
          <InlineField label=".">
            <Input
              width={this.longWidth}
              name="collection"
              type="text"
              placeholder="my_collection"
              onChange={this.onCollectionChange}
              value={query.collection || ''}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField label="Field" labelWidth={this.labelWidth}>
            <Input
              width={36}
              placeholder="_id"
              onChange={this.onFieldNameChange}
              value={query.fieldName || ''}
            />
          </InlineField>
          <InlineField label=":">
            <Select
              width={36}
              options={VALUE_FIELD_TYPE_OPTIONS}
              value={this.resolveFieldTypeOption(query.fieldType)}
              allowCustomValue={true}
              onCreateOption={(customValue) => {
                this.onFieldTypeSelectChange({ label: customValue, value: customValue });
              }}
              onChange={this.onFieldTypeSelectChange}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField
            label="Allow Disk Use"
            labelWidth={this.labelWidth}
            tooltip="Enable allowDiskUse on the MongoDB aggregation cursor for large variable queries"
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

        <InlineFieldRow>
          <InlineFormLabel
            width={this.labelWidth}
            tooltip="Argument to db.collection.aggregate(...), a JSON array of pipeline stage objects."
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

        <CodeEditor
          height="200px"
          showLineNumbers={true}
          language="json"
          onBlur={this.onAggregationChange}
          onSave={this.onAggregationChange}
          value={query.aggregation || ''}
        />
      </>
    );
  }
}
