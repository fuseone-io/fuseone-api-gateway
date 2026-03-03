package service

import (
	"math"
	"strings"
	"testing"

	"github.com/fuseone/api-gateway/internal/model"
	"go.uber.org/zap"
)

// ensure model import is used
var _ model.MetricsRow

func TestParseFamilies(t *testing.T) {
	input := `# HELP apisix_http_status HTTP status codes per service in APISIX
# TYPE apisix_http_status counter
apisix_http_status{code="200",route="test",matched_uri="/test/*",matched_host="",service="",consumer="",node="172.22.0.1:80"} 5
apisix_http_status{code="404",route="test",matched_uri="/test/*",matched_host="",service="",consumer="",node="172.22.0.1:80"} 2
apisix_http_status{code="200",route="orders",matched_uri="/orders/*",matched_host="",service="",consumer="",node="172.22.0.2:80"} 10
# HELP apisix_bandwidth Total bandwidth in bytes
# TYPE apisix_bandwidth counter
apisix_bandwidth{type="ingress",route="test",service="",consumer="",node="172.22.0.1:80"} 12345
apisix_bandwidth{type="egress",route="test",service="",consumer="",node="172.22.0.1:80"} 67890
`
	families, err := parseFamilies(strings.NewReader(input))
	if err != nil {
		t.Fatalf("parse error: %v", err)
	}

	if _, ok := families["apisix_http_status"]; !ok {
		t.Fatal("expected apisix_http_status family")
	}
	if len(families["apisix_http_status"].Metric) != 3 {
		t.Errorf("expected 3 metrics in apisix_http_status, got %d", len(families["apisix_http_status"].Metric))
	}

	if _, ok := families["apisix_bandwidth"]; !ok {
		t.Fatal("expected apisix_bandwidth family")
	}
	if len(families["apisix_bandwidth"].Metric) != 2 {
		t.Errorf("expected 2 metrics in apisix_bandwidth, got %d", len(families["apisix_bandwidth"].Metric))
	}
}

func TestParseFamilies_EmptyInput(t *testing.T) {
	families, err := parseFamilies(strings.NewReader(""))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(families) != 0 {
		t.Errorf("expected 0 families, got %d", len(families))
	}
}

func TestComputePercentile_Basic(t *testing.T) {
	// Histogram buckets: cumulative counts at each boundary
	// 2 requests <= 5ms, 3 requests <= 10ms, 5 requests <= 50ms, 5 total
	buckets := map[float64]int{
		1:          0,
		5:          2,
		10:         3,
		25:         4,
		50:         5,
		100:        5,
		200:        5,
		500:        5,
		1000:       5,
		math.Inf(1): 5,
	}

	p50 := computePercentile(buckets, 0.50)
	// p50: rank = 0.50 * 5 = 2.5, falls in bucket (5, 10] since count at 5 is 2, count at 10 is 3
	// interpolation: 5 + (10-5) * (2.5-2)/(3-2) = 5 + 5*0.5 = 7.5
	if math.Abs(p50-7.5) > 0.01 {
		t.Errorf("expected p50 ≈ 7.5, got %f", p50)
	}

	p95 := computePercentile(buckets, 0.95)
	// rank = 4.75, falls in bucket (25, 50] since count at 25 is 4, count at 50 is 5
	// interpolation: 25 + (50-25) * (4.75-4)/(5-4) = 25 + 25*0.75 = 43.75
	if math.Abs(p95-43.75) > 0.01 {
		t.Errorf("expected p95 ≈ 43.75, got %f", p95)
	}
}

func TestComputePercentile_AllInOneBucket(t *testing.T) {
	buckets := map[float64]int{
		1:          10,
		5:          10,
		10:         10,
		math.Inf(1): 10,
	}

	p50 := computePercentile(buckets, 0.50)
	// All requests in first bucket (<=1ms)
	// rank = 5, count at 1 = 10 (already covers it)
	// interpolation: 0 + (1-0) * (5-0)/10 = 0.5
	if math.Abs(p50-0.5) > 0.01 {
		t.Errorf("expected p50 ≈ 0.5, got %f", p50)
	}
}

func TestComputePercentile_EmptyBuckets(t *testing.T) {
	buckets := map[float64]int{
		1:          0,
		5:          0,
		math.Inf(1): 0,
	}

	p50 := computePercentile(buckets, 0.50)
	if p50 != 0 {
		t.Errorf("expected p50 = 0 for empty buckets, got %f", p50)
	}
}

