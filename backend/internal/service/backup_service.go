package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/go-git/go-git/v5/plumbing/transport/http"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/repository"
)

// BackupConfig represents the Git backup configuration.
type BackupConfig struct {
	Provider string `json:"provider"` // github, gitlab, bitbucket
	RepoURL  string `json:"repo_url"`
	Branch   string `json:"branch"`
	Token    string `json:"token"` // stored encrypted
}

// BackupCommit represents a single backup commit.
type BackupCommit struct {
	SHA     string    `json:"sha"`
	Message string    `json:"message"`
	Date    time.Time `json:"date"`
	Author  string    `json:"author"`
}

// BackupManifest is written as manifest.json in the backup repo.
type BackupManifest struct {
	Version   string    `json:"version"`
	Timestamp time.Time `json:"timestamp"`
	Instance  string    `json:"instance"`
}

// BackupPreview shows what a restore would change.
type BackupPreview struct {
	Added    []string `json:"added"`
	Modified []string `json:"modified"`
	Deleted  []string `json:"deleted"`
}

// BackupService handles git-based backup and restore.
type BackupService struct {
	settingsRepo *repository.SettingsRepository
	apisix       *APISIXClient
	crypto       *CryptoService
	logger       *zap.Logger
	workDir      string
}

func NewBackupService(
	settingsRepo *repository.SettingsRepository,
	apisix *APISIXClient,
	crypto *CryptoService,
	logger *zap.Logger,
) *BackupService {
	return &BackupService{
		settingsRepo: settingsRepo,
		apisix:       apisix,
		crypto:       crypto,
		logger:       logger,
		workDir:      filepath.Join(os.TempDir(), "fuseone-backup"),
	}
}

func (s *BackupService) auth(token string) *http.BasicAuth {
	return &http.BasicAuth{
		Username: "fuseone", // token-based auth uses any username
		Password: token,
	}
}

// TestConnection tests the Git repo connectivity.
func (s *BackupService) TestConnection(ctx context.Context, cfg BackupConfig) error {
	dir, err := os.MkdirTemp("", "fuseone-backup-test-*")
	if err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	_, err = git.PlainCloneContext(ctx, dir, false, &git.CloneOptions{
		URL:           cfg.RepoURL,
		Auth:          s.auth(cfg.Token),
		Depth:         1,
		SingleBranch:  true,
		ReferenceName: plumbing.NewBranchReferenceName(cfg.Branch),
	})
	if err != nil {
		return fmt.Errorf("clone failed: %w", err)
	}

	return nil
}

