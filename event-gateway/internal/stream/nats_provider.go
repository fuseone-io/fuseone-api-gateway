package stream

import (
	"context"
	"errors"
	"io"
	"strings"
	"time"
	"unicode"

	"github.com/fuseone/event-gateway/internal/model"
	nats "github.com/nats-io/nats.go"
	"github.com/nats-io/nkeys"
	"go.uber.org/zap"
)

// natsProvider implements StreamProvider for NATS Core and JetStream.
type natsProvider struct {
	conn   model.StreamConnection
	nc     *nats.Conn
	js     nats.JetStreamContext // non-nil only when NATSJetStream = true
	logger *zap.Logger
}

func newNATSProvider(conn model.StreamConnection, logger *zap.Logger) (*natsProvider, error) {
	opts := []nats.Option{
		nats.Name("fuseone-event-gateway"),
		nats.MaxReconnects(-1),
		nats.ReconnectWait(2 * time.Second),
	}

	if conn.NATSToken != nil && *conn.NATSToken != "" {
		opts = append(opts, nats.Token(*conn.NATSToken))
	}
	if conn.NATSNKeySeed != nil && *conn.NATSNKeySeed != "" {
		kp, err := nkeys.FromSeed([]byte(*conn.NATSNKeySeed))
		if err != nil {
			return nil, err
		}
		pubKey, err := kp.PublicKey()
		if err != nil {
			return nil, err
		}
		opts = append(opts, nats.Nkey(pubKey, func(nonce []byte) ([]byte, error) {
			return kp.Sign(nonce)
		}))
	}
	if conn.NATSCredentials != nil && *conn.NATSCredentials != "" {
		opts = append(opts, nats.UserCredentials(*conn.NATSCredentials))
	}

	serverURL := nats.DefaultURL
	if len(conn.NATSURLs) > 0 {
		serverURL = strings.Join(conn.NATSURLs, ",")
	}

	nc, err := nats.Connect(serverURL, opts...)
	if err != nil {
		return nil, err
	}

	p := &natsProvider{conn: conn, nc: nc, logger: logger}

	if conn.NATSJetStream {
		js, err := nc.JetStream()
		if err != nil {
			_ = nc.Drain()
			return nil, err
		}
		p.js = js
	}

	logger.Info("nats provider connected",
		zap.String("server", serverURL),
		zap.Bool("jetstream", conn.NATSJetStream),
	)
	return p, nil
}

func (p *natsProvider) Type() string { return "nats" }

// Publish sends a single message to a NATS subject.
func (p *natsProvider) Publish(ctx context.Context, topic string, req PublishRequest) (*PublishResponse, error) {
	msg := &nats.Msg{
		Subject: topic,
		Data:    req.Value,
		Header:  nats.Header{},
	}
	for k, v := range req.Headers {
		msg.Header.Set(k, v)
	}
	if req.Key != nil {
		msg.Header.Set("Nats-Msg-Key", *req.Key)
	}

	now := time.Now().UTC()

	if p.js != nil {
		ack, err := p.js.PublishMsg(msg, nats.Context(ctx))
		if err != nil {
			return nil, err
		}
		return &PublishResponse{Partition: 0, Offset: int64(ack.Sequence), Timestamp: now}, nil
	}

	if err := p.nc.PublishMsg(msg); err != nil {
		return nil, err
	}
	return &PublishResponse{Partition: 0, Offset: -1, Timestamp: now}, nil
}

// FetchOnce pulls up to maxMessages within timeout.
func (p *natsProvider) FetchOnce(ctx context.Context, topic, groupID, offsetReset string, maxMessages int, timeout time.Duration) ([]Message, error) {
	if p.js != nil {
		return p.jsFetchOnce(ctx, topic, groupID, offsetReset, maxMessages, timeout)
	}
	return p.coreFetchOnce(ctx, topic, groupID, timeout, maxMessages)
}

