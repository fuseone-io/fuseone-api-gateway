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

// luaPluginTiming matches the JSON objects emitted by fuseone-timing.lua:
//
//	[{"n":"key-auth","o":5000,"d":8200}, ...]
//
// n = plugin name, o = offset_µs from ft_t0, d = duration_µs.
// Values are in microseconds (µs) for sub-ms precision; Go converts to ns via * 1000.
type luaPluginTiming struct {
	N string `json:"n"`
	O int64  `json:"o"` // offset in µs from request start (ft_t0)
	D int64  `json:"d"` // duration in µs
}

// enrichTraceSpans decomposes a single-span trace into synthetic child spans
// using nginx timing variables that APISIX sends as span attributes.
//
// Three enrichment tiers (best to least detail):
//
//  1. Per-plugin timing (fuseone.plugin_timing present):
//     Individual span per plugin, accurately positioned on the timeline.
//
//  2. Per-phase timing (fuseone.rewrite_ms etc. present, no plugin JSON):
//     Auth & Rewrite / Auth & Policies / Response Processing aggregates.
//
//  3. Legacy: single "Gateway Processing" + upstream breakdown.
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

	// Build upstream metadata for child spans
	upstreamAttrs := map[string]string{"synthetic": "true"}
	if upstreamAddr != "" {
		upstreamAttrs["upstream_addr"] = upstreamAddr
	}
	if upstreamStatus != "" {
		upstreamAttrs["upstream_status"] = upstreamStatus
	}

	childSpans := []model.TraceSpan{}

	// Parse per-plugin timing JSON if present.
	var pluginTimings []luaPluginTiming
	if ptJSON := attrs["fuseone.plugin_timing"]; ptJSON != "" {
		_ = json.Unmarshal([]byte(ptJSON), &pluginTimings)
	}

	// Parse per-phase timing attributes.
	rewriteNs := parseMs(attrs["fuseone.rewrite_ms"])
	accessPlusUpstreamNs := parseMs(attrs["fuseone.access_plus_upstream_ms"])
	headerFilterNs := parseMs(attrs["fuseone.header_filter_ms"])
	hasFuseOneTiming := rewriteNs > 0 || accessPlusUpstreamNs > 0

	// Helper: append upstream sub-spans starting at upstreamStart.
	addUpstreamSpans := func(upstreamStart int64, idBase string) int64 {
		upstreamEnd := upstreamStart + upstreamResponseNs

		if upstreamConnectNs > 0 {
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + idBase + "c",
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
		if upstreamHeaderNs > upstreamConnectNs {
			ttfbNs := upstreamHeaderNs - upstreamConnectNs
			ttfbStart := upstreamStart + upstreamConnectNs
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + idBase + "t",
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
		if upstreamResponseNs > upstreamHeaderNs {
			transferNs := upstreamResponseNs - upstreamHeaderNs
			transferStart := upstreamStart + upstreamHeaderNs
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + idBase + "r",
				ParentSpanID: root.SpanID,
				Name:         "Upstream Transfer",
				Kind:         "client",
				StartTimeNs:  transferStart,
				EndTimeNs:    transferStart + transferNs,
				DurationNs:   transferNs,
				StatusCode:   "OK",
				Attributes:   upstreamAttrs,
			})
		} else if upstreamConnectNs == 0 && upstreamHeaderNs == 0 {
			// No breakdown — single upstream span
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + idBase + "r",
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
		return upstreamEnd
	}

	if len(pluginTimings) > 0 {
		// ── Tier 1: Per-plugin spans ──────────────────────────────────────────
		// Each plugin entry carries an offset_ms from ft_t0 (≈ request start)
		// and a duration_ms, giving accurate waterfall positioning.
		//
		// Upstream spans are interleaved at their natural position
		// (after access-phase plugins, before header_filter plugins).
		//
		// Timeline:
		//   [rewrite plugins] [access plugins] [upstream] [header_filter plugins]

		accessPlusUpstreamNs2 := accessPlusUpstreamNs // may be 0 if not captured
		_ = accessPlusUpstreamNs2

		// Compute where upstream starts relative to root.StartTimeNs.
		// Upstream begins at the end of the access phase:
		//   upstreamStart = root.StartTimeNs + rewriteNs + accessNs
		// where accessNs = accessPlusUpstreamNs - upstreamResponseNs.
		accessNs := accessPlusUpstreamNs - upstreamResponseNs
		if accessNs < 0 {
			accessNs = 0
		}
		upstreamStart := root.StartTimeNs + rewriteNs + accessNs

		// Emit plugin spans.  Separate header_filter plugins (o >= upstream end)
		// from pre-upstream plugins (rewrite + access phase) so we can interleave
		// the upstream spans in the correct chronological position.
		upstreamEndNs := upstreamStart + upstreamResponseNs

		// Threshold: offset_µs at which a plugin is considered post-upstream.
		// Use accessPlusUpstreamNs as the cutoff (rewrite + access_plus_upstream), converted to µs.
		postUpstreamOffsetUs := (rewriteNs + accessPlusUpstreamNs) / 1_000

		preUpstream := []luaPluginTiming{}
		postUpstream := []luaPluginTiming{}
		for _, pt := range pluginTimings {
			if pt.D <= 0 {
				continue
			}
			if pt.O >= postUpstreamOffsetUs {
				postUpstream = append(postUpstream, pt)
			} else {
				preUpstream = append(preUpstream, pt)
			}
		}

		for idx, pt := range preUpstream {
			startNs := root.StartTimeNs + pt.O*1_000 // µs → ns
			durNs := pt.D * 1_000                    // µs → ns
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + "p" + strconv.Itoa(idx),
				ParentSpanID: root.SpanID,
				Name:         pt.N,
				Kind:         "internal",
				StartTimeNs:  startNs,
				EndTimeNs:    startNs + durNs,
				DurationNs:   durNs,
				StatusCode:   "OK",
				Attributes:   map[string]string{"synthetic": "true", "fuseone.plugin": "true"},
			})
		}

		upstreamEndNs = addUpstreamSpans(upstreamStart, "u")

		for idx, pt := range postUpstream {
			startNs := root.StartTimeNs + pt.O*1_000 // µs → ns
			// Clamp start to at least upstreamEnd so header_filter spans don't overlap upstream.
			if startNs < upstreamEndNs {
				startNs = upstreamEndNs
			}
			durNs := pt.D * 1_000 // µs → ns
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + "q" + strconv.Itoa(idx),
				ParentSpanID: root.SpanID,
				Name:         pt.N,
				Kind:         "internal",
				StartTimeNs:  startNs,
				EndTimeNs:    startNs + durNs,
				DurationNs:   durNs,
				StatusCode:   "OK",
				Attributes:   map[string]string{"synthetic": "true", "fuseone.plugin": "true"},
			})
		}

	} else if hasFuseOneTiming {
		// ── Tier 2: Phase-level spans ─────────────────────────────────────────
		// access_plus_upstream_ms includes both access-phase plugins and upstream.
		// Pure access time = access_plus_upstream_ms - upstream_response_ms.
		accessNs := accessPlusUpstreamNs - upstreamResponseNs
		if accessNs < 0 {
			accessNs = 0
		}

		cursor := root.StartTimeNs

		// 1. Auth & Rewrite (rewrite phase)
		if rewriteNs > 0 {
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + "01",
				ParentSpanID: root.SpanID,
				Name:         "Auth & Rewrite",
				Kind:         "internal",
				StartTimeNs:  cursor,
				EndTimeNs:    cursor + rewriteNs,
				DurationNs:   rewriteNs,
				StatusCode:   "OK",
				Attributes:   map[string]string{"synthetic": "true", "phase": "rewrite"},
			})
			cursor += rewriteNs
		}

		// 2. Auth & Policies (access phase)
		if accessNs > 0 {
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + "02",
				ParentSpanID: root.SpanID,
				Name:         "Auth & Policies",
				Kind:         "internal",
				StartTimeNs:  cursor,
				EndTimeNs:    cursor + accessNs,
				DurationNs:   accessNs,
				StatusCode:   "OK",
				Attributes:   map[string]string{"synthetic": "true", "phase": "access"},
			})
			cursor += accessNs
		}

		// 3–5. Upstream spans
		upstreamEnd := addUpstreamSpans(cursor, "0")

		// 6. Response Processing (header_filter)
		if headerFilterNs > 0 {
			childSpans = append(childSpans, model.TraceSpan{
				SpanID:       root.SpanID + "06",
				ParentSpanID: root.SpanID,
				Name:         "Response Processing",
				Kind:         "internal",
				StartTimeNs:  upstreamEnd,
				EndTimeNs:    upstreamEnd + headerFilterNs,
				DurationNs:   headerFilterNs,
				StatusCode:   "OK",
				Attributes:   map[string]string{"synthetic": "true", "phase": "header_filter"},
			})
		}

	} else {
		// ── Tier 3: Legacy path ───────────────────────────────────────────────
		gatewayNs := totalNs - upstreamResponseNs
		gatewayEnd := root.StartTimeNs + gatewayNs
		upstreamStart := gatewayEnd

		// 1. Gateway Processing
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

		prevLen := len(childSpans)
		addUpstreamSpans(upstreamStart, "l")

		// If no upstream breakdown was possible, add a single upstream span.
		if len(childSpans) == prevLen && gatewayNs > 0 {
			upstreamEnd := upstreamStart + upstreamResponseNs
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
	}

	if len(childSpans) > 0 {
		trace.Spans = append(trace.Spans, childSpans...)
	}
}

// parseMs parses an integer millisecond string (e.g. "42") and returns nanoseconds.
// Returns 0 if the string is empty or invalid.
func parseMs(s string) int64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v * 1_000_000
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