// CreateBackup collects all resources and commits them to the Git repo.
func (s *BackupService) CreateBackup(ctx context.Context, cfg BackupConfig) (*BackupCommit, error) {
	// Clone the repo
	dir, err := os.MkdirTemp("", "fuseone-backup-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	repo, err := git.PlainCloneContext(ctx, dir, false, &git.CloneOptions{
		URL:           cfg.RepoURL,
		Auth:          s.auth(cfg.Token),
		SingleBranch:  true,
		ReferenceName: plumbing.NewBranchReferenceName(cfg.Branch),
	})
	if err != nil {
		return nil, fmt.Errorf("clone: %w", err)
	}

	wt, err := repo.Worktree()
	if err != nil {
		return nil, fmt.Errorf("worktree: %w", err)
	}

	// Collect and write APISIX resources
	apisixResources := []string{
		"routes", "services", "upstreams", "consumers",
		"ssls", "global_rules", "plugin_configs", "stream_routes",
	}

	apisixDir := filepath.Join(dir, "apisix")
	os.MkdirAll(apisixDir, 0755)

	for _, resource := range apisixResources {
		data, err := s.apisix.List(ctx, resource)
		if err != nil {
			s.logger.Warn("failed to list resource", zap.String("resource", resource), zap.Error(err))
			continue
		}

		jsonBytes, err := json.MarshalIndent(data, "", "  ")
		if err != nil {
			continue
		}

		filename := filepath.Join(apisixDir, resource+".json")
		if err := os.WriteFile(filename, jsonBytes, 0644); err != nil {
			return nil, fmt.Errorf("write %s: %w", resource, err)
		}
	}

	// Collect database settings
	dbDir := filepath.Join(dir, "database")
	os.MkdirAll(dbDir, 0755)

	dbTables := []string{
		"system_settings", "environments",
	}
	for _, table := range dbTables {
		value, err := s.settingsRepo.Get(ctx, table)
		if err != nil || value == nil {
			continue
		}
		filename := filepath.Join(dbDir, table+".json")
		os.WriteFile(filename, value, 0644)
	}

	// Write manifest
	manifest := BackupManifest{
		Version:   "1.0",
		Timestamp: time.Now().UTC(),
		Instance:  "fuseone-api-gateway",
	}
	manifestBytes, _ := json.MarshalIndent(manifest, "", "  ")
	os.WriteFile(filepath.Join(dir, "manifest.json"), manifestBytes, 0644)

	// Stage all files
	if _, err := wt.Add("."); err != nil {
		return nil, fmt.Errorf("git add: %w", err)
	}

	// Check if there are changes
	status, err := wt.Status()
	if err != nil {
		return nil, fmt.Errorf("git status: %w", err)
	}
	if status.IsClean() {
		return nil, fmt.Errorf("no changes to backup")
	}

	// Commit
	commitMsg := fmt.Sprintf("backup: %s", time.Now().UTC().Format("2006-01-02 15:04:05 UTC"))
	hash, err := wt.Commit(commitMsg, &git.CommitOptions{
		Author: &object.Signature{
			Name:  "FuseOne API Gateway",
			Email: "backup@fuseone.io",
			When:  time.Now(),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	// Push
	if err := repo.PushContext(ctx, &git.PushOptions{
		Auth: s.auth(cfg.Token),
	}); err != nil {
		return nil, fmt.Errorf("push: %w", err)
	}

	commit, _ := repo.CommitObject(hash)
	return &BackupCommit{
		SHA:     hash.String()[:8],
		Message: commitMsg,
		Date:    commit.Author.When,
		Author:  commit.Author.Name,
	}, nil
}

// GetHistory returns the list of backup commits.
func (s *BackupService) GetHistory(ctx context.Context, cfg BackupConfig) ([]BackupCommit, error) {
	dir, err := os.MkdirTemp("", "fuseone-backup-hist-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	repo, err := git.PlainCloneContext(ctx, dir, false, &git.CloneOptions{
		URL:           cfg.RepoURL,
		Auth:          s.auth(cfg.Token),
		SingleBranch:  true,
		ReferenceName: plumbing.NewBranchReferenceName(cfg.Branch),
	})
	if err != nil {
		return nil, fmt.Errorf("clone: %w", err)
	}

	ref, err := repo.Head()
	if err != nil {
		return nil, fmt.Errorf("head: %w", err)
	}

	iter, err := repo.Log(&git.LogOptions{
		From:  ref.Hash(),
		Order: git.LogOrderCommitterTime,
	})
	if err != nil {
		return nil, fmt.Errorf("log: %w", err)
	}

	var commits []BackupCommit
	count := 0
	iter.ForEach(func(c *object.Commit) error {
		if count >= 50 {
			return fmt.Errorf("limit")
		}
		commits = append(commits, BackupCommit{
			SHA:     c.Hash.String()[:8],
			Message: c.Message,
			Date:    c.Author.When,
			Author:  c.Author.Name,
		})
		count++
		return nil
	})

	if commits == nil {
		commits = []BackupCommit{}
	}
	return commits, nil
}

// PreviewRestore shows what a restore from a specific commit would change.
func (s *BackupService) PreviewRestore(ctx context.Context, cfg BackupConfig, sha string) (*BackupPreview, error) {
	dir, err := os.MkdirTemp("", "fuseone-backup-preview-*")
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	repo, err := git.PlainCloneContext(ctx, dir, false, &git.CloneOptions{
		URL:           cfg.RepoURL,
		Auth:          s.auth(cfg.Token),
		SingleBranch:  true,
		ReferenceName: plumbing.NewBranchReferenceName(cfg.Branch),
	})
	if err != nil {
		return nil, fmt.Errorf("clone: %w", err)
	}

	// Find the commit
	commitIter, err := repo.CommitObjects()
	if err != nil {
		return nil, fmt.Errorf("commit objects: %w", err)
	}

	var targetCommit *object.Commit
	commitIter.ForEach(func(c *object.Commit) error {
		if c.Hash.String()[:len(sha)] == sha {
			targetCommit = c
			return fmt.Errorf("found")
		}
		return nil
	})

	if targetCommit == nil {
		return nil, fmt.Errorf("commit %s not found", sha)
	}

	// List files in that commit
	tree, err := targetCommit.Tree()
	if err != nil {
		return nil, fmt.Errorf("tree: %w", err)
	}

	var files []string
	tree.Files().ForEach(func(f *object.File) error {
		files = append(files, f.Name)
		return nil
	})

	return &BackupPreview{
		Added:    files,
		Modified: []string{},
		Deleted:  []string{},
	}, nil
}

// Restore applies the backup from a specific commit.
func (s *BackupService) Restore(ctx context.Context, cfg BackupConfig, sha string) (int, error) {
	dir, err := os.MkdirTemp("", "fuseone-backup-restore-*")
	if err != nil {
		return 0, fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(dir)

	repo, err := git.PlainCloneContext(ctx, dir, false, &git.CloneOptions{
		URL:           cfg.RepoURL,
		Auth:          s.auth(cfg.Token),
		SingleBranch:  true,
		ReferenceName: plumbing.NewBranchReferenceName(cfg.Branch),
	})
	if err != nil {
		return 0, fmt.Errorf("clone: %w", err)
	}

	// Find and checkout the commit
	commitIter, err := repo.CommitObjects()
	if err != nil {
		return 0, fmt.Errorf("commit objects: %w", err)
	}

	var targetHash plumbing.Hash
	found := false
	commitIter.ForEach(func(c *object.Commit) error {
		if c.Hash.String()[:len(sha)] == sha {
			targetHash = c.Hash
			found = true
			return fmt.Errorf("found")
		}
		return nil
	})

	if !found {
		return 0, fmt.Errorf("commit %s not found", sha)
	}

	wt, err := repo.Worktree()
	if err != nil {
		return 0, fmt.Errorf("worktree: %w", err)
	}

	if err := wt.Checkout(&git.CheckoutOptions{Hash: targetHash}); err != nil {
		return 0, fmt.Errorf("checkout: %w", err)
	}

	applied := 0

	// Restore APISIX resources in order: upstreams -> services -> routes (dependency order)
	restoreOrder := []string{
		"upstreams", "services", "consumers",
		"global_rules", "plugin_configs",
		"routes", "stream_routes", "ssls",
	}

	for _, resource := range restoreOrder {
		filename := filepath.Join(dir, "apisix", resource+".json")
		data, err := os.ReadFile(filename)
		if err != nil {
			continue
		}

		var listResp APISIXListResponse
		if err := json.Unmarshal(data, &listResp); err != nil {
			s.logger.Warn("failed to unmarshal backup resource", zap.String("resource", resource), zap.Error(err))
			continue
		}

		for _, node := range listResp.List {
			// Extract ID from the key (e.g., "/apisix/routes/123" -> "123")
			id := filepath.Base(node.Key)
			if _, err := s.apisix.Update(ctx, resource, id, node.Value); err != nil {
				s.logger.Warn("failed to restore resource",
					zap.String("resource", resource),
					zap.String("id", id),
					zap.Error(err))
				continue
			}
			applied++
		}
	}

	return applied, nil
}
