package service

import (
	"encoding/json"
	"fmt"
	"sort"

	"github.com/fuseone/api-gateway/internal/model"
)

// ComputeDiff compares two JSON objects and returns a DiffResult describing
// all added, removed, and changed paths.
func ComputeDiff(oldJSON, newJSON json.RawMessage) (*model.DiffResult, error) {
	var oldMap, newMap map[string]interface{}
	if err := json.Unmarshal(oldJSON, &oldMap); err != nil {
		return nil, fmt.Errorf("parsing old JSON: %w", err)
	}
	if err := json.Unmarshal(newJSON, &newMap); err != nil {
		return nil, fmt.Errorf("parsing new JSON: %w", err)
	}

	result := &model.DiffResult{}
	diffMaps(result, "", oldMap, newMap)
	return result, nil
}

func diffMaps(result *model.DiffResult, prefix string, oldMap, newMap map[string]interface{}) {
	// Collect all keys from both maps
	allKeys := map[string]bool{}
	for k := range oldMap {
		allKeys[k] = true
	}
	for k := range newMap {
		allKeys[k] = true
	}

	// Sort for deterministic output
	keys := make([]string, 0, len(allKeys))
	for k := range allKeys {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, key := range keys {
		path := key
		if prefix != "" {
			path = prefix + "." + key
		}

		oldVal, inOld := oldMap[key]
		newVal, inNew := newMap[key]

		if !inOld {
			result.Added = append(result.Added, model.DiffEntry{
				Path:     path,
				NewValue: newVal,
			})
			continue
		}
		if !inNew {
			result.Removed = append(result.Removed, model.DiffEntry{
				Path:     path,
				OldValue: oldVal,
			})
			continue
		}

		// Both exist — recurse into nested maps
		oldChild, oldIsMap := oldVal.(map[string]interface{})
		newChild, newIsMap := newVal.(map[string]interface{})
		if oldIsMap && newIsMap {
			diffMaps(result, path, oldChild, newChild)
			continue
		}

		// Compare arrays element by element
		oldArr, oldIsArr := oldVal.([]interface{})
		newArr, newIsArr := newVal.([]interface{})
		if oldIsArr && newIsArr {
			diffArrays(result, path, oldArr, newArr)
			continue
		}

		// Scalar comparison
		if !jsonEqual(oldVal, newVal) {
			result.Changed = append(result.Changed, model.DiffEntry{
				Path:     path,
				OldValue: oldVal,
				NewValue: newVal,
			})
		}
	}
}

func diffArrays(result *model.DiffResult, path string, oldArr, newArr []interface{}) {
	maxLen := len(oldArr)
	if len(newArr) > maxLen {
		maxLen = len(newArr)
	}

	for i := 0; i < maxLen; i++ {
		elemPath := fmt.Sprintf("%s[%d]", path, i)

		if i >= len(oldArr) {
			result.Added = append(result.Added, model.DiffEntry{
				Path:     elemPath,
				NewValue: newArr[i],
			})
			continue
		}
		if i >= len(newArr) {
			result.Removed = append(result.Removed, model.DiffEntry{
				Path:     elemPath,
				OldValue: oldArr[i],
			})
			continue
		}

		// Both exist — recurse if both are maps
		oldChild, oldIsMap := oldArr[i].(map[string]interface{})
		newChild, newIsMap := newArr[i].(map[string]interface{})
		if oldIsMap && newIsMap {
			diffMaps(result, elemPath, oldChild, newChild)
			continue
		}

		if !jsonEqual(oldArr[i], newArr[i]) {
			result.Changed = append(result.Changed, model.DiffEntry{
				Path:     elemPath,
				OldValue: oldArr[i],
				NewValue: newArr[i],
			})
		}
	}
}

// jsonEqual compares two values by marshaling to JSON.
func jsonEqual(a, b interface{}) bool {
	aj, _ := json.Marshal(a)
	bj, _ := json.Marshal(b)
	return string(aj) == string(bj)
}
