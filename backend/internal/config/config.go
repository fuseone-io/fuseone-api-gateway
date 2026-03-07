package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server        ServerConfig        `mapstructure:"server"`
	Database      DatabaseConfig      `mapstructure:"database"`
	APISIX        APISIXConfig        `mapstructure:"apisix"`
	Auth          AuthConfig          `mapstructure:"auth"`
	Secrets       SecretsConfig       `mapstructure:"secrets"`
	Metrics       MetricsConfig       `mapstructure:"metrics"`
	Debug         DebugConfig         `mapstructure:"debug"`
	Alerts        AlertConfig         `mapstructure:"alerts"`
	Testing       TestingConfig       `mapstructure:"testing"`
	Kafka         KafkaConfig         `mapstructure:"kafka"`
	Tracing       TracingConfig       `mapstructure:"tracing"`
	ClickHouse    ClickHouseConfig    `mapstructure:"clickhouse"`
	Elasticsearch ElasticsearchConfig `mapstructure:"elasticsearch"`
	Prometheus    PrometheusConfig    `mapstructure:"prometheus"`
}

type ClickHouseConfig struct {
	Addr     string `mapstructure:"addr"`
	Database string `mapstructure:"database"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
}

type ElasticsearchConfig struct {
	Addresses   []string `mapstructure:"addresses"`
	Username    string   `mapstructure:"username"`
	Password    string   `mapstructure:"password"`
	IndexPrefix string   `mapstructure:"index_prefix"`
	APIKey      string   `mapstructure:"api_key"`
}

type PrometheusConfig struct {
	URL      string `mapstructure:"url"`
	Username string `mapstructure:"username"`
	Password string `mapstructure:"password"`
}

type TracingConfig struct {
	Enabled          bool    `mapstructure:"enabled"`
	SampleRate       float64 `mapstructure:"sample_rate"`
	RetentionDays    int     `mapstructure:"retention_days"`
	BufferSize       int     `mapstructure:"buffer_size"`
	FlushIntervalSec int     `mapstructure:"flush_interval_sec"`
	CollectorAddress string  `mapstructure:"collector_address"` // OTLP collector address for APISIX (host:port)
}

type KafkaConfig struct {
	Enabled         bool   `mapstructure:"enabled"`
	EventGatewayURL string `mapstructure:"event_gateway_url"` // e.g. http://event-gateway:8090
}

type TestingConfig struct {
	SyntheticEnabled     bool `mapstructure:"synthetic_enabled"`
	SyntheticIntervalSec int  `mapstructure:"synthetic_interval_sec"`
	SLAEnabled           bool `mapstructure:"sla_enabled"`
	SLAIntervalSec       int  `mapstructure:"sla_interval_sec"`
	RunRetentionDays     int  `mapstructure:"run_retention_days"`
}

type AlertConfig struct {
	Enabled         bool `mapstructure:"enabled"`
	EvalIntervalSec int  `mapstructure:"eval_interval_sec"`
}

type MetricsConfig struct {
	Enabled           bool   `mapstructure:"enabled"`
	ScrapeURL         string `mapstructure:"scrape_url"`
	ScrapeIntervalSec int    `mapstructure:"scrape_interval_sec"`
	FlushIntervalSec  int    `mapstructure:"flush_interval_sec"`
	TTL1mDays         int    `mapstructure:"ttl_1m_days"`
	TTL1hDays         int    `mapstructure:"ttl_1h_days"`
}

type DebugConfig struct {
	Enabled     bool   `mapstructure:"enabled"`
	CallbackURL string `mapstructure:"callback_url"`
	RetentionH  int    `mapstructure:"retention_hours"`
	MaxRows     int    `mapstructure:"max_rows"` // hard cap; oldest rows are deleted when exceeded (0 = unlimited)
}

type SecretsConfig struct {
	EncryptionKey string `mapstructure:"encryption_key"`
}

type ServerConfig struct {
	Port        int      `mapstructure:"port"`
	CORSOrigins []string `mapstructure:"cors_origins"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Name     string `mapstructure:"name"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	SSLMode  string `mapstructure:"sslmode"`
	MaxConns int32  `mapstructure:"max_conns"`
	MinConns int32  `mapstructure:"min_conns"`
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode)
}

type APISIXConfig struct {
	AdminURL   string `mapstructure:"admin_url"`
	APIKey     string `mapstructure:"api_key"`
	ControlURL string `mapstructure:"control_url"`
}

type AuthConfig struct {
	JWTSecret         string `mapstructure:"jwt_secret"`
	JWTExpiryMinutes  int    `mapstructure:"jwt_expiry_minutes"`
	RefreshExpiryDays int    `mapstructure:"refresh_expiry_days"`
}

func Load() (*Config, error) {
	v := viper.New()

	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("/etc/fuseone-gateway/")

	v.SetEnvPrefix("")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// Server defaults
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.cors_origins", []string{"http://localhost:3000", "http://localhost:3001"})

	// Database defaults
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.name", "fuseone_gateway")
	v.SetDefault("database.user", "gateway")
	v.SetDefault("database.password", "gateway")
	v.SetDefault("database.sslmode", "disable")
	v.SetDefault("database.max_conns", 10)
	v.SetDefault("database.min_conns", 2)

	// APISIX defaults
	v.SetDefault("apisix.admin_url", "http://localhost:9180")
	v.SetDefault("apisix.api_key", "")
	v.SetDefault("apisix.control_url", "http://localhost:9090")

	// Auth defaults
	v.SetDefault("auth.jwt_secret", "")
	v.SetDefault("auth.jwt_expiry_minutes", 60)
	v.SetDefault("auth.refresh_expiry_days", 30)

	// Secrets defaults
	v.SetDefault("secrets.encryption_key", "")

	// Metrics defaults
	v.SetDefault("metrics.enabled", true)
	v.SetDefault("metrics.scrape_url", "http://localhost:9091/apisix/prometheus/metrics")
	v.SetDefault("metrics.scrape_interval_sec", 15)
	v.SetDefault("metrics.flush_interval_sec", 60)
	v.SetDefault("metrics.ttl_1m_days", 7)
	v.SetDefault("metrics.ttl_1h_days", 90)

	// Debug defaults
	v.SetDefault("debug.enabled", true)
	v.SetDefault("debug.callback_url", "http://host.docker.internal:8080/internal/debug-logs")
	v.SetDefault("debug.retention_hours", 48)
	v.SetDefault("debug.max_rows", 50000)

	// Alerts defaults
	v.SetDefault("alerts.enabled", true)
	v.SetDefault("alerts.eval_interval_sec", 60)

	// Testing defaults
	v.SetDefault("testing.synthetic_enabled", true)
	v.SetDefault("testing.synthetic_interval_sec", 60)
	v.SetDefault("testing.sla_enabled", true)
	v.SetDefault("testing.sla_interval_sec", 300)

	// Bind environment variables explicitly
	v.BindEnv("database.host", "DB_HOST")
	v.BindEnv("database.port", "DB_PORT")
	v.BindEnv("database.name", "DB_NAME")
	v.BindEnv("database.user", "DB_USER")
	v.BindEnv("database.password", "DB_PASSWORD")
	v.BindEnv("database.sslmode", "DB_SSLMODE")
	v.BindEnv("apisix.admin_url", "APISIX_ADMIN_URL")
	v.BindEnv("apisix.api_key", "APISIX_API_KEY")
	v.BindEnv("apisix.control_url", "APISIX_CONTROL_URL")
	v.BindEnv("auth.jwt_secret", "JWT_SECRET")
	v.BindEnv("auth.jwt_expiry_minutes", "JWT_EXPIRY_MINUTES")
	v.BindEnv("auth.refresh_expiry_days", "REFRESH_EXPIRY_DAYS")
	v.BindEnv("server.port", "SERVER_PORT")
	v.BindEnv("server.cors_origins", "SERVER_CORS_ORIGINS")
	v.BindEnv("secrets.encryption_key", "SECRET_ENCRYPTION_KEY")
	v.BindEnv("metrics.enabled", "METRICS_ENABLED")
	v.BindEnv("metrics.scrape_url", "METRICS_SCRAPE_URL")
	v.BindEnv("metrics.scrape_interval_sec", "METRICS_SCRAPE_INTERVAL_SEC")
	v.BindEnv("metrics.flush_interval_sec", "METRICS_FLUSH_INTERVAL_SEC")
	v.BindEnv("metrics.ttl_1m_days", "METRICS_TTL_1M_DAYS")
	v.BindEnv("metrics.ttl_1h_days", "METRICS_TTL_1H_DAYS")
	v.BindEnv("debug.enabled", "DEBUG_ENABLED")
	v.BindEnv("debug.callback_url", "DEBUG_CALLBACK_URL")
	v.BindEnv("debug.retention_hours", "DEBUG_RETENTION_HOURS")
	v.BindEnv("debug.max_rows", "DEBUG_MAX_ROWS")
	v.BindEnv("alerts.enabled", "ALERTS_ENABLED")
	v.BindEnv("alerts.eval_interval_sec", "ALERTS_EVAL_INTERVAL_SEC")
	v.BindEnv("testing.synthetic_enabled", "TESTING_SYNTHETIC_ENABLED")
	v.BindEnv("testing.synthetic_interval_sec", "TESTING_SYNTHETIC_INTERVAL_SEC")
	v.BindEnv("testing.sla_enabled", "TESTING_SLA_ENABLED")
	v.BindEnv("testing.sla_interval_sec", "TESTING_SLA_INTERVAL_SEC")

	// Tracing defaults
	v.SetDefault("tracing.enabled", true)
	v.SetDefault("tracing.sample_rate", 1.0)
	v.SetDefault("tracing.retention_days", 7)
	v.SetDefault("tracing.buffer_size", 1000)
	v.SetDefault("tracing.flush_interval_sec", 5)
	v.SetDefault("tracing.collector_address", "host.docker.internal:8080")
	v.BindEnv("tracing.enabled", "TRACING_ENABLED")
	v.BindEnv("tracing.sample_rate", "TRACING_SAMPLE_RATE")
	v.BindEnv("tracing.retention_days", "TRACING_RETENTION_DAYS")
	v.BindEnv("tracing.buffer_size", "TRACING_BUFFER_SIZE")
	v.BindEnv("tracing.flush_interval_sec", "TRACING_FLUSH_INTERVAL_SEC")
	v.BindEnv("tracing.collector_address", "TRACING_COLLECTOR_ADDRESS")

	// Kafka defaults
	v.SetDefault("kafka.enabled", false)
	v.SetDefault("kafka.event_gateway_url", "http://event-gateway:8090")
	v.BindEnv("kafka.enabled", "KAFKA_ENABLED")

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("reading config: %w", err)
		}
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshaling config: %w", err)
	}

	if cfg.Auth.JWTSecret == "" {
		return nil, fmt.Errorf("auth.jwt_secret (JWT_SECRET) is required")
	}

	// Default encryption key to JWT secret if not set
	if cfg.Secrets.EncryptionKey == "" {
		cfg.Secrets.EncryptionKey = cfg.Auth.JWTSecret
	}

	return &cfg, nil
}
