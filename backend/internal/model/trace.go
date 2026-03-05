package model

import "time"

// TraceSpan represents a single span within a request trace.
type TraceSpan struct {
	SpanID       string            `json:"span_id"`
	ParentSpanID string            `json:"parent_span_id,omitempty"`
	Name         string            `json:"name"`
	Kind         string            `json:"kind"` // "client", "server", "internal"
	StartTimeNs  int64            `json:"start_time_ns"`
	EndTimeNs    int64            `json:"end_time_ns"`
	DurationNs   int64            `json:"duration_ns"`
	StatusCode   string            `json:"status_code,omitempty"` // "OK", "ERROR", "UNSET"
	Attributes   map[string]string `json:"attributes,omitempty"`
}

// RequestTrace represents a complete trace for a single API request.
type RequestTrace struct {
	ID          int64              `json:"id"`
	TraceID     string             `json:"trace_id"`
	RootSpanID  string             `json:"root_span_id"`
	ServiceName string             `json:"service_name"`
	RouteID     string             `json:"route_id"`
	RouteName   string             `json:"route_name"`
	Method      string             `json:"method"`
	URI         string             `json:"uri"`
	StatusCode  int                `json:"status_code"`
	DurationNs  int64              `json:"duration_ns"`
	Spans       []TraceSpan        `json:"spans"`
	Attributes  map[string]any     `json:"attributes,omitempty"`
	CreatedAt   time.Time          `json:"created_at"`
}

// TraceListParams holds query filters for listing traces.
type TraceListParams struct {
	RouteID       string    `form:"route_id"`
	RouteIDs      []string  `form:"-"` // set programmatically (e.g. from api_id lookup)
	ApiID         string    `form:"api_id"`
	Method        string    `form:"method"`
	StatusMin     int       `form:"status_min"`
	StatusMax     int       `form:"status_max"`
	MinDurationMs int64     `form:"min_duration_ms"`
	MaxDurationMs int64     `form:"max_duration_ms"`
	Search        string    `form:"search"`
	From          time.Time `form:"from" time_format:"2006-01-02T15:04:05Z07:00"`
	To            time.Time `form:"to" time_format:"2006-01-02T15:04:05Z07:00"`
	Limit         int       `form:"limit"`
	Offset        int       `form:"offset"`
}