func TestProcessMetrics_StatusCodes(t *testing.T) {
	input := `# HELP apisix_http_status HTTP status codes
# TYPE apisix_http_status counter
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 100
apisix_http_status{code="201",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 20
apisix_http_status{code="404",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 5
apisix_http_status{code="500",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 3
apisix_http_status{code="301",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 2
`
	families, _ := parseFamilies(strings.NewReader(input))

	s := &MetricsScraper{
		accumulators: make(map[string]*routeAccumulator),
		prevCounters: make(map[string]float64),
		firstScrape:  true,
	}

	// First scrape only records prevCounters, no deltas
	s.processMetrics(families)
	if len(s.accumulators) != 0 {
		t.Fatalf("first scrape should not produce accumulators, got %d", len(s.accumulators))
	}

	// Second scrape with increased values -> produces deltas
	input2 := `# HELP apisix_http_status HTTP status codes
# TYPE apisix_http_status counter
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 110
apisix_http_status{code="201",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 25
apisix_http_status{code="404",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 8
apisix_http_status{code="500",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 4
apisix_http_status{code="301",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 3
`
	families2, _ := parseFamilies(strings.NewReader(input2))
	s.processMetrics(families2)

	acc, ok := s.accumulators["api-v1|"]
	if !ok {
		t.Fatal("expected accumulator for api-v1|")
	}

	// Delta: 200: +10, 201: +5, 404: +3, 500: +1, 301: +1
	expected2xx := 15 // 10 + 5
	expected3xx := 1
	expected4xx := 3
	expected5xx := 1

	got2xx := acc.statusCounts[200] + acc.statusCounts[201]
	got3xx := acc.statusCounts[301]
	got4xx := acc.statusCounts[404]
	got5xx := acc.statusCounts[500]

	if got2xx != expected2xx {
		t.Errorf("2xx: expected %d, got %d", expected2xx, got2xx)
	}
	if got3xx != expected3xx {
		t.Errorf("3xx: expected %d, got %d", expected3xx, got3xx)
	}
	if got4xx != expected4xx {
		t.Errorf("4xx: expected %d, got %d", expected4xx, got4xx)
	}
	if got5xx != expected5xx {
		t.Errorf("5xx: expected %d, got %d", expected5xx, got5xx)
	}
}

func TestProcessMetrics_CounterDelta(t *testing.T) {
	s := &MetricsScraper{
		accumulators: make(map[string]*routeAccumulator),
		prevCounters: make(map[string]float64),
		firstScrape:  true,
	}

	scrape1 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="test",matched_uri="/t/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 50
`
	scrape2 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="test",matched_uri="/t/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 75
`

	families1, _ := parseFamilies(strings.NewReader(scrape1))
	s.processMetrics(families1)

	families2, _ := parseFamilies(strings.NewReader(scrape2))
	s.processMetrics(families2)

	acc := s.accumulators["test|"]
	if acc == nil {
		t.Fatal("expected accumulator for test|")
	}
	if acc.statusCounts[200] != 25 {
		t.Errorf("expected delta of 25, got %d", acc.statusCounts[200])
	}
}

