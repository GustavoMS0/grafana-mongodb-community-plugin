package plugin

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/pkg/errors"
	mongoOpts "go.mongodb.org/mongo-driver/mongo/options"
)

const (
	defaultConnectTimeoutSeconds = 10
	defaultMaxPoolSize           = 50
)

var supportedAuthMechanisms = map[string]struct{}{
	"":              {},
	"SCRAM-SHA-256": {},
	"SCRAM-SHA-1":   {},
	"MONGODB-X509":  {},
	"MONGODB-AWS":   {},
	"PLAIN":         {},
}

type jsonData struct {
	URL                   string `json:"url"`
	DefaultDatabase       string `json:"defaultDatabase"`
	AuthMechanism         string `json:"authMechanism"`
	AuthSource            string `json:"authSource"`
	ConnectTimeoutSeconds int    `json:"connectTimeoutSeconds"`
	MaxPoolSize           uint64 `json:"maxPoolSize"`
	DirectConnection      bool   `json:"directConnection"`
	TLS                   bool   `json:"tls"`
	TLSCertificate        string `json:"tlsCertificate"`
	TLSCA                 string `json:"tlsCa"`
	TLSInsecure           bool   `json:"tlsInsecure"`
	TLSServerName         string `json:"tlsServerName"`
}

type secureJsonData struct {
	Username            string `json:"username"`
	Password            string `json:"password"`
	TLSCertificateKey   string `json:"tlsCertificateKey"`
	ConnectionURISecret string `json:"connectionUriSecret"`
}

type datasource struct {
	jsonData
	secureJsonData
}

func parseDatasourceConfig(settings *backend.DataSourceInstanceSettings) (datasource, error) {
	cfg := datasource{}
	if settings == nil {
		return cfg, fmt.Errorf("data source instance settings are missing")
	}
	if len(settings.JSONData) > 0 {
		if err := json.Unmarshal(settings.JSONData, &cfg.jsonData); err != nil {
			return cfg, errors.Wrap(err, "Failed to parse data source settings")
		}
	}
	if len(settings.DecryptedSecureJSONData) > 0 {
		secureBytes, err := json.Marshal(settings.DecryptedSecureJSONData)
		if err != nil {
			return cfg, errors.Wrap(err, "Failed to remarshal secure data source settings")
		}
		if err := json.Unmarshal(secureBytes, &cfg.secureJsonData); err != nil {
			return cfg, errors.Wrap(err, "Failed to parse secure data source settings")
		}
	}
	return cfg, nil
}

func (d *datasource) effectiveURI() string {
	if secretURI := strings.TrimSpace(d.ConnectionURISecret); secretURI != "" {
		return secretURI
	}
	return strings.TrimSpace(d.URL)
}

func (d *datasource) connectTimeout() time.Duration {
	if d.ConnectTimeoutSeconds <= 0 {
		return time.Duration(defaultConnectTimeoutSeconds) * time.Second
	}
	return time.Duration(d.ConnectTimeoutSeconds) * time.Second
}

func (d *datasource) applyAuth(uri *url.URL) error {
	mech := strings.TrimSpace(d.AuthMechanism)
	if _, ok := supportedAuthMechanisms[mech]; !ok {
		return fmt.Errorf("unsupported authentication mechanism: %s", mech)
	}
	if d.Username == "" {
		return nil
	}
	if uri.User == nil {
		uri.User = url.UserPassword(d.Username, d.Password)
	}
	return nil
}

func normalizePEM(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if !strings.Contains(trimmed, "\n") && strings.Contains(trimmed, `\n`) {
		trimmed = strings.ReplaceAll(trimmed, `\n`, "\n")
	}
	return trimmed
}

func (d *datasource) getTLS() (*tls.Config, error) {
	if !d.TLS {
		return nil, nil
	}
	tlsConfig := &tls.Config{
		MinVersion: tls.VersionTLS12,
	}
	caPEM := normalizePEM(d.TLSCA)
	if caPEM != "" {
		tlsConfig.RootCAs = x509.NewCertPool()
		if !tlsConfig.RootCAs.AppendCertsFromPEM([]byte(caPEM)) {
			return nil, fmt.Errorf("failed to add tlsCA")
		}
	}
	if d.TLSInsecure {
		tlsConfig.InsecureSkipVerify = true
	}
	certPEM := normalizePEM(d.TLSCertificate)
	keyPEM := normalizePEM(d.TLSCertificateKey)
	if (certPEM != "") != (keyPEM != "") {
		return nil, fmt.Errorf("Must provide both tlsCertificate and tlsCertificateKey, or neither")
	}
	if certPEM != "" && keyPEM != "" {
		clientCert, err := tls.X509KeyPair([]byte(certPEM), []byte(keyPEM))
		if err != nil {
			return nil, errors.Wrap(err, "Failed to parse TLS Certificate-Key Pair")
		}
		tlsConfig.Certificates = []tls.Certificate{clientCert}
	}
	if serverName := strings.TrimSpace(d.TLSServerName); serverName != "" {
		tlsConfig.ServerName = serverName
	}
	return tlsConfig, nil
}

func (d *datasource) buildClientOptions() (*mongoOpts.ClientOptions, error) {
	rawURI := d.effectiveURI()
	if rawURI == "" {
		return nil, fmt.Errorf("datasource URL must not be empty")
	}

	mongoURL, err := url.Parse(rawURI)
	if err != nil {
		return nil, fmt.Errorf("invalid datasource URL format")
	}
	if mongoURL.Scheme != "mongodb" && mongoURL.Scheme != "mongodb+srv" {
		return nil, fmt.Errorf("invalid datasource URL scheme %q: must be mongodb or mongodb+srv", mongoURL.Scheme)
	}

	if err := d.applyAuth(mongoURL); err != nil {
		return nil, err
	}

	opts := mongoOpts.Client().ApplyURI(mongoURL.String())

	mech := strings.TrimSpace(d.AuthMechanism)
	authSource := strings.TrimSpace(d.AuthSource)
	if d.Username != "" || mech != "" || authSource != "" {
		var cred mongoOpts.Credential
		if opts.Auth != nil {
			cred = *opts.Auth
		}
		if d.Username != "" {
			cred.Username = d.Username
			cred.Password = d.Password
			cred.PasswordSet = d.Password != ""
		}
		if mech != "" {
			cred.AuthMechanism = mech
		}
		if authSource != "" {
			cred.AuthSource = authSource
		}
		opts.SetAuth(cred)
	}

	timeout := d.connectTimeout()
	opts.SetConnectTimeout(timeout)
	opts.SetServerSelectionTimeout(timeout)

	poolSize := d.MaxPoolSize
	if poolSize == 0 {
		poolSize = defaultMaxPoolSize
	}
	opts.SetMaxPoolSize(poolSize)

	if d.DirectConnection && mongoURL.Scheme != "mongodb+srv" {
		opts.SetDirect(true)
	}

	tlsConfig, err := d.getTLS()
	if err != nil {
		return nil, err
	}
	if tlsConfig != nil {
		opts.SetTLSConfig(tlsConfig)
	}

	if err := opts.Validate(); err != nil {
		return nil, errors.Wrap(err, "invalid MongoDB client options")
	}

	return opts, nil
}
