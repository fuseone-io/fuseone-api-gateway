package model

import "time"

// MetricsRow represents a single row in any of the metrics_1m/1h/1d tables.
type MetricsRow struct {
	ID               int64     `json:"id"`
	Ts               time.Time `json:"ts"`
	RouteID          string    `json:"route_id"`
	RouteName        string    `json:"route_name"`
	RequestsTotal    int       `json:"requests_total"`
	Status2xx        int       `json:"status_2xx"`
	Status3xx        int       `json:"status_3xx"`
	Status4xx        int       `json:"status_4xx"`
	Status5xx        int       `json:"status_5xx"`
	LatencySum       float64   `json:"latency_sum"`
	LatencyCount     int       `json:"latency_count"`
	LatencyP50       float64   `json:"latency_p50"`
	LatencyP95       float64   `json:"latency_p95"`
	LatencyP99       float64   `json:"latency_p99"`
	BandwidthIngress int64     `json:"bandwidth_ingress"`
	BandwidthEgress  int64     `json:"bandwidth_egress"`
}

// TimeSeriesPoint is a single data point for chart display.
type TimeSeriesPoint struct {
	Ts               time.Time `json:"ts"`
	RequestsTotal    int       `json:"requests_total"`
	Status2xx        int       `json:"status_2xx"`
	Status3xx        int       `json:"status_3xx"`
	Status4xx        int       `json:"status_4xx"`
	Status5xx        int       `json:"status_5xx"`
	LatencyP50       float64   `json:"latency_p50"`
	LatencyP95       float64   `json:"latency_p95"`
	LatencyP99       float64   `json:"latency_p99"`
	BandwidthIngress int64     `json:"bandwidth_ingress"`
	BandwidthEgress  int64     `json:"bandwidth_egress"`
}

// MetricsSummary provides aggregate stats across all routes for a time range.
type MetricsSummary struct {
	TotalRequests      int64   `json:"total_requests"`
	AvgLatencyMs       float64 `json:"avg_latency_ms"`
	ErrorRate          float64 `json:"error_rate"`
	TotalBandwidthIn   int64   `json:"total_bandwidth_ingress"`
	TotalBandwidthOut  int64   `json:"total_bandwidth_egress"`
	Status2xx          int64   `json:"status_2xx"`
	Status3xx          int64   `json:"status_3xx"`
	Status4xx          int64   `json:"status_4xx"`
	Status5xx          int64   `json:"status_5xx"`
}

// TopRoute represents a route ranked by traffic volume.
type TopRoute struct {
	RouteID          string  `json:"route_id"`
	RouteName        string  `json:"route_name"`
	RequestsTotal    int64   `json:"requests_total"`
	AvgLatencyMs     float64 `json:"avg_latency_ms"`
	ErrorRate        float64 `json:"error_rate"`
	BandwidthIngress int64   `json:"bandwidth_ingress"`
	BandwidthEgress  int64   `json:"bandwidth_egress"`
}