func TestProcessMetrics_CounterReset(t *testing.T) {
	s := &MetricsScraper{
		accumulators: make(map[string]*routeAccumulator),
		prevCounters: make(map[string]float64),
		firstScrape:  true,
	}

	// First scrape: counter at 100
	scrape1 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="test",matched_uri="/t/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 100
`
	families1, _ := parseFamilies(strings.NewReader(scrape1))
	s.processMetrics(families1)

	// Second scrape: counter at 150 (normal)
	scrape2 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="test",matched_uri="/t/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 150
`
	families2, _ := parseFamilies(strings.NewReader(scrape2))
	s.processMetrics(families2)

	// Third scrape: counter at 10 (APISIX restart — counter reset)
	scrape3 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="test",matched_uri="/t/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 10
`
	families3, _ := parseFamilies(strings.NewReader(scrape3))
	s.processMetrics(families3)

	acc := s.accumulators["test|"]
	if acc == nil {
		t.Fatal("expected accumulator for test|")
	}
	// 50 (from second scrape delta) + 10 (from counter reset: use current value)
	if acc.statusCounts[200] != 60 {
		t.Errorf("expected 60 after counter reset, got %d", acc.statusCounts[200])
	}
}

func TestFlush_ProducesCorrectRows(t *testing.T) {
	s := &MetricsScraper{
		accumulators:  make(map[string]*routeAccumulator),
		prevCounters:  make(map[string]float64),
		firstScrape:   true,
		routeResolver: NewRouteNameResolver(nil, zap.NewNop()),
	}

	// Simulate two scrapes for a route
	scrape1 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 100
# TYPE apisix_bandwidth counter
apisix_bandwidth{type="ingress",route="api-v1",service="",consumer="",node="10.0.0.1:80"} 5000
apisix_bandwidth{type="egress",route="api-v1",service="",consumer="",node="10.0.0.1:80"} 10000
# TYPE apisix_http_latency histogram
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="1"} 0
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="5"} 5
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="10"} 20
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="25"} 40
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="50"} 80
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="100"} 95
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="+Inf"} 100
apisix_http_latency_sum{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80"} 2500
apisix_http_latency_count{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80"} 100
`
	families1, _ := parseFamilies(strings.NewReader(scrape1))
	s.processMetrics(families1)

	scrape2 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 120
# TYPE apisix_bandwidth counter
apisix_bandwidth{type="ingress",route="api-v1",service="",consumer="",node="10.0.0.1:80"} 6000
apisix_bandwidth{type="egress",route="api-v1",service="",consumer="",node="10.0.0.1:80"} 12000
# TYPE apisix_http_latency histogram
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="1"} 0
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="5"} 6
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="10"} 24
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="25"} 50
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="50"} 100
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="100"} 115
apisix_http_latency_bucket{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80",le="+Inf"} 120
apisix_http_latency_sum{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80"} 3000
apisix_http_latency_count{type="apisix",route="api-v1",service_id="",consumer="",node="10.0.0.1:80"} 120
`
	families2, _ := parseFamilies(strings.NewReader(scrape2))
	s.processMetrics(families2)

	rows := s.buildRows()
	if len(rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows))
	}

	row := rows[0]
	if row.RouteID != "api-v1" {
		t.Errorf("expected route_id=api-v1, got %s", row.RouteID)
	}
	// Delta: 200 code: 120-100 = 20 requests
	if row.RequestsTotal != 20 {
		t.Errorf("expected requests_total=20, got %d", row.RequestsTotal)
	}
	if row.Status2xx != 20 {
		t.Errorf("expected status_2xx=20, got %d", row.Status2xx)
	}
	// Bandwidth delta: ingress 1000, egress 2000
	if row.BandwidthIngress != 1000 {
		t.Errorf("expected bandwidth_ingress=1000, got %d", row.BandwidthIngress)
	}
	if row.BandwidthEgress != 2000 {
		t.Errorf("expected bandwidth_egress=2000, got %d", row.BandwidthEgress)
	}
	// Latency: p50 should be reasonable (delta of 20 requests in histogram)
	if row.LatencyP50 <= 0 {
		t.Errorf("expected positive latency_p50, got %f", row.LatencyP50)
	}
}

func TestProcessMetrics_ConsumerLabel(t *testing.T) {
	s := &MetricsScraper{
		accumulators: make(map[string]*routeAccumulator),
		prevCounters: make(map[string]float64),
		firstScrape:  true,
	}

	// Scrape 1: two consumers on the same route
	scrape1 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="app-mobile",node="10.0.0.1:80"} 50
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="app-web",node="10.0.0.1:80"} 30
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 20
`
	families1, _ := parseFamilies(strings.NewReader(scrape1))
	s.processMetrics(families1)

	// Scrape 2: counters increase
	scrape2 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="app-mobile",node="10.0.0.1:80"} 70
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="app-web",node="10.0.0.1:80"} 45
apisix_http_status{code="200",route="api-v1",matched_uri="/v1/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 25
`
	families2, _ := parseFamilies(strings.NewReader(scrape2))
	s.processMetrics(families2)

	// Should have 3 separate accumulators: route|consumer combinations
	if len(s.accumulators) != 3 {
		t.Fatalf("expected 3 accumulators (per route|consumer), got %d", len(s.accumulators))
	}

	mobileAcc := s.accumulators["api-v1|app-mobile"]
	if mobileAcc == nil {
		t.Fatal("expected accumulator for api-v1|app-mobile")
	}
	if mobileAcc.consumerName != "app-mobile" {
		t.Errorf("expected consumerName=app-mobile, got %s", mobileAcc.consumerName)
	}
	if mobileAcc.statusCounts[200] != 20 {
		t.Errorf("expected mobile delta=20, got %d", mobileAcc.statusCounts[200])
	}

	webAcc := s.accumulators["api-v1|app-web"]
	if webAcc == nil {
		t.Fatal("expected accumulator for api-v1|app-web")
	}
	if webAcc.consumerName != "app-web" {
		t.Errorf("expected consumerName=app-web, got %s", webAcc.consumerName)
	}
	if webAcc.statusCounts[200] != 15 {
		t.Errorf("expected web delta=15, got %d", webAcc.statusCounts[200])
	}

	anonAcc := s.accumulators["api-v1|"]
	if anonAcc == nil {
		t.Fatal("expected accumulator for api-v1| (anonymous)")
	}
	if anonAcc.statusCounts[200] != 5 {
		t.Errorf("expected anon delta=5, got %d", anonAcc.statusCounts[200])
	}
}

func TestFlush_ConsumerInRows(t *testing.T) {
	s := &MetricsScraper{
		accumulators:  make(map[string]*routeAccumulator),
		prevCounters:  make(map[string]float64),
		firstScrape:   true,
		routeResolver: NewRouteNameResolver(nil, zap.NewNop()),
	}

	scrape1 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="orders",matched_uri="/orders/*",matched_host="",service="",consumer="app-mobile",node="10.0.0.1:80"} 100
apisix_http_status{code="200",route="orders",matched_uri="/orders/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 50
`
	families1, _ := parseFamilies(strings.NewReader(scrape1))
	s.processMetrics(families1)

	scrape2 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="orders",matched_uri="/orders/*",matched_host="",service="",consumer="app-mobile",node="10.0.0.1:80"} 120
