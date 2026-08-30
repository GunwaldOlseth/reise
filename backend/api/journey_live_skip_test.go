package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestJourneyLiveActivitySkipItemJSONRoundTrip(t *testing.T) {
	raw := []byte(`{
		"tripId": "trip_1",
		"stops": [],
		"legs": [],
		"liveActivitySkips": [
			{
				"date": "2026-09-02",
				"stopId": "stop_rapallo",
				"dayOffset": 1,
				"activityId": "act_vernazza"
			},
			{
				"date": "2026-09-02",
				"stopId": "stop_rapallo",
				"dayOffset": 1
			}
		]
	}`)

	var j Journey
	if err := json.Unmarshal(raw, &j); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(j.LiveActivitySkips) != 2 {
		t.Fatalf("expected 2 skips, got %d", len(j.LiveActivitySkips))
	}
	if j.LiveActivitySkips[0].ActivityID != "act_vernazza" {
		t.Fatalf("activityId=%q", j.LiveActivitySkips[0].ActivityID)
	}

	normalizeJourney(&j)
	if len(j.LiveActivitySkips) != 2 {
		t.Fatalf("after normalize expected 2 skips, got %d", len(j.LiveActivitySkips))
	}
	for _, s := range j.LiveActivitySkips {
		if s.ActivityID == " act_vernazza " {
			t.Fatal("activityId should be trimmed")
		}
	}

	out, err := json.Marshal(j)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	body := string(out)
	if !strings.Contains(body, `"activityId":"act_vernazza"`) {
		t.Fatalf("response JSON missing activityId:\n%s", body)
	}
}
