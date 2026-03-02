package model

import (
	"encoding/json"
	"time"
)

type DebugLog struct {
	ID              int64           `json:"id"`
	RouteID         string          `json:"route_id"`
	ServiceID       string          `json:"service_id,omitempty"`
	ConsumerName    string          `json:"consumer_name,omitempty"`
	ReqMethod       string          `json:"req_method"`
	ReqURI          string          `json:"req_uri"`
	ReqHeaders      json.RawMessage `json:"req_headers,omitempty"`
	ReqBody         *string         `json:"req_body,omitempty"`
	ReqSize         int             `json:"req_size"`
	ClientIP        string          `json:"client_ip,omitempty"`
	RespStatus      int16           `json:"resp_status"`
	RespHeaders     json.RawMessage `json:"resp_headers,omitempty"`
	RespBody        *string         `json:"resp_body,omitempty"`
	RespSize        int             `json:"resp_size"`
	LatencyTotal    int             `json:"latency_total"`
	LatencyUpstream *int            `json:"latency_upstream,omitempty"`
	LatencyGateway  *int            `json:"latency_gateway,omitempty"`
	UpstreamAddr    string          `json:"upstream_addr,omitempty"`
	RequestTime     time.Time       `json:"request_time"`
	CreatedAt       time.Time       `json:"created_at"`
}

type DebugLogFilter struct {
	RouteID      string   `form:"route_id"`
	RouteIDs     []string `form:"-"` // set programmatically (e.g. from api_id lookup)
	StatusMin    int      `form:"status_min"`
	StatusMax    int      `form:"status_max"`
	Method       string   `form:"method"`
	Search       string   `form:"search"`
	ClientIP     string   `form:"client_ip"`
	ConsumerName string   `form:"consumer_name"`
	LatencyMin   int      `form:"latency_min"`
	Limit        int      `form:"limit"`
	Offset       int      `form:"offset"`
}
