package plugin

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/onsi/gomega"
)

func generateTestCertAndKey(t *testing.T, g *gomega.WithT, keyFormat string) (certPEM string, keyPEM string) {
	t.Helper()
	serialNumber, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	g.Expect(err).ToNot(gomega.HaveOccurred())

	template := x509.Certificate{
		SerialNumber: serialNumber,
		Subject: pkix.Name{
			Organization: []string{"Test Org"},
			CommonName:   "localhost",
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth, x509.ExtKeyUsageClientAuth},
		BasicConstraintsValid: true,
		IsCA:                  true,
	}

	switch keyFormat {
	case "PKCS1":
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		g.Expect(err).ToNot(gomega.HaveOccurred())
		derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
		g.Expect(err).ToNot(gomega.HaveOccurred())
		certPEM = string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes}))
		keyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)}))
	case "PKCS8":
		priv, err := rsa.GenerateKey(rand.Reader, 2048)
		g.Expect(err).ToNot(gomega.HaveOccurred())
		derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
		g.Expect(err).ToNot(gomega.HaveOccurred())
		pkcs8Bytes, err := x509.MarshalPKCS8PrivateKey(priv)
		g.Expect(err).ToNot(gomega.HaveOccurred())
		certPEM = string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes}))
		keyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: pkcs8Bytes}))
	case "EC":
		priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		g.Expect(err).ToNot(gomega.HaveOccurred())
		derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
		g.Expect(err).ToNot(gomega.HaveOccurred())
		ecBytes, err := x509.MarshalECPrivateKey(priv)
		g.Expect(err).ToNot(gomega.HaveOccurred())
		certPEM = string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: derBytes}))
		keyPEM = string(pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: ecBytes}))
	default:
		t.Fatalf("unknown key format: %s", keyFormat)
	}
	return certPEM, keyPEM
}

func TestDatasourceConnectionURISecretPrecedence(t *testing.T) {
	g := gomega.NewWithT(t)
	settings := &backend.DataSourceInstanceSettings{
		JSONData: []byte(`{"url": "mongodb://public-host:27017"}`),
		DecryptedSecureJSONData: map[string]string{
			"connectionUriSecret": "mongodb://secret-host:27017",
		},
	}
	cfg, err := parseDatasourceConfig(settings)
	g.Expect(err).ToNot(gomega.HaveOccurred())
	g.Expect(cfg.effectiveURI()).To(gomega.Equal("mongodb://secret-host:27017"))

	opts, err := cfg.buildClientOptions()
	g.Expect(err).ToNot(gomega.HaveOccurred())
	g.Expect(opts.Hosts).To(gomega.Equal([]string{"secret-host:27017"}))
}

func TestDatasourceDefaultPoolAndTimeout(t *testing.T) {
	g := gomega.NewWithT(t)
	cfg := datasource{
		jsonData: jsonData{
			URL: "mongodb://localhost:27017",
		},
	}
	opts, err := cfg.buildClientOptions()
	g.Expect(err).ToNot(gomega.HaveOccurred())
	g.Expect(opts.MaxPoolSize).ToNot(gomega.BeNil())
	g.Expect(*opts.MaxPoolSize).To(gomega.Equal(uint64(50)))
	g.Expect(opts.ConnectTimeout).ToNot(gomega.BeNil())
	g.Expect(*opts.ConnectTimeout).To(gomega.Equal(10 * time.Second))
}

func TestDatasourceAuthMechanisms(t *testing.T) {
	g := gomega.NewWithT(t)
	for _, mech := range []string{"SCRAM-SHA-256", "SCRAM-SHA-1", "MONGODB-X509", "MONGODB-AWS", "PLAIN"} {
		cfg := datasource{
			jsonData: jsonData{
				URL:           "mongodb://localhost:27017",
				AuthMechanism: mech,
				AuthSource:    "$external",
			},
			secureJsonData: secureJsonData{
				Username: "user",
				Password: "password",
			},
		}
		opts, err := cfg.buildClientOptions()
		g.Expect(err).ToNot(gomega.HaveOccurred())
		g.Expect(opts.Auth).ToNot(gomega.BeNil())
		g.Expect(opts.Auth.AuthMechanism).To(gomega.Equal(mech))
		g.Expect(opts.Auth.AuthSource).To(gomega.Equal("$external"))
	}

	invalidCfg := datasource{
		jsonData: jsonData{
			URL:           "mongodb://localhost:27017",
			AuthMechanism: "INVALID-MECH",
		},
	}
	_, err := invalidCfg.buildClientOptions()
	g.Expect(err).To(gomega.HaveOccurred())
	g.Expect(err.Error()).To(gomega.ContainSubstring("unsupported authentication mechanism"))
}

func TestDatasourceTLSKeyFormats(t *testing.T) {
	g := gomega.NewWithT(t)
	for _, format := range []string{"PKCS1", "PKCS8", "EC"} {
		certPEM, keyPEM := generateTestCertAndKey(t, g, format)
		cfg := datasource{
			jsonData: jsonData{
				URL:            "mongodb://localhost:27017",
				TLS:            true,
				TLSCA:          certPEM,
				TLSCertificate: certPEM,
				TLSServerName:  "mongodb.internal",
			},
			secureJsonData: secureJsonData{
				TLSCertificateKey: keyPEM,
			},
		}
		tlsCfg, err := cfg.getTLS()
		g.Expect(err).ToNot(gomega.HaveOccurred())
		g.Expect(tlsCfg).ToNot(gomega.BeNil())
		g.Expect(tlsCfg.Certificates).To(gomega.HaveLen(1))
		g.Expect(tlsCfg.ServerName).To(gomega.Equal("mongodb.internal"))
		g.Expect(tlsCfg.RootCAs).ToNot(gomega.BeNil())
	}
}

func TestDatasourceConnectionPoolingAndDispose(t *testing.T) {
	g := gomega.NewWithT(t)
	instance, err := NewMongoDBDatasource(
		context.Background(),
		backend.DataSourceInstanceSettings{
			JSONData: []byte(`{"url": "mongodb://127.0.0.1:27017", "connectTimeoutSeconds": 5, "maxPoolSize": 20}`),
		},
	)
	g.Expect(err).ToNot(gomega.HaveOccurred())
	ds := instance.(*MongoDBDatasource)

	client1, _, err := ds.getClient(context.Background(), nil)
	g.Expect(err).ToNot(gomega.HaveOccurred())
	g.Expect(client1).ToNot(gomega.BeNil())

	client2, _, err := ds.getClient(context.Background(), nil)
	g.Expect(err).ToNot(gomega.HaveOccurred())
	g.Expect(client2).To(gomega.BeIdenticalTo(client1))

	ds.Dispose()
}

func TestPipelineRejectsWriteStages(t *testing.T) {
	g := gomega.NewWithT(t)
	now := time.Now()
	for _, stage := range []string{`[{"$out": "pwned"}]`, `[{"$merge": {"into": "pwned"}}]`} {
		qm := QueryModel{
			QueryType:   queryTypeTable,
			Aggregation: stage,
		}
		_, err := qm.getPipeline(now.Add(-time.Hour), now)
		g.Expect(err).To(gomega.HaveOccurred())
		g.Expect(err.Error()).To(gomega.ContainSubstring("not permitted in read-only Grafana queries"))
	}
}
