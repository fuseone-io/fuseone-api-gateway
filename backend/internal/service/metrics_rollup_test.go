package service

import (
	"context"
	"testing"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
)

func TestMetricsRollup_StartStop(t *testing.T) {
	cfg := &config.MetricsConfig{TTL1mDays: 7, TTL1hDays: 90}
	rollup := NewMetricsRollup(&noopMetricsQuerier{}, cfg, zap.NewNop())

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		rollup.Start(ctx)
		close(done)
	}()

	// Give it a moment to start, then cancel
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case <-done:
		// OK — graceful shutdown
	case <-time.After(2 * time.Second):
		t.Fatal("rollup did not stop within timeout")
	}
}
