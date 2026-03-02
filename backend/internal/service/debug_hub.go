package service

import (
	"sync"

	"github.com/fuseone/api-gateway/internal/model"
)

type debugSubscriber struct {
	ch          chan model.DebugLog
	routeFilter string
}

// DebugHub is an in-memory pub/sub hub for broadcasting debug logs to SSE subscribers.
type DebugHub struct {
	mu   sync.RWMutex
	subs map[chan model.DebugLog]*debugSubscriber
}

func NewDebugHub() *DebugHub {
	return &DebugHub{subs: make(map[chan model.DebugLog]*debugSubscriber)}
}

// Subscribe creates a new channel that receives debug logs.
// If routeFilter is non-empty, only logs matching that route_id are sent.
func (h *DebugHub) Subscribe(routeFilter string) chan model.DebugLog {
	ch := make(chan model.DebugLog, 64)
	h.mu.Lock()
	h.subs[ch] = &debugSubscriber{ch: ch, routeFilter: routeFilter}
	h.mu.Unlock()
	return ch
}

// Unsubscribe removes a subscriber and closes its channel.
func (h *DebugHub) Unsubscribe(ch chan model.DebugLog) {
	h.mu.Lock()
	if _, ok := h.subs[ch]; ok {
		delete(h.subs, ch)
		close(ch)
	}
	h.mu.Unlock()
}

// Broadcast sends a log to all matching subscribers. Non-blocking — slow subscribers are skipped.
func (h *DebugHub) Broadcast(log model.DebugLog) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, sub := range h.subs {
		if sub.routeFilter != "" && sub.routeFilter != log.RouteID {
			continue
		}
		select {
		case sub.ch <- log:
		default:
		}
	}
}
