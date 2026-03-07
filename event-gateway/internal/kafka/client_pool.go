package kafka

import (
	"fmt"
	"sync"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/google/uuid"
	"github.com/twmb/franz-go/pkg/kgo"
	"github.com/twmb/franz-go/pkg/sasl/plain"
	"github.com/twmb/franz-go/pkg/sasl/scram"
	"go.uber.org/zap"
)

// ClientPool manages a pool of franz-go Kafka clients keyed by kafka_connection_id.
type ClientPool struct {
	mu       sync.RWMutex
	clients  map[uuid.UUID]*kgo.Client
	refCount map[uuid.UUID]int
	logger   *zap.Logger
}

func NewClientPool(logger *zap.Logger) *ClientPool {
	return &ClientPool{
		clients:  make(map[uuid.UUID]*kgo.Client),
		refCount: make(map[uuid.UUID]int),
		logger:   logger,
	}
}

// GetOrCreate returns an existing client or creates a new one for the given connection.
func (p *ClientPool) GetOrCreate(conn model.KafkaConnection) (*kgo.Client, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if client, ok := p.clients[conn.ID]; ok {
		p.refCount[conn.ID]++
		return client, nil
	}

	opts := []kgo.Opt{
		kgo.SeedBrokers(conn.Brokers...),
	}

	// SASL authentication
	if conn.SASLMechanism != nil && conn.SASLUsername != nil && conn.SASLPassword != nil {
		switch *conn.SASLMechanism {
		case "PLAIN":
			opts = append(opts, kgo.SASL(plain.Auth{
				User: *conn.SASLUsername,
				Pass: *conn.SASLPassword,
			}.AsMechanism()))
		case "SCRAM-SHA-256":
			opts = append(opts, kgo.SASL(scram.Auth{
				User: *conn.SASLUsername,
				Pass: *conn.SASLPassword,
			}.AsSha256Mechanism()))
		case "SCRAM-SHA-512":
			opts = append(opts, kgo.SASL(scram.Auth{
				User: *conn.SASLUsername,
				Pass: *conn.SASLPassword,
			}.AsSha512Mechanism()))
		default:
			return nil, fmt.Errorf("unsupported SASL mechanism: %s", *conn.SASLMechanism)
		}
	}

	client, err := kgo.NewClient(opts...)
	if err != nil {
		return nil, fmt.Errorf("create kafka client: %w", err)
	}

	p.clients[conn.ID] = client
	p.refCount[conn.ID] = 1
	p.logger.Info("kafka client created",
		zap.String("connection_id", conn.ID.String()),
		zap.Strings("brokers", conn.Brokers),
	)

	return client, nil
}

// Release decrements the reference count for a connection. Closes client if count reaches 0.
func (p *ClientPool) Release(connectionID uuid.UUID) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.refCount[connectionID]--
	if p.refCount[connectionID] <= 0 {
		if client, ok := p.clients[connectionID]; ok {
			client.Close()
			delete(p.clients, connectionID)
			delete(p.refCount, connectionID)
			p.logger.Info("kafka client closed", zap.String("connection_id", connectionID.String()))
		}
	}
}

// ActiveClients returns the number of active Kafka clients.
func (p *ClientPool) ActiveClients() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.clients)
}

// Close closes all clients in the pool.
func (p *ClientPool) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()

	for id, client := range p.clients {
		client.Close()
		p.logger.Info("kafka client closed", zap.String("connection_id", id.String()))
	}
	p.clients = make(map[uuid.UUID]*kgo.Client)
	p.refCount = make(map[uuid.UUID]int)
}
