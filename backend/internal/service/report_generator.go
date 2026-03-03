package service

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"time"

	"github.com/fuseone/api-gateway/internal/repository"
)

// ReportGenerator produces CSV reports from metrics data.
type ReportGenerator struct {
	metricsRepo repository.MetricsQuerier
}

func NewReportGenerator(metricsRepo repository.MetricsQuerier) *ReportGenerator {
	return &ReportGenerator{metricsRepo: metricsRepo}
}

// GenerateUsageCSV writes a CSV of per-route usage data.
func (g *ReportGenerator) GenerateUsageCSV(ctx context.Context, filter repository.MetricsFilter, limit int, w io.Writer) error {
	if limit <= 0 {
		limit = 100
	}

	routes, err := g.metricsRepo.TopRoutes(ctx, filter, limit)
	if err != nil {
		return fmt.Errorf("top routes: %w", err)
	}

	cw := csv.NewWriter(w)
	defer cw.Flush()

	// Header
	if err := cw.Write([]string{
		"Route ID", "Route Name", "Requests", "Avg Latency (ms)",
		"Error Rate", "Bandwidth In (bytes)", "Bandwidth Out (bytes)",
	}); err != nil {
		return err
	}

	for _, r := range routes {
		if err := cw.Write([]string{
			r.RouteID,
			r.RouteName,
			fmt.Sprintf("%d", r.RequestsTotal),
			fmt.Sprintf("%.2f", r.AvgLatencyMs),
			fmt.Sprintf("%.4f", r.ErrorRate),
			fmt.Sprintf("%d", r.BandwidthIngress),
			fmt.Sprintf("%d", r.BandwidthEgress),
		}); err != nil {
			return err
		}
	}

	return nil
}

// GenerateConsumerCSV writes a CSV of per-consumer usage data.
func (g *ReportGenerator) GenerateConsumerCSV(ctx context.Context, filter repository.MetricsFilter, limit int, w io.Writer) error {
	if limit <= 0 {
		limit = 100
	}

	consumers, err := g.metricsRepo.TopConsumers(ctx, filter, limit)
	if err != nil {
		return fmt.Errorf("top consumers: %w", err)
	}

	cw := csv.NewWriter(w)
	defer cw.Flush()

	// Header
	if err := cw.Write([]string{
		"Consumer Name", "Requests", "Avg Latency (ms)",
		"Error Rate", "Bandwidth In (bytes)", "Bandwidth Out (bytes)",
	}); err != nil {
		return err
	}

	for _, c := range consumers {
		if err := cw.Write([]string{
			c.ConsumerName,
			fmt.Sprintf("%d", c.RequestsTotal),
			fmt.Sprintf("%.2f", c.AvgLatencyMs),
			fmt.Sprintf("%.4f", c.ErrorRate),
			fmt.Sprintf("%d", c.BandwidthIngress),
			fmt.Sprintf("%d", c.BandwidthEgress),
		}); err != nil {
			return err
		}
	}

	return nil
}

// GenerateTimeSeriesCSV writes a CSV of time-series data.
func (g *ReportGenerator) GenerateTimeSeriesCSV(ctx context.Context, filter repository.MetricsFilter, w io.Writer) error {
	series, err := g.metricsRepo.TimeSeries(ctx, filter)
	if err != nil {
		return fmt.Errorf("time series: %w", err)
	}

	cw := csv.NewWriter(w)
	defer cw.Flush()

	if err := cw.Write([]string{
		"Timestamp", "Requests", "2xx", "3xx", "4xx", "5xx",
		"Latency p50 (ms)", "Latency p95 (ms)", "Latency p99 (ms)",
		"Bandwidth In", "Bandwidth Out",
	}); err != nil {
		return err
	}

	for _, p := range series {
		if err := cw.Write([]string{
			p.Ts.Format(time.RFC3339),
			fmt.Sprintf("%d", p.RequestsTotal),
			fmt.Sprintf("%d", p.Status2xx),
			fmt.Sprintf("%d", p.Status3xx),
			fmt.Sprintf("%d", p.Status4xx),
			fmt.Sprintf("%d", p.Status5xx),
			fmt.Sprintf("%.2f", p.LatencyP50),
			fmt.Sprintf("%.2f", p.LatencyP95),
			fmt.Sprintf("%.2f", p.LatencyP99),
			fmt.Sprintf("%d", p.BandwidthIngress),
			fmt.Sprintf("%d", p.BandwidthEgress),
		}); err != nil {
			return err
		}
	}

	return nil
}
