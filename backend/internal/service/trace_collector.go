package service

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"io"
	"math/rand"
	"strconv"
	"sync"
	"time"

	"go.uber.org/zap"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	collectorpb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"

	"github.com/fuseone/api-gateway/internal/config"
	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

// TraceCollector receives OTLP trace data, buffers it, and flushes to the database in batches.
type TraceCollector struct {
	cfg    *config.TracingConfig
	repo   repository.TraceQuerier
	logger *zap.Logger

	buffer chan model.RequestTrace
	mu     sync.Mutex
}

func NewTraceCollector(cfg *config.TracingConfig, repo repository.TraceQuerier, logger *zap.Logger) *TraceCollector {
	bufSize := cfg.BufferSize
	if bufSize <= 0 {
		bufSize = 1000
	}
	return &TraceCollector{
		cfg:    cfg,
		repo:   repo,
		logger: logger,
		buffer: make(chan model.RequestTrace, bufSize),
	}
}

// Start runs the background flush loop.
func (tc *TraceCollector) Start(ctx context.Context) {
	interval := time.Duration(tc.cfg.FlushIntervalSec) * time.Second
	if interval <= 0 {
		interval = 5 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	tc.logger.Info("trace collector started",
		zap.Float64("sample_rate", tc.cfg.SampleRate),
		zap.Int("buffer_size", tc.cfg.BufferSize),
		zap.Duration("flush_interval", interval),
	)

	for {
		select {
		case <-ctx.Done():
			tc.flush(context.Background()) // final flush
			tc.logger.Info("trace collector stopped")
			return
		case <-ticker.C:
			tc.flush(ctx)
		}
	}
}

// ProcessOTLP parses an OTLP protobuf body and queues traces for storage.
func (tc *TraceCollector) ProcessOTLP(body io.Reader) (int, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return 0, err
	}

	var req collectorpb.ExportTraceServiceRequest
	if err := proto.Unmarshal(data, &req); err != nil {
		return 0, err
	}

	return tc.processOTLPRequest(&req)
}

// processOTLPRequest processes a parsed OTLP request (shared by protobuf and JSON paths).
func (tc *TraceCollector) processOTLPRequest(req *collectorpb.ExportTraceServiceRequest) (int, error) {
	count := 0
	for _, rs := range req.ResourceSpans {
		serviceName := extractServiceName(rs)

		for _, ss := range rs.ScopeSpans {
			traces := tc.groupSpans(ss.Spans, serviceName)
			for _, trace := range traces {
				// Sampling
				if tc.cfg.SampleRate < 1.0 && rand.Float64() > tc.cfg.SampleRate {
					continue
				}

				// Enrich single-span traces with synthetic child spans
				// derived from nginx timing attributes (upstream_response_time, etc.)
				enrichTraceSpans(&trace)

				select {
				case tc.buffer <- trace:
					count++
				default:
					tc.logger.Warn("trace buffer full, dropping trace", zap.String("trace_id", trace.TraceID))
				}
			}
		}
	}

	return count, nil
}

// ProcessJSON parses a JSON trace body. Supports both OTLP JSON format
// (resourceSpans) and plain model format (for direct API calls).
func (tc *TraceCollector) ProcessJSON(body io.Reader) (int, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return 0, err
	}

	// Try OTLP JSON format first (resourceSpans)
	var req collectorpb.ExportTraceServiceRequest
	if err := protojson.Unmarshal(data, &req); err == nil && len(req.ResourceSpans) > 0 {
		return tc.processOTLPRequest(&req)
	}

	// Fallback: plain model format
	var traces []model.RequestTrace
	if err := json.Unmarshal(data, &traces); err != nil {
		var single model.RequestTrace
		if err := json.Unmarshal(data, &single); err != nil {
			return 0, err
		}
		traces = []model.RequestTrace{single}
	}

	count := 0
	for _, trace := range traces {
		if tc.cfg.SampleRate < 1.0 && rand.Float64() > tc.cfg.SampleRate {
			continue
		}
		if trace.CreatedAt.IsZero() {
			trace.CreatedAt = time.Now()
		}
		select {
		case tc.buffer <- trace:
			count++
		default:
			tc.logger.Warn("trace buffer full, dropping trace")
		}
	}

	return count, nil
}

func (tc *TraceCollector) flush(ctx context.Context) {
	tc.mu.Lock()
	defer tc.mu.Unlock()

	traces := make([]model.RequestTrace, 0, len(tc.buffer))
	for {
		select {
		case t := <-tc.buffer:
			traces = append(traces, t)
		default:
			goto done
		}
	}
done:

	if len(traces) == 0 {
		return
	}

	if err := tc.repo.InsertBatch(ctx, traces); err != nil {
		tc.logger.Error("failed to flush traces", zap.Error(err), zap.Int("count", len(traces)))
		return
	}

	tc.logger.Debug("flushed traces", zap.Int("count", len(traces)))
}

