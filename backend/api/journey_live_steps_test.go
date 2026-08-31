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
			{"date": "2026-09-03", "traveler": "Gunwald", "steps": 12500},
			{"date": "2026-09-03", "traveler": "Gunwald", "steps": 999},
			{"date": "2026-09-03", "traveler": "Ros-Mari", "steps": 8000},
			{"date": "", "steps": 100},
			{"date": "2026-09-01", "steps": -5}
		]
	}`
	var j Journey
	if err := json.Unmarshal([]byte(raw), &j); err != nil {
		t.Fatal(err)
	}
	normalizeJourney(&j)
	if len(j.LiveDailySteps) != 3 {
		t.Fatalf("expected 3 step rows, got %d", len(j.LiveDailySteps))
	}
	if j.LiveDailySteps[0].Date != "2026-09-01" || j.LiveDailySteps[0].Steps != 0 {
		t.Fatalf("first row: %v", j.LiveDailySteps[0])
	}
	if j.LiveDailySteps[1].Date != "2026-09-03" || j.LiveDailySteps[1].Traveler != "Gunwald" || j.LiveDailySteps[1].Steps != 12500 {
		t.Fatalf("gunwald row: %v", j.LiveDailySteps[1])
	}
	if j.LiveDailySteps[2].Date != "2026-09-03" || j.LiveDailySteps[2].Traveler != "Ros-Mari" || j.LiveDailySteps[2].Steps != 8000 {
		t.Fatalf("ros-mari row: %v", j.LiveDailySteps[2])
	}
}
