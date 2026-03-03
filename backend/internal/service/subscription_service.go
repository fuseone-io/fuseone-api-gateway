package service

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
	"github.com/fuseone/api-gateway/internal/repository"
)

type SubscriptionService struct {
	subRepo  *repository.SubscriptionRepository
	registry *APISIXClientRegistry
	logger   *zap.Logger
}

func NewSubscriptionService(
	subRepo *repository.SubscriptionRepository,
	registry *APISIXClientRegistry,
	logger *zap.Logger,
) *SubscriptionService {
	return &SubscriptionService{
		subRepo:  subRepo,
		registry: registry,
		logger:   logger,
	}
}

// Create inserts a new subscription with pending status.
func (s *SubscriptionService) Create(ctx context.Context, req *model.CreateSubscriptionRequest, requestedBy uuid.UUID) (*model.Subscription, error) {
	sub := &model.Subscription{
		ConsumerUsername: req.ConsumerUsername,
		ApiDefinitionID: req.ApiDefinitionID,
		PlanID:          req.PlanID,
		Status:          model.SubscriptionPending,
		RequestedBy:     &requestedBy,
		Notes:           req.Notes,
	}

	if err := s.subRepo.Create(ctx, sub); err != nil {
		return nil, fmt.Errorf("creating subscription: %w", err)
	}
	return sub, nil
}

// Approve activates a subscription and syncs the consumer's group_id in APISIX.
func (s *SubscriptionService) Approve(ctx context.Context, id uuid.UUID, approvedBy uuid.UUID) (*model.Subscription, error) {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found")
	}
	if sub.Status != model.SubscriptionPending {
		return nil, fmt.Errorf("subscription is not pending (current: %s)", sub.Status)
	}

	if err := s.subRepo.SetApproved(ctx, id, approvedBy); err != nil {
		return nil, fmt.Errorf("approving subscription: %w", err)
	}

	// Sync APISIX consumer group_id if a plan is assigned
	if sub.PlanID != "" {
		if err := s.syncConsumerGroupID(ctx, sub.ConsumerUsername, sub.PlanID); err != nil {
			s.logger.Warn("failed to sync consumer group_id on approve",
				zap.String("consumer", sub.ConsumerUsername),
				zap.String("plan_id", sub.PlanID),
				zap.Error(err))
		}
	}

	return s.subRepo.GetByID(ctx, id)
}

// Reject revokes a pending subscription.
func (s *SubscriptionService) Reject(ctx context.Context, id uuid.UUID, notes string) (*model.Subscription, error) {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found")
	}
	if sub.Status != model.SubscriptionPending {
		return nil, fmt.Errorf("subscription is not pending (current: %s)", sub.Status)
	}

	if err := s.subRepo.SetRevoked(ctx, id, notes); err != nil {
		return nil, fmt.Errorf("rejecting subscription: %w", err)
	}
	return s.subRepo.GetByID(ctx, id)
}

// Suspend suspends an active subscription.
func (s *SubscriptionService) Suspend(ctx context.Context, id uuid.UUID) (*model.Subscription, error) {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found")
	}
	if sub.Status != model.SubscriptionActive {
		return nil, fmt.Errorf("subscription is not active (current: %s)", sub.Status)
	}

	if err := s.subRepo.SetSuspended(ctx, id); err != nil {
		return nil, fmt.Errorf("suspending subscription: %w", err)
	}
	return s.subRepo.GetByID(ctx, id)
}

// Revoke revokes an active or suspended subscription and optionally removes the consumer's group_id.
func (s *SubscriptionService) Revoke(ctx context.Context, id uuid.UUID, notes string) (*model.Subscription, error) {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if sub == nil {
		return nil, fmt.Errorf("subscription not found")
	}
	if sub.Status != model.SubscriptionActive && sub.Status != model.SubscriptionSuspended {
		return nil, fmt.Errorf("subscription must be active or suspended to revoke (current: %s)", sub.Status)
	}

	if err := s.subRepo.SetRevoked(ctx, id, notes); err != nil {
		return nil, fmt.Errorf("revoking subscription: %w", err)
	}

	// If plan was assigned, check if consumer has other active subscriptions with the same plan
	if sub.PlanID != "" {
		count, err := s.subRepo.CountActiveByConsumerAndPlan(ctx, sub.ConsumerUsername, sub.PlanID, id)
		if err != nil {
			s.logger.Warn("failed to count active subscriptions", zap.Error(err))
		} else if count == 0 {
			// No other active subscriptions with this plan — remove group_id
			if err := s.syncConsumerGroupID(ctx, sub.ConsumerUsername, ""); err != nil {
				s.logger.Warn("failed to remove consumer group_id on revoke",
					zap.String("consumer", sub.ConsumerUsername),
					zap.Error(err))
			}
		}
	}

	return s.subRepo.GetByID(ctx, id)
}

// List returns subscriptions with optional filters.
func (s *SubscriptionService) List(ctx context.Context, consumerUsername string, apiDefID *uuid.UUID, status string) ([]model.Subscription, error) {
	return s.subRepo.List(ctx, consumerUsername, apiDefID, status)
}

// GetByID returns a single subscription.
func (s *SubscriptionService) GetByID(ctx context.Context, id uuid.UUID) (*model.Subscription, error) {
	return s.subRepo.GetByID(ctx, id)
}

// syncConsumerGroupID updates the APISIX consumer's group_id field.
func (s *SubscriptionService) syncConsumerGroupID(ctx context.Context, username, groupID string) error {
	client, err := s.registry.GetClient(ctx, uuid.Nil) // default environment
	if err != nil {
		return fmt.Errorf("getting APISIX client: %w", err)
	}

	// Get current consumer
	consumerData, err := client.Get(ctx, "consumers", username)
	if err != nil {
		return fmt.Errorf("getting consumer %s: %w", username, err)
	}

	// Parse and update group_id
	var consumer map[string]interface{}
	if err := json.Unmarshal(consumerData, &consumer); err != nil {
		return fmt.Errorf("parsing consumer data: %w", err)
	}

	if groupID != "" {
		consumer["group_id"] = groupID
	} else {
		delete(consumer, "group_id")
	}

	// Remove read-only fields
	delete(consumer, "create_time")
	delete(consumer, "update_time")

	updated, err := json.Marshal(consumer)
	if err != nil {
		return fmt.Errorf("marshaling consumer data: %w", err)
	}

	if _, err := client.Update(ctx, "consumers", username, updated); err != nil {
		return fmt.Errorf("updating consumer %s: %w", username, err)
	}

	s.logger.Info("synced consumer group_id",
		zap.String("consumer", username),
		zap.String("group_id", groupID))
	return nil
}
