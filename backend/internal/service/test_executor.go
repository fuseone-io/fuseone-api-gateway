package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/fuseone/api-gateway/internal/model"
)

// TestExecutor executes test suites and produces test runs with step-level results.
type TestExecutor struct {
	httpClient *http.Client
	logger     *zap.Logger
}

// NewTestExecutor creates a new TestExecutor.
func NewTestExecutor(logger *zap.Logger) *TestExecutor {
	return &TestExecutor{
		httpClient: &http.Client{Timeout: 30 * time.Second},
		logger:     logger,
	}
}

// Execute runs all steps in a test suite and returns a fully populated TestRun.
func (e *TestExecutor) Execute(ctx context.Context, suite *model.TestSuite, triggerType string) *model.TestRun {
	now := time.Now().UTC()
	run := &model.TestRun{
		ID:          uuid.New(),
		SuiteID:     suite.ID,
		Status:      model.RunStatusRunning,
		TriggerType: triggerType,
		TotalSteps:  len(suite.Steps),
		StartedAt:   &now,
		Results:     make([]model.StepResult, 0, len(suite.Steps)),
	}

	// Variable store for extracted variables across steps
	vars := make(map[string]string)

	hasFailure := false
	hasError := false

	for i, step := range suite.Steps {
		// Apply delay if specified
		if step.DelayMs > 0 {
			select {
			case <-ctx.Done():
				e.skipRemainingSteps(run, i, suite.Steps)
				run.Status = model.RunStatusError
				finished := time.Now().UTC()
				run.FinishedAt = &finished
				run.DurationMs = int(finished.Sub(now).Milliseconds())
				return run
			case <-time.After(time.Duration(step.DelayMs) * time.Millisecond):
			}
		}

		result := e.executeStep(ctx, &step, i, vars)
		run.Results = append(run.Results, result)

		switch result.Status {
		case model.StepStatusPassed:
			run.PassedSteps++
		case model.StepStatusFailed:
			run.FailedSteps++
			hasFailure = true
		case model.StepStatusError:
			run.FailedSteps++
			hasError = true
		}

		// Merge extracted variables
		for k, v := range result.ExtractedVars {
			vars[k] = v
		}

		// Stop execution on error (not on assertion failure)
		if result.Status == model.StepStatusError {
			e.skipRemainingSteps(run, i+1, suite.Steps)
			break
		}
	}

	finished := time.Now().UTC()
	run.FinishedAt = &finished
	run.DurationMs = int(finished.Sub(now).Milliseconds())

	switch {
	case hasError:
		run.Status = model.RunStatusError
	case hasFailure:
		run.Status = model.RunStatusFailed
	default:
		run.Status = model.RunStatusPassed
	}

	return run
}

// executeStep performs a single HTTP request and evaluates assertions.
func (e *TestExecutor) executeStep(ctx context.Context, step *model.TestStep, index int, vars map[string]string) model.StepResult {
	result := model.StepResult{
		StepName:  step.Name,
		StepIndex: index,
		Assertions: make([]model.AssertionResult, 0, len(step.Assertions)),
	}

	// Substitute variables in URL, headers, and body
	url := substituteVars(step.URL, vars)
	body := substituteVars(step.Body, vars)
	headers := make(map[string]string, len(step.Headers))
	for k, v := range step.Headers {
		headers[k] = substituteVars(v, vars)
	}

	// Build request
	var bodyReader io.Reader
	if body != "" {
		bodyReader = strings.NewReader(body)
	}

	req, err := http.NewRequestWithContext(ctx, step.Method, url, bodyReader)
	if err != nil {
		result.Status = model.StepStatusError
		result.Error = fmt.Sprintf("failed to build request: %v", err)
		return result
	}

	for k, v := range headers {
		req.Header.Set(k, v)
	}

	// Execute request and measure response time
	start := time.Now()
	resp, err := e.httpClient.Do(req)
	elapsed := time.Since(start)
	result.ResponseTime = int(elapsed.Milliseconds())

	if err != nil {
		result.Status = model.StepStatusError
		result.Error = fmt.Sprintf("request failed: %v", err)
		return result
	}
	defer resp.Body.Close()

	result.StatusCode = resp.StatusCode

	// Read response body (limit to 1MB)
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		result.Status = model.StepStatusError
		result.Error = fmt.Sprintf("failed to read response body: %v", err)
		return result
	}
	result.ResponseBody = string(respBody)

	// Capture response headers
	result.Headers = make(map[string]string)
	for k := range resp.Header {
		result.Headers[k] = resp.Header.Get(k)
	}

	// Evaluate assertions
	allPassed := true
	for _, assertion := range step.Assertions {
		ar := evaluateAssertion(assertion, resp, result.ResponseBody, result.ResponseTime)
		result.Assertions = append(result.Assertions, ar)
		if !ar.Passed {
			allPassed = false
		}
	}

	if allPassed {
		result.Status = model.StepStatusPassed
	} else {
		result.Status = model.StepStatusFailed
	}

	// Extract variables
	if len(step.ExtractVars) > 0 {
		result.ExtractedVars = extractVariables(step.ExtractVars, result.ResponseBody)
	}

	return result
}

// skipRemainingSteps marks all remaining steps as skipped.
func (e *TestExecutor) skipRemainingSteps(run *model.TestRun, fromIndex int, steps []model.TestStep) {
	for i := fromIndex; i < len(steps); i++ {
		run.Results = append(run.Results, model.StepResult{
			StepName:   steps[i].Name,
			StepIndex:  i,
			Status:     model.StepStatusSkipped,
			Assertions: []model.AssertionResult{},
		})
	}
}