func (p *natsProvider) jsFetchOnce(ctx context.Context, topic, groupID, offsetReset string, maxMessages int, timeout time.Duration) ([]Message, error) {
	if err := p.ensureStream(topic); err != nil {
		return nil, err
	}
	streamName := subjectToStream(topic)
	durableName := sanitizeName(groupID)

	deliverOpt := nats.DeliverLast()
	if offsetReset == "earliest" {
		deliverOpt = nats.DeliverAll()
	}

	sub, err := p.js.PullSubscribe(topic, durableName,
		nats.BindStream(streamName),
		deliverOpt,
		nats.AckExplicit(),
	)
	if err != nil {
		// Consumer may already exist with a different policy — just bind
		sub, err = p.js.PullSubscribe(topic, durableName, nats.BindStream(streamName))
		if err != nil {
			return nil, err
		}
	}
	defer sub.Unsubscribe()

	msgs, err := sub.Fetch(maxMessages, nats.MaxWait(timeout))
	if err != nil && !errors.Is(err, nats.ErrTimeout) {
		return nil, err
	}

	out := make([]Message, 0, len(msgs))
	for _, m := range msgs {
		_ = m.Ack()
		out = append(out, natsMsgToMessage(m, topic))
	}
	return out, nil
}

func (p *natsProvider) coreFetchOnce(ctx context.Context, topic, groupID string, timeout time.Duration, maxMessages int) ([]Message, error) {
	ch := make(chan *nats.Msg, maxMessages)
	sub, err := p.nc.QueueSubscribe(topic, sanitizeName(groupID), func(m *nats.Msg) {
		select {
		case ch <- m:
		default:
		}
	})
	if err != nil {
		return nil, err
	}
	defer sub.Unsubscribe()

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	var out []Message
	for len(out) < maxMessages {
		select {
		case m := <-ch:
			out = append(out, natsMsgToMessage(m, topic))
		case <-timer.C:
			return out, nil
		case <-ctx.Done():
			return out, nil
		}
	}
	return out, nil
}

// Subscribe opens a continuous message stream (SSE / WebSocket).
func (p *natsProvider) Subscribe(ctx context.Context, topic, groupID, offsetReset string) (<-chan Message, io.Closer, error) {
	outCh := make(chan Message, 64)
	subCtx, cancel := context.WithCancel(ctx)

	if p.js != nil {
		sub, err := p.jsSubscribe(subCtx, topic, groupID, offsetReset, outCh)
		if err != nil {
			cancel()
			return nil, nil, err
		}
		closer := NewCloser(func() {
			cancel()
			_ = sub.Drain()
		})
		return outCh, closer, nil
	}

	sub, err := p.nc.QueueSubscribe(topic, sanitizeName(groupID), func(m *nats.Msg) {
		select {
		case outCh <- natsMsgToMessage(m, topic):
		case <-subCtx.Done():
		}
	})
	if err != nil {
		cancel()
		return nil, nil, err
	}

	// Close outCh when context is cancelled
	go func() {
		<-subCtx.Done()
		_ = sub.Drain()
		close(outCh)
	}()

	closer := NewCloser(func() {
		cancel()
	})
	return outCh, closer, nil
}

