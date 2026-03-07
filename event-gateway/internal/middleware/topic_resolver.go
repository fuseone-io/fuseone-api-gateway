package middleware

import (
	"context"
	"net/http"

	"github.com/fuseone/event-gateway/internal/repository"
	"github.com/fuseone/event-gateway/internal/service"
	"github.com/go-chi/chi/v5"
)

type contextKey string

const CtxKeyEventAPI contextKey = "event_api"

// EventAPIFromContext retrieves the EventApiWithConnection from the request context.
func EventAPIFromContext(ctx context.Context) *repository.EventApiWithConnection {
	val, _ := ctx.Value(CtxKeyEventAPI).(*repository.EventApiWithConnection)
	return val
}

// TopicResolver resolves the {topic} URL param to an EventApi config from the ConfigManager.
// Returns 404 if the slug is unknown or the event API is not active.
func TopicResolver(configMgr *service.ConfigManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			slug := chi.URLParam(r, "topic")
			if slug == "" {
				http.Error(w, `{"error":"topic parameter required"}`, http.StatusBadRequest)
				return
			}

			eventAPI, ok := configMgr.GetBySlug(slug)
			if !ok {
				http.Error(w, `{"error":"event api not found"}`, http.StatusNotFound)
				return
			}

			if eventAPI.Status != "active" {
				http.Error(w, `{"error":"event api is not active"}`, http.StatusNotFound)
				return
			}

			ctx := context.WithValue(r.Context(), CtxKeyEventAPI, eventAPI)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
