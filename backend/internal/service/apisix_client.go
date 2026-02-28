package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/config"
)

type APISIXClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	logger     *zap.Logger
}

func NewAPISIXClient(cfg *config.APISIXConfig, logger *zap.Logger) *APISIXClient {
	return &APISIXClient{
		baseURL: cfg.AdminURL,
		apiKey:  cfg.APIKey,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger: logger,
	}
}

type APISIXNode struct {
	Key           string          `json:"key"`
	Value         json.RawMessage `json:"value"`
	ModifiedIndex int64           `json:"modifiedIndex,omitempty"`
	CreatedIndex  int64           `json:"createdIndex,omitempty"`
}

type APISIXListResponse struct {
	List  []APISIXNode `json:"list"`
	Total int          `json:"total"`
}

type APISIXSingleResponse struct {
	Key   string          `json:"key"`
	Value json.RawMessage `json:"value"`
}

type APISIXErrorResponse struct {
	ErrorMsg string `json:"error_msg"`
}

func (c *APISIXClient) do(ctx context.Context, method, path string, body io.Reader) (*http.Response, error) {
	url := c.baseURL + "/apisix/admin" + path
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("X-API-KEY", c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}

	return resp, nil
}

func (c *APISIXClient) readResponse(resp *http.Response) (json.RawMessage, error) {
	defer resp.Body.Close()
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var apiErr APISIXErrorResponse
		if json.Unmarshal(bodyBytes, &apiErr) == nil && apiErr.ErrorMsg != "" {
			return nil, fmt.Errorf("APISIX error (%d): %s", resp.StatusCode, apiErr.ErrorMsg)
		}
		return nil, fmt.Errorf("APISIX error (%d): %s", resp.StatusCode, string(bodyBytes))
	}

	return bodyBytes, nil
}

// HealthCheck tests connection to APISIX Admin API
func (c *APISIXClient) HealthCheck(ctx context.Context) error {
	resp, err := c.do(ctx, http.MethodGet, "/routes", nil)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("APISIX returned status %d", resp.StatusCode)
	}
	return nil
}

// Generic CRUD operations

func (c *APISIXClient) List(ctx context.Context, resource string) (*APISIXListResponse, error) {
	resp, err := c.do(ctx, http.MethodGet, "/"+resource, nil)
	if err != nil {
		return nil, err
	}

	body, err := c.readResponse(resp)
	if err != nil {
		return nil, err
	}

	var result APISIXListResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parsing list response: %w", err)
	}

	return &result, nil
}

func (c *APISIXClient) Get(ctx context.Context, resource, id string) (json.RawMessage, error) {
	resp, err := c.do(ctx, http.MethodGet, "/"+resource+"/"+id, nil)
	if err != nil {
		return nil, err
	}

	body, err := c.readResponse(resp)
	if err != nil {
		return nil, err
	}

	return body, nil
}

func (c *APISIXClient) Create(ctx context.Context, resource string, data json.RawMessage) (json.RawMessage, error) {
	resp, err := c.do(ctx, http.MethodPost, "/"+resource, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return c.readResponse(resp)
}

func (c *APISIXClient) CreateWithID(ctx context.Context, resource, id string, data json.RawMessage) (json.RawMessage, error) {
	resp, err := c.do(ctx, http.MethodPut, "/"+resource+"/"+id, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return c.readResponse(resp)
}

func (c *APISIXClient) Update(ctx context.Context, resource, id string, data json.RawMessage) (json.RawMessage, error) {
	resp, err := c.do(ctx, http.MethodPut, "/"+resource+"/"+id, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return c.readResponse(resp)
}

func (c *APISIXClient) Patch(ctx context.Context, resource, id string, data json.RawMessage) (json.RawMessage, error) {
	resp, err := c.do(ctx, http.MethodPatch, "/"+resource+"/"+id, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}

	return c.readResponse(resp)
}

func (c *APISIXClient) Delete(ctx context.Context, resource, id string) error {
	resp, err := c.do(ctx, http.MethodDelete, "/"+resource+"/"+id, nil)
	if err != nil {
		return err
	}

	if resp.StatusCode >= 400 {
		body, _ := c.readResponse(resp)
		return fmt.Errorf("delete failed: %s", string(body))
	}

	resp.Body.Close()
	return nil
}

// Plugin-specific methods

func (c *APISIXClient) ListPlugins(ctx context.Context) (json.RawMessage, error) {
	resp, err := c.do(ctx, http.MethodGet, "/plugins/list", nil)
	if err != nil {
		return nil, err
	}
	return c.readResponse(resp)
}

func (c *APISIXClient) GetPluginSchema(ctx context.Context, name string) (json.RawMessage, error) {
	resp, err := c.do(ctx, http.MethodGet, "/schema/plugins/"+name, nil)
	if err != nil {
		return nil, err
	}
	return c.readResponse(resp)
}

func (c *APISIXClient) ValidateSchema(ctx context.Context, resource string, data json.RawMessage) error {
	resp, err := c.do(ctx, http.MethodPost, "/schema/validate/"+resource, bytes.NewReader(data))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		body, _ := c.readResponse(resp)
		return fmt.Errorf("validation failed: %s", string(body))
	}
	resp.Body.Close()
	return nil
}
