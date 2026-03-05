package repository

import (
	"fmt"

	"github.com/elastic/go-elasticsearch/v8"
)

// NewElasticsearchClient creates a new Elasticsearch client.
func NewElasticsearchClient(addresses []string, username, password, apiKey string) (*elasticsearch.Client, error) {
	cfg := elasticsearch.Config{
		Addresses: addresses,
	}
	if apiKey != "" {
		cfg.APIKey = apiKey
	} else if username != "" {
		cfg.Username = username
		cfg.Password = password
	}

	client, err := elasticsearch.NewClient(cfg)
	if err != nil {
		return nil, fmt.Errorf("create es client: %w", err)
	}
	return client, nil
}

// PingElasticsearch tests connectivity to Elasticsearch.
func PingElasticsearch(client *elasticsearch.Client) error {
	res, err := client.Ping()
	if err != nil {
		return fmt.Errorf("es ping: %w", err)
	}
	defer res.Body.Close()
	if res.IsError() {
		return fmt.Errorf("es ping returned %s", res.Status())
	}
	return nil
}

// TestElasticsearchConnection creates a temporary client and pings.
func TestElasticsearchConnection(addresses []string, username, password, apiKey string) error {
	client, err := NewElasticsearchClient(addresses, username, password, apiKey)
	if err != nil {
		return err
	}
	return PingElasticsearch(client)
}
