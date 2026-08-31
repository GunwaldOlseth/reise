package main

import (
	"encoding/json"
	"testing"
)

func TestNormalizeJourneyLiveDailySteps(t *testing.T) {
	raw := `{
		"tripId": "t1",
		"stops": [],
		"legs": [],
		"liveDailySteps": [
			{"date": "2026-09-03", "steps": 12500},
			{"date": "2026-09-03", "steps": 999},
			{"date": "", "steps": 100},
			{"date": "2026-09-01", "steps": -5}
		]
	}`
	var j Journey
	if err := json.Unmarshal([]byte(raw), &j); err != nil {
		t.Fatal(err)
	}
	normalizeJourney(&j)
	if len(j.LiveDailySteps) != 2 {
		t.Fatalf("expected 2 step rows, got %d", len(j.LiveDailySteps))
	}
	if j.LiveDailySteps[0].Date != "2026-09-01" || j.LiveDailySteps[0].Steps != 0 {
		t.Fatalf("first row: %v", j.LiveDailySteps[0])
	}
	if j.LiveDailySteps[1].Date != "2026-09-03" || j.LiveDailySteps[1].Steps != 12500 {
		t.Fatalf("second row: %v", j.LiveDailySteps[1])
	}
}
