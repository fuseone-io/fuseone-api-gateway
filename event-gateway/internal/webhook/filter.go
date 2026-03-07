package webhook

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// MatchesFilter evaluates a simple filter expression against a JSON payload.
// Supported expressions:
//   - "" (empty) → always matches
//   - "field == value" → string equality
//   - "field != value" → string inequality
//   - "field > N", "field >= N", "field < N", "field <= N" → numeric comparison
//   - "field contains value" → substring match
//
// Field supports dot notation for nested access: "data.type", "meta.priority".
func MatchesFilter(expression string, payload []byte) bool {
	expression = strings.TrimSpace(expression)
	if expression == "" {
		return true
	}

	var data map[string]any
	if err := json.Unmarshal(payload, &data); err != nil {
		return true // non-JSON payloads pass through
	}

	// Parse expression: "field op value"
	field, op, value, ok := parseExpression(expression)
	if !ok {
		return true // unparseable expressions pass through
	}

	actual := resolveField(data, field)
	if actual == nil {
		return false
	}

	return compare(actual, op, value)
}

func parseExpression(expr string) (field, op, value string, ok bool) {
	operators := []string{"!=", ">=", "<=", "==", ">", "<", " contains "}
	for _, op := range operators {
		idx := strings.Index(expr, op)
		if idx >= 0 {
			field = strings.TrimSpace(expr[:idx])
			value = strings.TrimSpace(expr[idx+len(op):])
			// Strip surrounding quotes from value
			value = strings.Trim(value, `"'`)
			return field, strings.TrimSpace(op), value, field != ""
		}
	}
	return "", "", "", false
}

func resolveField(data map[string]any, field string) any {
	parts := strings.Split(field, ".")
	var current any = data
	for _, part := range parts {
		m, ok := current.(map[string]any)
		if !ok {
			return nil
		}
		current, ok = m[part]
		if !ok {
			return nil
		}
	}
	return current
}

func compare(actual any, op, value string) bool {
	actualStr := fmt.Sprintf("%v", actual)

	switch op {
	case "==":
		return actualStr == value
	case "!=":
		return actualStr != value
	case "contains":
		return strings.Contains(actualStr, value)
	case ">", ">=", "<", "<=":
		actualNum, err1 := toFloat(actual)
		valueNum, err2 := strconv.ParseFloat(value, 64)
		if err1 != nil || err2 != nil {
			return false
		}
		switch op {
		case ">":
			return actualNum > valueNum
		case ">=":
			return actualNum >= valueNum
		case "<":
			return actualNum < valueNum
		case "<=":
			return actualNum <= valueNum
		}
	}
	return false
}

func toFloat(v any) (float64, error) {
	switch n := v.(type) {
	case float64:
		return n, nil
	case float32:
		return float64(n), nil
	case int:
		return float64(n), nil
	case int64:
		return float64(n), nil
	case json.Number:
		return n.Float64()
	case string:
		return strconv.ParseFloat(n, 64)
	default:
		return 0, fmt.Errorf("cannot convert %T to float", v)
	}
}
