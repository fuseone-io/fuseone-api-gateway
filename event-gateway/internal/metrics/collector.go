package metrics

import (
	"encoding/json"
	"sync"
	"sync/atomic"

	"github.com/google/uuid"
)

// Counters holds atomic counters for a single Event API.
type Counters struct {
	ProduceTotal      atomic.Int64
	ProduceErrors     atomic.Int64
	ProduceLatencyUs  atomic.Int64 // microseconds total (divide by ProduceTotal for avg)
	ConsumeTotal      atomic.Int64
	ConsumeMessages   atomic.Int64
	SSEActive         atomic.Int64
	SSEMessagesSent   atomic.Int64
	WSActive          atomic.Int64
	WSMessagesIn      atomic.Int64
	WSMessagesOut     atomic.Int64
	WebhookTotal      atomic.Int64
	WebhookSuccess    atomic.Int64
	WebhookFailed     atomic.Int64
}

// Snapshot is the JSON-serializable view of counters.
type Snapshot struct {
	EventApiID       string  `json:"event_api_id"`
	ProduceTotal     int64   `json:"produce_total"`
	ProduceErrors    int64   `json:"produce_errors"`
	ProduceLatencyUs int64   `json:"produce_latency_us"`
	ConsumeTotal     int64   `json:"consume_total"`
	ConsumeMessages  int64   `json:"consume_messages"`
	SSEActive        int64   `json:"sse_active"`
	SSEMessagesSent  int64   `json:"sse_messages_sent"`
	WSActive         int64   `json:"ws_active"`
	WSMessagesIn     int64   `json:"ws_messages_in"`
	WSMessagesOut    int64   `json:"ws_messages_out"`
	WebhookTotal     int64   `json:"webhook_total"`
	WebhookSuccess   int64   `json:"webhook_success"`
	WebhookFailed    int64   `json:"webhook_failed"`
}

// Collector manages per-Event-API metrics counters.
type Collector struct {
	mu       sync.RWMutex
	counters map[uuid.UUID]*Counters
}

func NewCollector() *Collector {
	return &Collector{
		counters: make(map[uuid.UUID]*Counters),
	}
}

// For returns (or creates) the counters for a given event API.
func (c *Collector) For(eventApiID uuid.UUID) *Counters {
	c.mu.RLock()
	ctr, ok := c.counters[eventApiID]
	c.mu.RUnlock()
	if ok {
		return ctr
	}

	c.mu.Lock()
	defer c.mu.Unlock()
	// Double-check after write lock
	if ctr, ok = c.counters[eventApiID]; ok {
		return ctr
	}
	ctr = &Counters{}
	c.counters[eventApiID] = ctr
	return ctr
}

// SnapshotAndReset returns current values for all event APIs and resets cumulative counters.
// Gauge-like values (SSEActive, WSActive) are NOT reset.
func (c *Collector) SnapshotAndReset() []Snapshot {
	c.mu.RLock()
	defer c.mu.RUnlock()

	snapshots := make([]Snapshot, 0, len(c.counters))
	for id, ctr := range c.counters {
		s := Snapshot{
			EventApiID:       id.String(),
			ProduceTotal:     ctr.ProduceTotal.Swap(0),
			ProduceErrors:    ctr.ProduceErrors.Swap(0),
			ProduceLatencyUs: ctr.ProduceLatencyUs.Swap(0),
			ConsumeTotal:     ctr.ConsumeTotal.Swap(0),
			ConsumeMessages:  ctr.ConsumeMessages.Swap(0),
			SSEActive:        ctr.SSEActive.Load(),
			SSEMessagesSent:  ctr.SSEMessagesSent.Swap(0),
			WSActive:         ctr.WSActive.Load(),
			WSMessagesIn:     ctr.WSMessagesIn.Swap(0),
			WSMessagesOut:    ctr.WSMessagesOut.Swap(0),
			WebhookTotal:     ctr.WebhookTotal.Swap(0),
			WebhookSuccess:   ctr.WebhookSuccess.Swap(0),
			WebhookFailed:    ctr.WebhookFailed.Swap(0),
		}
		snapshots = append(snapshots, s)
	}
	return snapshots
}

// SnapshotJSON returns the current snapshot as JSON bytes.
func (c *Collector) SnapshotJSON() ([]byte, error) {
	snap := c.SnapshotAndReset()
	return json.Marshal(snap)
}
