package service

import (
	"testing"
	"time"

	"github.com/fuseone/api-gateway/internal/model"
)

func TestSubscribeReceivesLogs(t *testing.T) {
	hub := NewDebugHub()
	ch := hub.Subscribe("")
	defer hub.Unsubscribe(ch)

	log := model.DebugLog{RouteID: "r1", ReqMethod: "GET", ReqURI: "/test"}
	hub.Broadcast(log)

	select {
	case received := <-ch:
		if received.RouteID != "r1" {
			t.Errorf("expected route_id r1, got %s", received.RouteID)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for broadcast")
	}
}

func TestUnsubscribeStopsReceiving(t *testing.T) {
	hub := NewDebugHub()
	ch := hub.Subscribe("")
	hub.Unsubscribe(ch)

	hub.Broadcast(model.DebugLog{RouteID: "r1"})

	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("should not receive after unsubscribe")
		}
		// channel closed — expected
	case <-time.After(100 * time.Millisecond):
		// also fine
	}
}

func TestBroadcastToMultipleSubscribers(t *testing.T) {
	hub := NewDebugHub()
	ch1 := hub.Subscribe("")
	ch2 := hub.Subscribe("")
	defer hub.Unsubscribe(ch1)
	defer hub.Unsubscribe(ch2)

	hub.Broadcast(model.DebugLog{RouteID: "r1"})

	for i, ch := range []chan model.DebugLog{ch1, ch2} {
		select {
		case <-ch:
		case <-time.After(time.Second):
			t.Fatalf("subscriber %d did not receive", i)
		}
	}
}

func TestRouteFilter(t *testing.T) {
	hub := NewDebugHub()
	chFiltered := hub.Subscribe("r1")
	chAll := hub.Subscribe("")
	defer hub.Unsubscribe(chFiltered)
	defer hub.Unsubscribe(chAll)

	hub.Broadcast(model.DebugLog{RouteID: "r2"})

	// chAll should receive
	select {
	case <-chAll:
	case <-time.After(time.Second):
		t.Fatal("unfiltered subscriber should receive")
	}

	// chFiltered should NOT receive r2
	select {
	case <-chFiltered:
		t.Fatal("filtered subscriber should not receive r2")
	case <-time.After(100 * time.Millisecond):
		// OK
	}

	// Now broadcast for r1 — both should receive
	hub.Broadcast(model.DebugLog{RouteID: "r1"})

	select {
	case <-chFiltered:
	case <-time.After(time.Second):
		t.Fatal("filtered subscriber should receive r1")
	}

	select {
	case <-chAll:
	case <-time.After(time.Second):
		t.Fatal("unfiltered subscriber should receive r1")
	}
}