// groupSpans converts OTLP spans into RequestTrace models, grouped by trace_id.
func (tc *TraceCollector) groupSpans(spans []*tracepb.Span, serviceName string) []model.RequestTrace {
	byTrace := make(map[string]*model.RequestTrace)

	for _, span := range spans {
		traceID := hex.EncodeToString(span.TraceId)
		spanID := hex.EncodeToString(span.SpanId)
		parentSpanID := hex.EncodeToString(span.ParentSpanId)
		if parentSpanID == "0000000000000000" {
			parentSpanID = ""
		}

		startNs := int64(span.StartTimeUnixNano)
		endNs := int64(span.EndTimeUnixNano)
		durationNs := endNs - startNs

		attrs := extractAttributes(span.Attributes)

		kind := "internal"
		switch span.Kind {
		case tracepb.Span_SPAN_KIND_SERVER:
			kind = "server"
		case tracepb.Span_SPAN_KIND_CLIENT:
			kind = "client"
		}

		statusCode := "UNSET"
		if span.Status != nil {
			switch span.Status.Code {
			case tracepb.Status_STATUS_CODE_OK:
				statusCode = "OK"
			case tracepb.Status_STATUS_CODE_ERROR:
				statusCode = "ERROR"
			}
		}

		traceSpan := model.TraceSpan{
			SpanID:       spanID,
			ParentSpanID: parentSpanID,
			Name:         span.Name,
			Kind:         kind,
			StartTimeNs:  startNs,
			EndTimeNs:    endNs,
			DurationNs:   durationNs,
			StatusCode:   statusCode,
			Attributes:   attrs,
		}

		rt, exists := byTrace[traceID]
		if !exists {
			rt = &model.RequestTrace{
				TraceID:     traceID,
				ServiceName: serviceName,
				Spans:       []model.TraceSpan{},
				CreatedAt:   time.Unix(0, startNs),
			}
			byTrace[traceID] = rt
		}

		rt.Spans = append(rt.Spans, traceSpan)

		// Root span: no parent → extract request metadata
		if parentSpanID == "" {
			rt.RootSpanID = spanID
			rt.DurationNs = durationNs
			if v, ok := attrs["http.method"]; ok {
				rt.Method = v
			}
			if v, ok := attrs["http.url"]; ok {
				rt.URI = v
			} else if v, ok := attrs["http.target"]; ok {
				rt.URI = v
			}
			if v, ok := attrs["http.status_code"]; ok {
				if code, err := strconv.Atoi(v); err == nil {
					rt.StatusCode = code
				}
			}
			if v, ok := attrs["apisix.route_id"]; ok {
				rt.RouteID = v
			} else if v, ok := attrs["apisix_route_id"]; ok {
				rt.RouteID = v
			}
			if v, ok := attrs["apisix.route_name"]; ok {
				rt.RouteName = v
			}
		}
	}

	result := make([]model.RequestTrace, 0, len(byTrace))
	for _, rt := range byTrace {
		result = append(result, *rt)
	}
	return result
}

