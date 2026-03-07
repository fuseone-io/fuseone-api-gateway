package config

import (
	"fmt"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Kafka    StreamDefaults `mapstructure:"kafka"` // key kept as "kafka" for backward compat with existing config files
}

type ServerConfig struct {
	Port        int `mapstructure:"port"`
	IdleTimeout int `mapstructure:"idle_timeout"`
	ShutdownSec int `mapstructure:"shutdown_sec"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	Name     string `mapstructure:"name"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	SSLMode  string `mapstructure:"sslmode"`
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		d.User, d.Password, d.Host, d.Port, d.Name, d.SSLMode)
}

type StreamDefaults struct {
	MaxPollRecords   int `mapstructure:"max_poll_records"`
	SessionTimeoutMs int `mapstructure:"session_timeout_ms"`
	HeartbeatMs      int `mapstructure:"heartbeat_ms"`
	MaxMessageBytes  int `mapstructure:"max_message_bytes"`
	SSEKeepAliveMs   int `mapstructure:"sse_keepalive_ms"`
}

func Load() (*Config, error) {
	v := viper.New()
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("/etc/event-gateway")

	// Defaults
	v.SetDefault("server.port", 8090)
	v.SetDefault("server.idle_timeout", 120)
	v.SetDefault("server.shutdown_sec", 30)
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.name", "fuseone_gateway")
	v.SetDefault("database.user", "gateway")
	v.SetDefault("database.password", "gateway")
	v.SetDefault("database.sslmode", "disable")
	v.SetDefault("kafka.max_poll_records", 100)
	v.SetDefault("kafka.session_timeout_ms", 30000)
	v.SetDefault("kafka.heartbeat_ms", 3000)
	v.SetDefault("kafka.max_message_bytes", 1048576)
	v.SetDefault("kafka.sse_keepalive_ms", 15000)

	// Environment variable overrides
	v.SetEnvPrefix("")
	v.AutomaticEnv()
	// Map env vars to config keys
	_ = v.BindEnv("server.port", "SERVER_PORT")
	_ = v.BindEnv("database.host", "DB_HOST")
	_ = v.BindEnv("database.port", "DB_PORT")
	_ = v.BindEnv("database.name", "DB_NAME")
	_ = v.BindEnv("database.user", "DB_USER")
	_ = v.BindEnv("database.password", "DB_PASSWORD")
	_ = v.BindEnv("database.sslmode", "DB_SSLMODE")

	// Read config file (optional)
	_ = v.ReadInConfig()

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}
	return &cfg, nil
}
