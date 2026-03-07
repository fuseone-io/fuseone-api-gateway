package kafka

import (
	"context"
	"fmt"
	"strings"

	"github.com/fuseone/event-gateway/internal/model"
	"github.com/twmb/franz-go/pkg/kadm"
)

// ConsumerGroupInfo holds summary info about a consumer group.
type ConsumerGroupInfo struct {
	GroupID    string                `json:"group_id"`
	State      string               `json:"state"`
	Members    int                   `json:"members"`
	TotalLag   int64                `json:"total_lag"`
	Partitions []PartitionLagInfo   `json:"partitions,omitempty"`
}

// PartitionLagInfo holds lag details for a single partition.
type PartitionLagInfo struct {
	Partition int32  `json:"partition"`
	Offset    int64  `json:"current_offset"`
	LogEnd    int64  `json:"log_end_offset"`
	Lag       int64  `json:"lag"`
	MemberID  string `json:"member_id,omitempty"`
}

// AdminClient wraps kadm for consumer group operations.
type AdminClient struct {
	pool *ClientPool
}

func NewAdminClient(pool *ClientPool) *AdminClient {
	return &AdminClient{pool: pool}
}

// ListConsumerGroups returns groups that match the given prefix for a connection.
func (a *AdminClient) ListConsumerGroups(ctx context.Context, conn model.KafkaConnection, prefix string) ([]ConsumerGroupInfo, error) {
	client, err := a.pool.GetOrCreate(conn)
	if err != nil {
		return nil, err
	}

	adm := kadm.NewClient(client)

	groups, err := adm.ListGroups(ctx)
	if err != nil {
		return nil, fmt.Errorf("list groups: %w", err)
	}

	var result []ConsumerGroupInfo
	for _, g := range groups.Sorted() {
		if prefix != "" && !strings.HasPrefix(g.Group, prefix) {
			continue
		}
		result = append(result, ConsumerGroupInfo{
			GroupID: g.Group,
			State:   g.State,
		})
	}

	if result == nil {
		result = []ConsumerGroupInfo{}
	}

	return result, nil
}

// DescribeConsumerGroup returns detailed info about a specific consumer group.
func (a *AdminClient) DescribeConsumerGroup(ctx context.Context, conn model.KafkaConnection, topic, groupID string) (*ConsumerGroupInfo, error) {
	client, err := a.pool.GetOrCreate(conn)
	if err != nil {
		return nil, err
	}

	adm := kadm.NewClient(client)

	described, err := adm.DescribeGroups(ctx, groupID)
	if err != nil {
		return nil, fmt.Errorf("describe group: %w", err)
	}

	g, ok := described[groupID]
	if !ok {
		return nil, fmt.Errorf("group %q not found", groupID)
	}
	if g.Err != nil {
		return nil, fmt.Errorf("describe group %q: %w", groupID, g.Err)
	}

	info := &ConsumerGroupInfo{
		GroupID: groupID,
		State:   g.State,
		Members: len(g.Members),
	}

	// Get offsets and lag
	offsets, err := adm.FetchOffsets(ctx, groupID)
	if err != nil {
		return info, nil // Return partial info without lag
	}

	endOffsets, err := adm.ListEndOffsets(ctx, topic)
	if err != nil {
		return info, nil
	}

	// Build member map for partition assignment
	memberMap := make(map[int32]string)
	for _, m := range g.Members {
		if ca, ok := m.Assigned.AsConsumer(); ok {
			for _, t := range ca.Topics {
				if t.Topic == topic {
					for _, p := range t.Partitions {
						memberMap[p] = m.MemberID
					}
				}
			}
		}
	}

	offsets.Each(func(o kadm.OffsetResponse) {
		if o.Topic != topic {
			return
		}
		logEnd := int64(0)
		if eo, ok := endOffsets.Lookup(topic, o.Partition); ok {
			logEnd = eo.Offset
		}
		lag := logEnd - o.At
		if lag < 0 {
			lag = 0
		}
		info.TotalLag += lag
		info.Partitions = append(info.Partitions, PartitionLagInfo{
			Partition: o.Partition,
			Offset:    o.At,
			LogEnd:    logEnd,
			Lag:       lag,
			MemberID:  memberMap[o.Partition],
		})
	})

	return info, nil
}

// ResetOffsets resets the consumer group offsets for the given topic.
// Strategy: "earliest" or "latest".
func (a *AdminClient) ResetOffsets(ctx context.Context, conn model.KafkaConnection, topic, groupID, strategy string) error {
	client, err := a.pool.GetOrCreate(conn)
	if err != nil {
		return err
	}

	adm := kadm.NewClient(client)

	var offsets kadm.Offsets
	switch strategy {
	case "earliest":
		listed, err := adm.ListStartOffsets(ctx, topic)
		if err != nil {
			return fmt.Errorf("list start offsets: %w", err)
		}
		offsets = listed.Offsets()
	case "latest":
		listed, err := adm.ListEndOffsets(ctx, topic)
		if err != nil {
			return fmt.Errorf("list end offsets: %w", err)
		}
		offsets = listed.Offsets()
	default:
		return fmt.Errorf("unsupported strategy: %s (use earliest or latest)", strategy)
	}

	_, err = adm.CommitOffsets(ctx, groupID, offsets)
	if err != nil {
		return fmt.Errorf("commit offsets: %w", err)
	}

	return nil
}
