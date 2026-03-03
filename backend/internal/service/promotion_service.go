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

type PromotionService struct {
	promoRepo  *repository.PromotionRequestRepository
	deployRepo *repository.ApiDeploymentRepository
	apiDefRepo *repository.ApiDefinitionRepository
	apiDefSvc  *ApiDefinitionService
	logger     *zap.Logger
}

func NewPromotionService(
	promoRepo *repository.PromotionRequestRepository,
	deployRepo *repository.ApiDeploymentRepository,
	apiDefRepo *repository.ApiDefinitionRepository,
	apiDefSvc *ApiDefinitionService,
	logger *zap.Logger,
) *PromotionService {
	return &PromotionService{
		promoRepo:  promoRepo,
		deployRepo: deployRepo,
		apiDefRepo: apiDefRepo,
		apiDefSvc:  apiDefSvc,
		logger:     logger,
	}
}

// Create builds a promotion request by snapshotting the source environment's definition
// and computing a diff against the target environment (if deployed there).
func (s *PromotionService) Create(ctx context.Context, req *model.CreatePromotionRequest, requestedBy uuid.UUID) (*model.PromotionRequest, error) {
	// Get the source deployment snapshot
	sourceDeploy, err := s.deployRepo.GetByAPIAndEnv(ctx, req.ApiDefinitionID, req.SourceEnvID)
	if err != nil {
		return nil, fmt.Errorf("getting source deployment: %w", err)
	}

	// Determine the definition snapshot to promote
	var snapshot json.RawMessage
	if sourceDeploy != nil && sourceDeploy.DefinitionSnapshot != nil {
		snapshot = sourceDeploy.DefinitionSnapshot
	} else {
		// Fall back to the current API definition
		apiDef, err := s.apiDefRepo.GetByID(ctx, req.ApiDefinitionID)
		if err != nil {
			return nil, fmt.Errorf("getting api definition: %w", err)
		}
		if apiDef == nil {
			return nil, fmt.Errorf("api definition not found")
		}
		snapshot = apiDef.Definition
	}

	// Compute diff against target environment (if it has a deployment)
	var diffSummary json.RawMessage
	targetDeploy, err := s.deployRepo.GetByAPIAndEnv(ctx, req.ApiDefinitionID, req.TargetEnvID)
	if err != nil {
		s.logger.Warn("failed to get target deployment for diff", zap.Error(err))
	}

	if targetDeploy != nil && targetDeploy.DefinitionSnapshot != nil {
		diff, err := ComputeDiff(targetDeploy.DefinitionSnapshot, snapshot)
		if err != nil {
			s.logger.Warn("failed to compute diff", zap.Error(err))
		} else {
			diffSummary, _ = json.Marshal(diff)
		}
	}

	promo := &model.PromotionRequest{
		ApiDefinitionID:    req.ApiDefinitionID,
		SourceEnvID:        req.SourceEnvID,
		TargetEnvID:        req.TargetEnvID,
		Status:             model.PromotionPending,
		DefinitionSnapshot: snapshot,
		DiffSummary:        diffSummary,
		RequestedBy:        requestedBy,
	}

	if err := s.promoRepo.Create(ctx, promo); err != nil {
		return nil, fmt.Errorf("creating promotion request: %w", err)
	}

	return promo, nil
}

// Review approves or rejects a promotion request.
func (s *PromotionService) Review(ctx context.Context, id uuid.UUID, action string, reviewedBy uuid.UUID, comment string) (*model.PromotionRequest, error) {
	promo, err := s.promoRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if promo == nil {
		return nil, fmt.Errorf("promotion request not found")
	}
	if promo.Status != model.PromotionPending {
		return nil, fmt.Errorf("promotion request is not pending (current: %s)", promo.Status)
	}

	var newStatus string
	switch action {
	case "approve":
		newStatus = model.PromotionApproved
	case "reject":
		newStatus = model.PromotionRejected
	default:
		return nil, fmt.Errorf("invalid action: %s (must be 'approve' or 'reject')", action)
	}

	if err := s.promoRepo.SetReviewed(ctx, id, newStatus, reviewedBy, comment); err != nil {
		return nil, fmt.Errorf("reviewing promotion: %w", err)
	}

	return s.promoRepo.GetByID(ctx, id)
}

// Execute deploys an approved promotion to the target environment.
func (s *PromotionService) Execute(ctx context.Context, id uuid.UUID, executedBy uuid.UUID) (*model.PromotionRequest, error) {
	promo, err := s.promoRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if promo == nil {
		return nil, fmt.Errorf("promotion request not found")
	}
	if promo.Status != model.PromotionApproved {
		return nil, fmt.Errorf("promotion request must be approved before execution (current: %s)", promo.Status)
	}

	// Deploy the snapshotted definition to the target environment
	_, err = s.apiDefSvc.Deploy(ctx, promo.ApiDefinitionID, promo.TargetEnvID, &executedBy)
	if err != nil {
		// Mark as failed
		if setErr := s.promoRepo.SetFailed(ctx, id); setErr != nil {
			s.logger.Warn("failed to mark promotion as failed", zap.Error(setErr))
		}
		return nil, fmt.Errorf("deploying to target environment: %w", err)
	}

	if err := s.promoRepo.SetDeployed(ctx, id); err != nil {
		return nil, fmt.Errorf("marking promotion as deployed: %w", err)
	}

	return s.promoRepo.GetByID(ctx, id)
}

// List returns promotion requests with optional filters.
func (s *PromotionService) List(ctx context.Context, status string, apiDefID *uuid.UUID) ([]model.PromotionRequest, error) {
	return s.promoRepo.List(ctx, status, apiDefID)
}

// GetByID returns a single promotion request.
func (s *PromotionService) GetByID(ctx context.Context, id uuid.UUID) (*model.PromotionRequest, error) {
	return s.promoRepo.GetByID(ctx, id)
}
