package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	APISIX   APISIXConfig   `mapstructure:"apisix"`
	Auth     AuthConfig     `mapstructure:"auth"`
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
	AdminURL string `mapstructure:"admin_url"`
	APIKey   string `mapstructure:"api_key"`
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
	v.SetDefault("server.cors_origins", []string{"http://localhost:3000"})

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

	// Auth defaults
	v.SetDefault("auth.jwt_secret", "")
	v.SetDefault("auth.jwt_expiry_minutes", 60)
	v.SetDefault("auth.refresh_expiry_days", 30)

	// Bind environment variables explicitly
	v.BindEnv("database.host", "DB_HOST")
	v.BindEnv("database.port", "DB_PORT")
	v.BindEnv("database.name", "DB_NAME")
	v.BindEnv("database.user", "DB_USER")
	v.BindEnv("database.password", "DB_PASSWORD")
	v.BindEnv("database.sslmode", "DB_SSLMODE")
	v.BindEnv("apisix.admin_url", "APISIX_ADMIN_URL")
	v.BindEnv("apisix.api_key", "APISIX_API_KEY")
	v.BindEnv("auth.jwt_secret", "JWT_SECRET")
	v.BindEnv("auth.jwt_expiry_minutes", "JWT_EXPIRY_MINUTES")
	v.BindEnv("auth.refresh_expiry_days", "REFRESH_EXPIRY_DAYS")
	v.BindEnv("server.port", "SERVER_PORT")
	v.BindEnv("server.cors_origins", "SERVER_CORS_ORIGINS")

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

	return &cfg, nil
}
