package middleware

import (
	"net/http"
	"sync"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/event-gateway/internal/model"
)

// permKey identifies a permission entry by event_api_id + consumer_name.
type permKey struct {
	EventApiID   uuid.UUID
	ConsumerName string
}

// TopicAuth is a middleware that checks per-topic permissions for APISIX consumers.
// It reads the consumer name from X-Consumer-Name header (set by APISIX auth plugins).
type TopicAuth struct {
	mu     sync.RWMutex
	perms  map[permKey]*model.EventApiPermission
	logger *zap.Logger
}

func NewTopicAuth(logger *zap.Logger) *TopicAuth {
	return &TopicAuth{
		perms:  make(map[permKey]*model.EventApiPermission),
		logger: logger,
	}
}

// LoadPermissions replaces the in-memory permission cache.
func (ta *TopicAuth) LoadPermissions(perms []model.EventApiPermission) {
	m := make(map[permKey]*model.EventApiPermission, len(perms))
	for i := range perms {
		p := &perms[i]
		m[permKey{EventApiID: p.EventApiID, ConsumerName: p.ConsumerName}] = p
	}
	ta.mu.Lock()
	ta.perms = m
	ta.mu.Unlock()
	ta.logger.Info("topic auth permissions loaded", zap.Int("count", len(perms)))
}

// GetPermission returns the permission for a given event API + consumer, or nil if not found.
func (ta *TopicAuth) GetPermission(eventApiID uuid.UUID, consumerName string) *model.EventApiPermission {
	ta.mu.RLock()
	p := ta.perms[permKey{EventApiID: eventApiID, ConsumerName: consumerName}]
	ta.mu.RUnlock()
	return p
}

// RequireProduce returns middleware that checks can_produce permission.
func (ta *TopicAuth) RequireProduce() func(http.Handler) http.Handler {
	return ta.requireAction("produce")
}

// RequireConsume returns middleware that checks can_consume permission.
func (ta *TopicAuth) RequireConsume() func(http.Handler) http.Handler {
	return ta.requireAction("consume")
}

// RequireStream returns middleware that checks can_stream permission.
func (ta *TopicAuth) RequireStream() func(http.Handler) http.Handler {
	return ta.requireAction("stream")
}

func (ta *TopicAuth) requireAction(action string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			consumerName := r.Header.Get("X-Consumer-Name")
			if consumerName == "" {
				// No consumer identified — allow (unauthenticated access, handled by APISIX)
				next.ServeHTTP(w, r)
				return
			}

			eventAPI := EventAPIFromContext(r.Context())
			if eventAPI == nil {
				next.ServeHTTP(w, r)
				return
			}

			// Check if any permissions are defined for this event API
			perm := ta.GetPermission(eventAPI.ID, consumerName)
			if perm == nil {
				// No specific permission — check if there are ANY permissions for this event API.
				// If none exist, allow access (open topic). If some exist, deny (restricted topic).
				if ta.hasAnyPermissions(eventAPI.ID) {
					http.Error(w, `{"error":"access denied: no permission for this topic"}`, http.StatusForbidden)
					return
				}
				next.ServeHTTP(w, r)
				return
			}

			var allowed bool
			switch action {
			case "produce":
				allowed = perm.CanProduce
			case "consume":
				allowed = perm.CanConsume
			case "stream":
				allowed = perm.CanStream
			}

			if !allowed {
				http.Error(w, `{"error":"access denied: `+action+` not permitted"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// hasAnyPermissions checks if there are any permission entries for the given event API.
func (ta *TopicAuth) hasAnyPermissions(eventApiID uuid.UUID) bool {
	ta.mu.RLock()
	defer ta.mu.RUnlock()
	for k := range ta.perms {
		if k.EventApiID == eventApiID {
			return true
		}
	}
	return false
}
