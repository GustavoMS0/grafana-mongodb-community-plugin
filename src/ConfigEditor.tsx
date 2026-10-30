import React, { ChangeEvent, PureComponent } from 'react';
import {
  Alert,
  Field,
  FieldSet,
  InlineField,
  InlineFieldRow,
  InlineSwitch,
  Input,
  SecretInput,
  SecretTextArea,
  Select,
  TextArea,
} from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, SelectableValue } from '@grafana/data';
import {
  AUTH_MECHANISM_OPTIONS,
  MongoDBDataSourceOptions,
  MongoDBSecureJsonData,
} from './types';

interface Props extends DataSourcePluginOptionsEditorProps<MongoDBDataSourceOptions, MongoDBSecureJsonData> {}

interface State {}

export class ConfigEditor extends PureComponent<Props, State> {
  readonly shortWidth = 28;
  readonly longWidth = 56;
  readonly beginCert = '-----BEGIN CERTIFICATE-----';
  readonly endCert = '-----END CERTIFICATE-----';
  readonly beginKey = '-----BEGIN PRIVATE KEY-----';
  readonly endKey = '-----END PRIVATE KEY-----';

  onURLChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      url: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onDefaultDatabaseChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      defaultDatabase: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onConnectTimeoutChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const parsed = parseInt(event.target.value, 10);
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      connectTimeoutSeconds: Number.isNaN(parsed) || parsed < 0 ? undefined : parsed,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onMaxPoolSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const parsed = parseInt(event.target.value, 10);
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      maxPoolSize: Number.isNaN(parsed) || parsed < 0 ? undefined : parsed,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onDirectConnectionChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      directConnection: event.currentTarget.checked,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onAuthMechanismChange = (selected: SelectableValue<string>) => {
    const { onOptionsChange, options } = this.props;
    const mechanism = selected?.value ?? '';
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      authMechanism: mechanism,
    };
    if (
      (mechanism === 'MONGODB-X509' || mechanism === 'MONGODB-AWS' || mechanism === 'PLAIN') &&
      !jsonData.authSource
    ) {
      jsonData.authSource = '$external';
    }
    onOptionsChange({ ...options, jsonData });
  };

  onAuthSourceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      authSource: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onTLSCAChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      tlsCa: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onTLSCertificateChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      tlsCertificate: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onTLSChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      tls: event.currentTarget.checked,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onTLSServerNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      tlsServerName: event.target.value,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onTLSInsecureChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const jsonData: MongoDBDataSourceOptions = {
      ...options.jsonData,
      tlsInsecure: event.currentTarget.checked,
    };
    onOptionsChange({ ...options, jsonData });
  };

  onUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const secureJsonData: MongoDBSecureJsonData = {
      ...options.secureJsonData,
      username: event.target.value,
    };
    onOptionsChange({ ...options, secureJsonData });
  };

  onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const secureJsonData: MongoDBSecureJsonData = {
      ...options.secureJsonData,
      password: event.target.value,
    };
    onOptionsChange({ ...options, secureJsonData });
  };

  onTLSCertificateKeyChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const { onOptionsChange, options } = this.props;
    const secureJsonData: MongoDBSecureJsonData = {
      ...options.secureJsonData,
      tlsCertificateKey: event.target.value,
    };
    onOptionsChange({ ...options, secureJsonData });
  };

  onConnectionUriSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    const secureJsonData: MongoDBSecureJsonData = {
      ...options.secureJsonData,
      connectionUriSecret: event.target.value,
    };
    onOptionsChange({ ...options, secureJsonData });
  };

  onResetUsername = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        username: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        username: '',
      },
    });
  };

  onResetPassword = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        password: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        password: '',
      },
    });
  };

  onResetTLSCertificateKey = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        tlsCertificateKey: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        tlsCertificateKey: '',
      },
    });
  };

  onResetConnectionUriSecret = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        connectionUriSecret: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        connectionUriSecret: '',
      },
    });
  };

  renderConnectionSettings() {
    const { options } = this.props;
    const { jsonData, secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as MongoDBSecureJsonData;

    return (
      <FieldSet label="MongoDB Connection">
        <InlineFieldRow>
          <InlineField
            label="URL"
            labelWidth={this.shortWidth}
            tooltip="MongoDB standard (mongodb://) or DNS seed list (mongodb+srv://) connection URI"
          >
            <Input
              width={this.longWidth}
              name="url"
              type="text"
              onChange={this.onURLChange}
              value={jsonData.url || ''}
              placeholder="mongodb://hostname:27017 or mongodb+srv://cluster.example.net"
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            label="Encrypted Connection URI"
            labelWidth={this.shortWidth}
            tooltip="Optional. Store the full MongoDB URI in Grafana encrypted secure storage instead of plaintext JSON data. Overrides URL if configured."
          >
            <SecretInput
              width={this.longWidth}
              isConfigured={Boolean(secureJsonFields?.connectionUriSecret)}
              value={secureJsonData.connectionUriSecret || ''}
              placeholder="mongodb+srv://user:pass@cluster.example.net/?retryWrites=true&w=majority"
              onReset={this.onResetConnectionUriSecret}
              onChange={this.onConnectionUriSecretChange}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            label="Default Database"
            labelWidth={this.shortWidth}
            tooltip="Default database pre-filled in queries and variable editors when not explicitly specified"
          >
            <Input
              width={this.longWidth}
              name="defaultDatabase"
              type="text"
              onChange={this.onDefaultDatabaseChange}
              value={jsonData.defaultDatabase || ''}
              placeholder="my_db"
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            label="Connection Timeout (s)"
            labelWidth={this.shortWidth}
            tooltip="Timeout in seconds for establishing connections and health checks (default: 10s)"
          >
            <Input
              width={20}
              name="connectTimeoutSeconds"
              type="number"
              min={1}
              max={300}
              onChange={this.onConnectTimeoutChange}
              value={jsonData.connectTimeoutSeconds ?? ''}
              placeholder="10"
            />
          </InlineField>
          <InlineField
            label="Max Pool Size"
            labelWidth={20}
            tooltip="Maximum number of connections in the MongoDB driver connection pool (default: 100)"
          >
            <Input
              width={16}
              name="maxPoolSize"
              type="number"
              min={1}
              max={1000}
              onChange={this.onMaxPoolSizeChange}
              value={jsonData.maxPoolSize ?? ''}
              placeholder="100"
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            label="Direct Connection"
            labelWidth={this.shortWidth}
            tooltip="Force operations to run directly on the specified host rather than discovering replica set topology"
          >
            <InlineSwitch
              value={Boolean(jsonData.directConnection)}
              onChange={this.onDirectConnectionChange}
            />
          </InlineField>
        </InlineFieldRow>
      </FieldSet>
    );
  }

  renderCredentials() {
    const { options } = this.props;
    const { jsonData, secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as MongoDBSecureJsonData;
    const currentMechanism =
      AUTH_MECHANISM_OPTIONS.find((opt) => opt.value === (jsonData.authMechanism || '')) ||
      AUTH_MECHANISM_OPTIONS[0];

    return (
      <FieldSet label="Authentication">
        <InlineFieldRow>
          <InlineField
            label="Auth Mechanism"
            labelWidth={this.shortWidth}
            tooltip="Authentication mechanism used by the MongoDB driver. SCRAM-SHA-256 is recommended for MongoDB 6, 7, and 8."
          >
            <Select
              width={this.longWidth}
              options={AUTH_MECHANISM_OPTIONS}
              value={currentMechanism}
              onChange={this.onAuthMechanismChange}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            label="Auth Source"
            labelWidth={this.shortWidth}
            tooltip="Database name associated with the user's credentials (e.g., admin, or $external for X.509 / AWS IAM / LDAP)"
          >
            <Input
              width={this.longWidth}
              name="authSource"
              type="text"
              onChange={this.onAuthSourceChange}
              value={jsonData.authSource || ''}
              placeholder="admin"
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Username" labelWidth={this.shortWidth}>
            <SecretInput
              width={this.longWidth}
              isConfigured={Boolean(secureJsonFields?.username)}
              value={secureJsonData.username || ''}
              placeholder="Username"
              onReset={this.onResetUsername}
              onChange={this.onUsernameChange}
            />
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Password" labelWidth={this.shortWidth}>
            <SecretInput
              width={this.longWidth}
              isConfigured={Boolean(secureJsonFields?.password)}
              value={secureJsonData.password || ''}
              placeholder="Password"
              onReset={this.onResetPassword}
              onChange={this.onPasswordChange}
            />
          </InlineField>
        </InlineFieldRow>
      </FieldSet>
    );
  }

  renderTlsVerification() {
    const { options } = this.props;
    const { jsonData } = options;

    return (
      <>
        <Field
          label="TLS CA Certificate"
          description="PEM-encoded Certificate Authority bundle used to verify the MongoDB server certificate"
        >
          <TextArea
            value={jsonData.tlsCa || ''}
            placeholder={`${this.beginCert}\n...\n${this.endCert}`}
            onChange={this.onTLSCAChange}
            rows={6}
          />
        </Field>
        <InlineFieldRow>
          <InlineField
            labelWidth={this.shortWidth}
            label="Expected Server Name"
            tooltip="If your server's certificates are issued for a different hostname than the connection URL, specify that SAN/CN hostname here"
          >
            <Input
              width={this.longWidth}
              name="tlsServerName"
              type="text"
              onChange={this.onTLSServerNameChange}
              value={jsonData.tlsServerName || ''}
              placeholder="mongodb.internal.example.com"
            />
          </InlineField>
        </InlineFieldRow>
      </>
    );
  }

  renderTlsClient() {
    const { options } = this.props;
    const { jsonData, secureJsonFields } = options;
    const secureJsonData = (options.secureJsonData || {}) as MongoDBSecureJsonData;

    return (
      <>
        <Field
          label="Client TLS Certificate"
          description="PEM-encoded client certificate for mutual TLS (mTLS) or MONGODB-X509 authentication"
        >
          <TextArea
            value={jsonData.tlsCertificate || ''}
            placeholder={`${this.beginCert}\n...\n${this.endCert}`}
            onChange={this.onTLSCertificateChange}
            rows={6}
          />
        </Field>
        <Field
          label="Client TLS Private Key"
          description="PEM-encoded private key corresponding to the client TLS certificate (stored encrypted)"
        >
          <SecretTextArea
            value={secureJsonData.tlsCertificateKey || ''}
            isConfigured={Boolean(secureJsonFields?.tlsCertificateKey)}
            placeholder={`${this.beginKey}\n...\n${this.endKey}`}
            onChange={this.onTLSCertificateKeyChange}
            onReset={this.onResetTLSCertificateKey}
            rows={6}
          />
        </Field>
      </>
    );
  }

  renderTlsFields() {
    const { options } = this.props;
    const { jsonData } = options;

    return (
      <>
        <InlineFieldRow>
          <InlineField
            label="Skip TLS Verification (Insecure)"
            labelWidth={this.shortWidth}
            tooltip="Disables server certificate chain and hostname verification. Do not enable in production."
          >
            <InlineSwitch
              value={Boolean(jsonData.tlsInsecure)}
              onChange={this.onTLSInsecureChange}
            />
          </InlineField>
        </InlineFieldRow>
        {jsonData.tlsInsecure ? (
          <Alert title="TLS verification is disabled" severity="warning">
            Server certificate and hostname verification are skipped. Connections are vulnerable to man-in-the-middle
            attacks.
          </Alert>
        ) : (
          this.renderTlsVerification()
        )}
        {this.renderTlsClient()}
      </>
    );
  }

  renderTls() {
    const { options } = this.props;
    const { jsonData } = options;

    return (
      <FieldSet label="TLS / mTLS Security">
        <InlineFieldRow>
          <InlineField
            label="TLS Enabled"
            labelWidth={this.shortWidth}
            tooltip="Encrypt traffic between Grafana and MongoDB using TLS"
          >
            <InlineSwitch value={Boolean(jsonData.tls)} onChange={this.onTLSChange} />
          </InlineField>
        </InlineFieldRow>
        {jsonData.tls ? this.renderTlsFields() : null}
      </FieldSet>
    );
  }

  render() {
    return (
      <>
        {this.renderConnectionSettings()}
        {this.renderCredentials()}
        {this.renderTls()}
      </>
    );
  }
}
