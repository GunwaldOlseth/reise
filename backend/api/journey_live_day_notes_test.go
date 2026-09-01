package main

import (
	"encoding/json"
	"testing"
)

func TestNormalizeJourneyLiveDailyCommentsAndPhotos(t *testing.T) {
	raw := []byte(`{
		"tripId": "t1",
		"liveDailyComments": [
			{"id": "c2", "date": "2026-09-03", "text": "  B  ", "sortOrder": 1},
			{"id": "", "date": "2026-09-02", "text": "A", "sortOrder": 0},
			{"date": "", "text": "skip me"}
		],
		"liveDailyPhotos": [
			{"id": "p2", "date": "2026-09-03", "url": "/api/uploads/b.png", "sortOrder": 1},
			{"id": "", "date": "2026-09-02", "url": "/api/uploads/a.png"},
			{"date": "2026-09-02", "url": ""}
		]
	}`)
	var j Journey
	if err := json.Unmarshal(raw, &j); err != nil {
		t.Fatal(err)
	}
	normalizeJourney(&j)
	if len(j.LiveDailyComments) != 2 {
		t.Fatalf("expected 2 comments, got %d", len(j.LiveDailyComments))
	}
	if j.LiveDailyComments[0].Date != "2026-09-02" || j.LiveDailyComments[0].Text != "A" {
		t.Fatalf("first comment: %+v", j.LiveDailyComments[0])
	}
	if j.LiveDailyComments[0].ID == "" {
		t.Fatal("expected generated comment id")
	}
	if j.LiveDailyComments[1].Date != "2026-09-03" || j.LiveDailyComments[1].Text != "B" {
		t.Fatalf("second comment: %+v", j.LiveDailyComments[1])
	}
	if len(j.LiveDailyPhotos) != 2 {
		t.Fatalf("expected 2 photos, got %d", len(j.LiveDailyPhotos))
	}
	if j.LiveDailyPhotos[0].Date != "2026-09-02" || j.LiveDailyPhotos[0].URL != "/api/uploads/a.png" {
		t.Fatalf("first photo: %+v", j.LiveDailyPhotos[0])
	}
	if j.LiveDailyPhotos[0].ID == "" {
		t.Fatal("expected generated photo id")
	}
	if j.LiveDailyPhotos[1].ID != "p2" {
		t.Fatalf("second photo id: %s", j.LiveDailyPhotos[1].ID)
	}
}
