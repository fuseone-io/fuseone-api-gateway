package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

type PGListener struct {
	pool   *pgxpool.Pool
	logger *zap.Logger
}

func NewPGListener(pool *pgxpool.Pool, logger *zap.Logger) *PGListener {
	return &PGListener{pool: pool, logger: logger}
}

// Listen subscribes to a PostgreSQL NOTIFY channel and calls handler for each notification.
func (l *PGListener) Listen(ctx context.Context, channel string, handler func(payload string)) {
	for {
		if ctx.Err() != nil {
			return
		}

		conn, err := l.pool.Acquire(ctx)
		if err != nil {
			l.logger.Error("pg listener: acquire connection", zap.Error(err))
			select {
			case <-ctx.Done():
				return
			case <-time.After(5 * time.Second):
				continue
			}
		}

		_, err = conn.Exec(ctx, "LISTEN "+channel)
		if err != nil {
			l.logger.Error("pg listener: LISTEN", zap.Error(err))
			conn.Release()
			select {
			case <-ctx.Done():
				return
			case <-time.After(5 * time.Second):
				continue
			}
		}

		l.logger.Info("pg listener: subscribed", zap.String("channel", channel))

		for {
			notification, err := conn.Conn().WaitForNotification(ctx)
			if err != nil {
				if ctx.Err() != nil {
					conn.Release()
					return
				}
				l.logger.Warn("pg listener: wait error, reconnecting", zap.Error(err))
				conn.Release()
				break
			}
			handler(notification.Payload)
		}
	}
}