// substituteVars replaces {{varName}} placeholders with values from the variable store.
func substituteVars(input string, vars map[string]string) string {
	if len(vars) == 0 || input == "" {
		return input
	}
	result := input
	for k, v := range vars {
		result = strings.ReplaceAll(result, "{{"+k+"}}", v)
	}
	return result
}

// evaluateAssertion checks a single assertion against the HTTP response.
func evaluateAssertion(a model.Assertion, resp *http.Response, body string, responseTimeMs int) model.AssertionResult {
	ar := model.AssertionResult{
		Type:     a.Type,
		Target:   a.Target,
		Operator: a.Operator,
		Expected: a.Expected,
	}

	switch a.Type {
	case "status_code":
		ar.Actual = strconv.Itoa(resp.StatusCode)
		ar.Passed = compareValues(ar.Actual, a.Expected, a.Operator)

	case "header":
		ar.Actual = resp.Header.Get(a.Target)
		ar.Passed = compareValues(ar.Actual, a.Expected, a.Operator)

	case "body_contains":
		ar.Actual = fmt.Sprintf("(body length: %d)", len(body))
		ar.Passed = strings.Contains(body, a.Expected)
		if a.Operator == "neq" {
			ar.Passed = !strings.Contains(body, a.Expected)
		}

	case "body_json":
		actual := extractJSONPath(body, a.Target)
		ar.Actual = actual
		ar.Passed = compareValues(actual, a.Expected, a.Operator)

	case "response_time":
		ar.Actual = strconv.Itoa(responseTimeMs)
		ar.Passed = compareValues(ar.Actual, a.Expected, a.Operator)

	default:
		ar.Error = fmt.Sprintf("unknown assertion type: %s", a.Type)
		ar.Passed = false
	}

	return ar
}

// compareValues performs the comparison between actual and expected values using the given operator.
func compareValues(actual, expected, operator string) bool {
	switch operator {
	case "eq":
		return actual == expected
	case "neq":
		return actual != expected
	case "contains":
		return strings.Contains(actual, expected)
	case "matches":
		matched, err := regexp.MatchString(expected, actual)
		return err == nil && matched
	case "gt", "lt", "gte", "lte":
		return compareNumeric(actual, expected, operator)
	default:
		return false
	}
}

// compareNumeric parses both values as floats and compares them.
func compareNumeric(actual, expected, operator string) bool {
	a, errA := strconv.ParseFloat(actual, 64)
	e, errE := strconv.ParseFloat(expected, 64)
	if errA != nil || errE != nil {
		return false
	}
	switch operator {
	case "gt":
		return a > e
	case "lt":
		return a < e
	case "gte":
		return a >= e
	case "lte":
		return a <= e
	default:
		return false
	}
}

// extractJSONPath extracts a value from a JSON string using a simplified JSONPath expression.
// Supports dot notation like "$.data.id" or "$.items[0].name".
func extractJSONPath(body, path string) string {
	if body == "" || path == "" {
		return ""
	}

	// Remove leading "$." if present
	path = strings.TrimPrefix(path, "$.")
	if path == "$" || path == "" {
		return body
	}

	var current interface{}
	if err := json.Unmarshal([]byte(body), &current); err != nil {
		return ""
	}

	parts := splitJSONPath(path)
	for _, part := range parts {
		if current == nil {
			return ""
		}

		// Check for array index notation: "items[0]"
		if idx := strings.Index(part, "["); idx >= 0 {
			key := part[:idx]
			idxStr := strings.TrimSuffix(part[idx+1:], "]")
			arrayIdx, err := strconv.Atoi(idxStr)
			if err != nil {
				return ""
			}

			if key != "" {
				obj, ok := current.(map[string]interface{})
				if !ok {
					return ""
				}
				current = obj[key]
			}

			arr, ok := current.([]interface{})
			if !ok || arrayIdx < 0 || arrayIdx >= len(arr) {
				return ""
			}
			current = arr[arrayIdx]
		} else {
			obj, ok := current.(map[string]interface{})
			if !ok {
				return ""
			}
			current = obj[part]
		}
	}

	if current == nil {
		return ""
	}

	switch v := current.(type) {
	case string:
		return v
	case float64:
		if v == float64(int64(v)) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(v)
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return fmt.Sprintf("%v", v)
		}
		return string(b)
	}
}

// splitJSONPath splits a dot-separated path, respecting array brackets.
func splitJSONPath(path string) []string {
	var parts []string
	var current strings.Builder
	inBracket := false

	for _, ch := range path {
		switch {
		case ch == '[':
			inBracket = true
			current.WriteRune(ch)
		case ch == ']':
			inBracket = false
			current.WriteRune(ch)
		case ch == '.' && !inBracket:
			if current.Len() > 0 {
				parts = append(parts, current.String())
				current.Reset()
			}
		default:
			current.WriteRune(ch)
		}
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}

// extractVariables extracts values from the response body using JSONPath expressions.
func extractVariables(extractVars map[string]string, body string) map[string]string {
	result := make(map[string]string)
	for jsonPath, varName := range extractVars {
		value := extractJSONPath(body, jsonPath)
		if value != "" {
			result[varName] = value
		}
	}
	return result
}