func (p *natsProvider) jsSubscribe(ctx context.Context, topic, groupID, offsetReset string, outCh chan<- Message) (*nats.Subscription, error) {
	if err := p.ensureStream(topic); err != nil {
		return nil, err
	}
	streamName := subjectToStream(topic)
	durableName := sanitizeName(groupID)

	deliverOpt := nats.DeliverLast()
	if offsetReset == "earliest" {
		deliverOpt = nats.DeliverAll()
	}

	sub, err := p.js.PullSubscribe(topic, durableName,
		nats.BindStream(streamName),
		deliverOpt,
		nats.AckExplicit(),
	)
	if err != nil {
		// Consumer may already exist with different deliver policy — just bind
		sub, err = p.js.PullSubscribe(topic, durableName, nats.BindStream(streamName))
		if err != nil {
			return nil, err
		}
	}

	// Poll loop: fetch batches and push to outCh
	go func() {
		defer close(outCh)
		for {
			msgs, err := sub.Fetch(10, nats.MaxWait(2*time.Second))
			if err != nil {
				if errors.Is(err, nats.ErrTimeout) || errors.Is(err, nats.ErrConnectionClosed) {
					select {
					case <-ctx.Done():
						return
					default:
						continue
					}
				}
				select {
				case <-ctx.Done():
					return
				default:
					continue
				}
			}
			for _, m := range msgs {
				_ = m.Ack()
				select {
				case outCh <- natsMsgToMessage(m, topic):
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	return sub, nil
}

// ListGroups returns durable consumers for the JetStream stream matching prefix.
// Returns ErrNotSupported for Core NATS.
func (p *natsProvider) ListGroups(ctx context.Context, topic, prefix string) ([]GroupInfo, error) {
	if p.js == nil {
		return nil, ErrNotSupported
	}
	streamName := subjectToStream(topic)

	var groups []GroupInfo
	for info := range p.js.Consumers(streamName) {
		if info != nil && strings.HasPrefix(info.Name, sanitizeName(prefix)) {
			groups = append(groups, natsConsumerToGroupInfo(info))
		}
	}
	return groups, nil
}

// DescribeGroup returns info about a single durable consumer.
func (p *natsProvider) DescribeGroup(ctx context.Context, topic, groupID string) (*GroupInfo, error) {
	if p.js == nil {
		return nil, ErrNotSupported
	}
	streamName := subjectToStream(topic)
	info, err := p.js.ConsumerInfo(streamName, sanitizeName(groupID))
	if err != nil {
		return nil, err
	}
	g := natsConsumerToGroupInfo(info)
	return &g, nil
}

// ResetGroup resets a JetStream consumer to "earliest" (DeliverAllPolicy) or "latest" (DeliverNewPolicy).
func (p *natsProvider) ResetGroup(ctx context.Context, topic, groupID, strategy string) error {
	if p.js == nil {
		return ErrNotSupported
	}
	streamName := subjectToStream(topic)
	durableName := sanitizeName(groupID)

	// Delete and recreate with new deliver policy
	_ = p.js.DeleteConsumer(streamName, durableName)

	deliverPolicy := nats.DeliverNewPolicy
	if strategy == "earliest" {
		deliverPolicy = nats.DeliverAllPolicy
	}

	_, err := p.js.AddConsumer(streamName, &nats.ConsumerConfig{
		Durable:       durableName,
		DeliverPolicy: deliverPolicy,
		AckPolicy:     nats.AckExplicitPolicy,
		FilterSubject: topic,
	})
	return err
}

func (p *natsProvider) Close() error {
	p.nc.Close()
	return nil
}

// --- helpers ---

func (p *natsProvider) ensureStream(subject string) error {
	if p.js == nil {
		return nil
	}
	streamName := subjectToStream(subject)
	_, err := p.js.StreamInfo(streamName)
	if err == nil {
		return nil // already exists
	}
	if !errors.Is(err, nats.ErrStreamNotFound) {
		return err
	}
	_, err = p.js.AddStream(&nats.StreamConfig{
		Name:      streamName,
		Subjects:  []string{subject},
		Retention: nats.LimitsPolicy,
		MaxAge:    7 * 24 * time.Hour,
		Storage:   nats.FileStorage,
		Replicas:  1,
	})
	return err
}

// subjectToStream converts a NATS subject to a valid stream name.
// orders.events → ORDERS_EVENTS
func subjectToStream(subject string) string {
	return strings.ToUpper(strings.ReplaceAll(subject, ".", "_"))
}

// sanitizeName replaces characters invalid for NATS durable/queue names with underscores.
func sanitizeName(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, s)
}

func natsMsgToMessage(m *nats.Msg, topic string) Message {
	h := make(map[string]string)
	for k := range m.Header {
		h[k] = m.Header.Get(k)
	}
	var key []byte
	if k := m.Header.Get("Nats-Msg-Key"); k != "" {
		key = []byte(k)
		delete(h, "Nats-Msg-Key")
	}

	var seq int64 = -1
	if meta, err := m.Metadata(); err == nil {
		seq = int64(meta.Sequence.Stream)
	}

	return Message{
		Key:       key,
		Value:     m.Data,
		Headers:   h,
		Partition: 0,
		Offset:    seq,
		Timestamp: time.Now().UTC(),
		Topic:     topic,
	}
}

func natsConsumerToGroupInfo(info *nats.ConsumerInfo) GroupInfo {
	var lag int64
	if info.NumPending > 0 {
		lag = int64(info.NumPending)
	}
	// NumWaiting is the number of pull requests waiting (pull consumers).
	// Use it as a proxy for active members; minimum 1 when the consumer exists.
	members := info.NumWaiting
	if members == 0 {
		members = 1
	}
	return GroupInfo{
		GroupID:  info.Name,
		State:    "active",
		Members:  members,
		TotalLag: lag,
	}
}