apisix_http_status{code="200",route="orders",matched_uri="/orders/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 60
`
	families2, _ := parseFamilies(strings.NewReader(scrape2))
	s.processMetrics(families2)

	rows := s.buildRows()
	if len(rows) != 2 {
		t.Fatalf("expected 2 rows (one per consumer), got %d", len(rows))
	}

	// Find mobile row
	var mobileRow, anonRow *model.MetricsRow
	for i := range rows {
		if rows[i].ConsumerName == "app-mobile" {
			mobileRow = &rows[i]
		} else if rows[i].ConsumerName == "" {
			anonRow = &rows[i]
		}
	}

	if mobileRow == nil {
		t.Fatal("expected row with consumer_name=app-mobile")
	}
	if mobileRow.RequestsTotal != 20 {
		t.Errorf("expected mobile requests=20, got %d", mobileRow.RequestsTotal)
	}

	if anonRow == nil {
		t.Fatal("expected row with consumer_name='' (anonymous)")
	}
	if anonRow.RequestsTotal != 10 {
		t.Errorf("expected anon requests=10, got %d", anonRow.RequestsTotal)
	}
}

func TestProcessMetrics_MultiNode(t *testing.T) {
	s := &MetricsScraper{
		accumulators: make(map[string]*routeAccumulator),
		prevCounters: make(map[string]float64),
		firstScrape:  true,
	}

	// Scrape 1: two nodes, each with different counter values
	scrape1 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="api",matched_uri="/api/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 50
apisix_http_status{code="200",route="api",matched_uri="/api/*",matched_host="",service="",consumer="",node="10.0.0.2:80"} 30
`
	families1, _ := parseFamilies(strings.NewReader(scrape1))
	s.processMetrics(families1)

	// Scrape 2: node1 got 5 more requests, node2 got 3 more
	scrape2 := `# TYPE apisix_http_status counter
apisix_http_status{code="200",route="api",matched_uri="/api/*",matched_host="",service="",consumer="",node="10.0.0.1:80"} 55
apisix_http_status{code="200",route="api",matched_uri="/api/*",matched_host="",service="",consumer="",node="10.0.0.2:80"} 33
`
	families2, _ := parseFamilies(strings.NewReader(scrape2))
	s.processMetrics(families2)

	acc := s.accumulators["api|"]
	if acc == nil {
		t.Fatal("expected accumulator for api|")
	}
	// Total delta: 5 + 3 = 8
	if acc.statusCounts[200] != 8 {
		t.Errorf("expected 8 requests across both nodes, got %d", acc.statusCounts[200])
	}
}
