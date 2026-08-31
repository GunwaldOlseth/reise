package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestJourneyLiveEntryTravelersJSONRoundTrip(t *testing.T) {
	raw := []byte(`{
		"tripId": "trip_1",
		"stops": [],
		"legs": [],
		"live": [
			{
				"id": "live_1",
				"date": "2026-09-01",
				"kind": "food",
				"title": "Lunsj",
				"travelers": [" Gunwald ", "Kari", "Gunwald"]
			},
			{
				"id": "live_2",
				"date": "2026-09-01",
				"kind": "drink",
				"title": "Kaffe",
				"travelers": []
			}
		]
	}`)

	var j Journey
	if err := json.Unmarshal(raw, &j); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(j.Live) != 2 {
		t.Fatalf("expected 2 live entries, got %d", len(j.Live))
	}

	normalizeJourney(&j)
	if len(j.Live[0].Travelers) != 2 {
		t.Fatalf("after normalize expected 2 unique travelers, got %v", j.Live[0].Travelers)
	}
	if j.Live[0].Travelers[0] != "Gunwald" || j.Live[0].Travelers[1] != "Kari" {
		t.Fatalf("travelers=%v", j.Live[0].Travelers)
	}

	out, err := json.Marshal(j)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	body := string(out)
	if !strings.Contains(body, `"travelers":["Gunwald","Kari"]`) {
		t.Fatalf("response JSON missing travelers:\n%s", body)
	}

	var again Journey
	if err := json.Unmarshal(out, &again); err != nil {
		t.Fatalf("round-trip unmarshal: %v", err)
	}
	normalizeJourney(&again)
	if len(again.Live[0].Travelers) != 2 {
		t.Fatalf("round-trip travelers=%v", again.Live[0].Travelers)
	}
}
