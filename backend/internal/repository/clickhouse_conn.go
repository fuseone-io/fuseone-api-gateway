package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

// ClickHouseConn wraps a clickhouse driver.Conn.
type ClickHouseConn = driver.Conn

// NewClickHouseConn creates a new ClickHouse connection.
func NewClickHouseConn(addr, database, user, password string) (ClickHouseConn, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{addr},
		Auth: clickhouse.Auth{
			Database: database,
			Username: user,
			Password: password,
		},
		DialTimeout:     5 * time.Second,
		MaxOpenConns:    10,
		MaxIdleConns:    5,
		ConnMaxLifetime: 10 * time.Minute,
	})
	if err != nil {
		return nil, fmt.Errorf("open clickhouse: %w", err)
	}
	return conn, nil
}

// TestClickHouseConnection tests a ClickHouse connection and returns an error if it fails.
func TestClickHouseConnection(ctx context.Context, addr, database, user, password string) error {
	conn, err := NewClickHouseConn(addr, database, user, password)
	if err != nil {
		return err
	}
	defer conn.Close()

	ctx2, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	return conn.Ping(ctx2)
}