// enrichTraceSpans decomposes a single-span trace into synthetic child spans
// using nginx timing variables that APISIX sends as span attributes.
// This creates a meaningful waterfall (gateway vs upstream breakdown) without
// any custom APISIX plugin — zero overhead on the gateway.
func enrichTraceSpans(trace *model.RequestTrace) {
	if len(trace.Spans) != 1 || trace.RootSpanID == "" {
		return // only enrich single-span traces
	}

	root := &trace.Spans[0]
	attrs := root.Attributes
	if attrs == nil {
		return
	}

	upstreamResponseSec := parseSeconds(attrs["upstream_response_time"])
	upstreamConnectSec := parseSeconds(attrs["upstream_connect_time"])
	upstreamHeaderSec := parseSeconds(attrs["upstream_header_time"])
	upstreamAddr := attrs["upstream_addr"]
	upstreamStatus := attrs["upstream_status"]

	if upstreamResponseSec <= 0 {
		return // no upstream timing data
	}

	totalNs := root.DurationNs
	upstreamResponseNs := int64(upstreamResponseSec * 1e9)
	upstreamConnectNs := int64(upstreamConnectSec * 1e9)
	upstreamHeaderNs := int64(upstreamHeaderSec * 1e9)

	// Clamp upstream to not exceed total
	if upstreamResponseNs > totalNs {
		upstreamResponseNs = totalNs
	}

	gatewayNs := totalNs - upstreamResponseNs

	// Timeline: |-- gateway pre --|-- upstream connect --|-- upstream TTFB --|-- upstream transfer --|
	gatewayEnd := root.StartTimeNs + gatewayNs
	upstreamStart := gatewayEnd
	upstreamEnd := upstreamStart + upstreamResponseNs

	// Build upstream metadata for child spans
	upstreamAttrs := map[string]string{"synthetic": "true"}
	if upstreamAddr != "" {
		upstreamAttrs["upstream_addr"] = upstreamAddr
	}
	if upstreamStatus != "" {
		upstreamAttrs["upstream_status"] = upstreamStatus
	}

	childSpans := []model.TraceSpan{}

	// 1. Gateway Processing (auth, rate limiting, proxy-rewrite, etc.)
	if gatewayNs > 0 {
		childSpans = append(childSpans, model.TraceSpan{
			SpanID:       root.SpanID + "01",
			ParentSpanID: root.SpanID,
			Name:         "Gateway Processing",
			Kind:         "internal",
			StartTimeNs:  root.StartTimeNs,
			EndTimeNs:    gatewayEnd,
			DurationNs:   gatewayNs,
			StatusCode:   "OK",
			Attributes:   map[string]string{"synthetic": "true"},
		})
	}

	// 2. Upstream Connect (TCP handshake)
	if upstreamConnectNs > 0 {
		childSpans = append(childSpans, model.TraceSpan{
			SpanID:       root.SpanID + "02",
			ParentSpanID: root.SpanID,
			Name:         "Upstream Connect",
			Kind:         "client",
			StartTimeNs:  upstreamStart,
			EndTimeNs:    upstreamStart + upstreamConnectNs,
			DurationNs:   upstreamConnectNs,
			StatusCode:   "OK",
			Attributes:   upstreamAttrs,
		})
	}

	// 3. Upstream TTFB (waiting for first byte after connect)
	if upstreamHeaderNs > upstreamConnectNs {
		ttfbNs := upstreamHeaderNs - upstreamConnectNs
		ttfbStart := upstreamStart + upstreamConnectNs
		childSpans = append(childSpans, model.TraceSpan{
			SpanID:       root.SpanID + "03",
			ParentSpanID: root.SpanID,
			Name:         "Upstream TTFB",
			Kind:         "client",
			StartTimeNs:  ttfbStart,
			EndTimeNs:    ttfbStart + ttfbNs,
			DurationNs:   ttfbNs,
			StatusCode:   "OK",
			Attributes:   upstreamAttrs,
		})
	}

	// 4. Upstream Transfer (receiving response body)
	if upstreamResponseNs > upstreamHeaderNs {
		transferNs := upstreamResponseNs - upstreamHeaderNs
		transferStart := upstreamStart + upstreamHeaderNs
		childSpans = append(childSpans, model.TraceSpan{
			SpanID:       root.SpanID + "04",
			ParentSpanID: root.SpanID,
			Name:         "Upstream Transfer",
			Kind:         "client",
			StartTimeNs:  transferStart,
			EndTimeNs:    transferStart + transferNs,
			DurationNs:   transferNs,
			StatusCode:   "OK",
			Attributes:   upstreamAttrs,
		})
	}

	// If only connect+header data produced upstream connect+TTFB but no header timing,
	// create a single "Upstream Response" span covering the whole upstream time.
	if len(childSpans) == 1 && gatewayNs > 0 {
		// Only gateway span was created — add a single upstream span
		childSpans = append(childSpans, model.TraceSpan{
			SpanID:       root.SpanID + "05",
			ParentSpanID: root.SpanID,
			Name:         "Upstream Response",
			Kind:         "client",
			StartTimeNs:  upstreamStart,
			EndTimeNs:    upstreamEnd,
			DurationNs:   upstreamResponseNs,
			StatusCode:   "OK",
			Attributes:   upstreamAttrs,
		})
	}

	if len(childSpans) > 0 {
		trace.Spans = append(trace.Spans, childSpans...)
	}
}

// parseSeconds parses a string like "0.825" (seconds) to float64.
// Returns 0 if the string is empty or invalid.
func parseSeconds(s string) float64 {
	if s == "" || s == "-" {
		return 0
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return v
}

func extractServiceName(rs *tracepb.ResourceSpans) string {
	if rs.Resource == nil {
		return "unknown"
	}
	for _, attr := range rs.Resource.Attributes {
		if attr.Key == "service.name" {
			return attr.Value.GetStringValue()
		}
	}
	return "unknown"
}

func extractAttributes(attrs []*commonpb.KeyValue) map[string]string {
	if len(attrs) == 0 {
		return nil
	}
	result := make(map[string]string, len(attrs))
	for _, attr := range attrs {
		val := attr.Value
		switch v := val.Value.(type) {
		case *commonpb.AnyValue_StringValue:
			result[attr.Key] = v.StringValue
		case *commonpb.AnyValue_IntValue:
			result[attr.Key] = strconv.FormatInt(v.IntValue, 10)
		case *commonpb.AnyValue_DoubleValue:
			result[attr.Key] = strconv.FormatFloat(v.DoubleValue, 'f', -1, 64)
		case *commonpb.AnyValue_BoolValue:
			result[attr.Key] = strconv.FormatBool(v.BoolValue)
		}
	}
	return result
}
