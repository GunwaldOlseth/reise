package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGoogleHealthInfoHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/google-health/info", nil)
	rec := httptest.NewRecorder()
	googleHealthInfoHandler(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var info GoogleHealthInfo
	if err := json.Unmarshal(rec.Body.Bytes(), &info); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if info.APIBaseURL != googleHealthAPIBase {
		t.Fatalf("apiBaseUrl=%q", info.APIBaseURL)
	}
	if len(info.Scopes) == 0 || len(info.DataTypes) == 0 {
		t.Fatalf("expected scopes and dataTypes")
	}
}

func TestGoogleHealthDailyHandlerValidation(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/google-health/daily", strings.NewReader(`{"startDate":"2026-08-31","endDate":"2026-08-01"}`))
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	googleHealthDailyHandler(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for reversed dates, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestFetchGoogleHealthDailyAggregatesTypes(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method=%s", r.Method)
		}
		if !strings.Contains(r.URL.Path, "/dataPoints:dailyRollUp") {
			t.Fatalf("path=%s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-token" {
			t.Fatalf("auth=%q", got)
		}
		switch {
		case strings.Contains(r.URL.Path, "/dataTypes/steps/"):
			_, _ = w.Write([]byte(`{
				"rollupDataPoints": [{
					"civilStartTime": {"date": {"year": 2026, "month": 8, "day": 31}},
					"steps": {"countSum": "8421"}
				}]
			}`))
		case strings.Contains(r.URL.Path, "/dataTypes/distance/"):
			_, _ = w.Write([]byte(`{
				"rollupDataPoints": [{
					"civilStartTime": {"date": {"year": 2026, "month": 8, "day": 31}},
					"distance": {"millimetersSum": "6120500"}
				}]
			}`))
		case strings.Contains(r.URL.Path, "/dataTypes/active-minutes/"):
			_, _ = w.Write([]byte(`{
				"rollupDataPoints": [{
					"civilStartTime": {"date": {"year": 2026, "month": 8, "day": 31}},
					"activeMinutes": {"activeMinutesRollupByActivityLevel": [
						{"activeMinutesSum": "35"},
						{"activeMinutesSum": "20"}
					]}
				}]
			}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	oldClient := googleHealthHTTPClient
	oldBase := googleHealthAPIBase
	googleHealthHTTPClient = server.Client()
	googleHealthAPIBase = server.URL
	t.Cleanup(func() {
		googleHealthHTTPClient = oldClient
		googleHealthAPIBase = oldBase
	})

	out, code, msg := fetchGoogleHealthDaily(context.Background(), "test-token", GoogleHealthDailyRequest{
		StartDate: "2026-08-31",
		EndDate:   "2026-08-31",
		Types:     []string{"steps", "distance", "active-minutes"},
	})
	if msg != "" {
		t.Fatalf("msg=%q code=%d", msg, code)
	}
	if code != http.StatusOK {
		t.Fatalf("code=%d", code)
	}
	if len(out.Days) != 1 {
		t.Fatalf("days=%d", len(out.Days))
	}
	day := out.Days[0]
	if day.Steps == nil || *day.Steps != 8421 {
		t.Fatalf("steps=%v", day.Steps)
	}
	if day.DistanceMeters == nil || *day.DistanceMeters != 6120.5 {
		t.Fatalf("distance=%v", day.DistanceMeters)
	}
	if day.ActiveMinutes == nil || *day.ActiveMinutes != 55 {
		t.Fatalf("activeMinutes=%v", day.ActiveMinutes)
	}
}

func TestHealthConnectIngestValidation(t *testing.T) {
	out := ingestHealthConnectRecords(HealthConnectIngestRequest{
		TripID: "trip_1",
		Records: []HealthConnectRecordIn{
			{RecordID: "r1", Type: "steps", StartTime: "2026-08-31T10:00:00Z", Value: 100},
			{RecordID: "", Type: "steps", StartTime: "2026-08-31T10:00:00Z"},
			{RecordID: "r1", Type: "steps", StartTime: "2026-08-31T10:00:00Z", Value: 200},
		},
	})
	if out.Accepted != 1 || out.Skipped != 2 {
		t.Fatalf("accepted=%d skipped=%d", out.Accepted, out.Skipped)
	}
}

func TestNormalizeGoogleHealthTypes(t *testing.T) {
	got := normalizeGoogleHealthTypes([]string{"STEPS", "bogus", "steps", "distance"})
	if len(got) != 2 || got[0] != "steps" || got[1] != "distance" {
		t.Fatalf("got=%v", got)
	}
}
