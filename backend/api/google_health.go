package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const defaultGoogleHealthAPIBase = "https://health.googleapis.com"

var googleHealthAPIBase = defaultGoogleHealthAPIBase
var googleHealthHTTPClient = http.DefaultClient

// GoogleHealthInfo describes how the backend integrates with Google Health.
type GoogleHealthInfo struct {
	APIBaseURL string   `json:"apiBaseUrl"`
	Scopes     []string `json:"scopes"`
	DataTypes  []string `json:"dataTypes"`
	Notes      []string `json:"notes"`
}

// GoogleHealthDailyRequest asks for daily rollup values in a date range.
type GoogleHealthDailyRequest struct {
	StartDate string   `json:"startDate"` // YYYY-MM-DD inclusive
	EndDate   string   `json:"endDate"`   // YYYY-MM-DD inclusive
	Types     []string `json:"types,omitempty"`
}

// GoogleHealthDailyDay is one day of normalized health metrics.
type GoogleHealthDailyDay struct {
	Date            string   `json:"date"`
	Steps           *int64   `json:"steps,omitempty"`
	DistanceMeters  *float64 `json:"distanceMeters,omitempty"`
	ActiveMinutes   *int64   `json:"activeMinutes,omitempty"`
	ActiveCaloriesKcal *float64 `json:"activeCaloriesKcal,omitempty"`
}

// GoogleHealthDailyResponse is the normalized daily rollup payload.
type GoogleHealthDailyResponse struct {
	StartDate string                 `json:"startDate"`
	EndDate   string                 `json:"endDate"`
	Days      []GoogleHealthDailyDay `json:"days"`
	Warnings  []string               `json:"warnings,omitempty"`
}

// HealthConnectIngestRequest accepts Health Connect records relayed from Android.
type HealthConnectIngestRequest struct {
	TripID  string                   `json:"tripId,omitempty"`
	Records []HealthConnectRecordIn  `json:"records"`
}

// HealthConnectRecordIn is one normalized Health Connect record uploaded by a client app.
type HealthConnectRecordIn struct {
	RecordID  string  `json:"recordId"`
	Type      string  `json:"type"` // steps | distance | active_calories | sleep | other
	StartTime string  `json:"startTime"` // RFC3339
	EndTime   string  `json:"endTime,omitempty"`
	Value     float64 `json:"value,omitempty"`
	Unit      string  `json:"unit,omitempty"`
	Source    string  `json:"source,omitempty"`
}

// HealthConnectIngestResponse summarizes an ingest batch.
type HealthConnectIngestResponse struct {
	Accepted int      `json:"accepted"`
	Skipped  int      `json:"skipped"`
	Warnings []string `json:"warnings,omitempty"`
}

type googleHealthDailyRollUpRequest struct {
	WindowSizeDays   int                      `json:"windowSizeDays,omitempty"`
	DataSourceFamily string                   `json:"dataSourceFamily,omitempty"`
	Range            googleHealthCivilRange   `json:"range"`
}

type googleHealthCivilRange struct {
	Start googleHealthCivilDateTime `json:"start"`
	End   googleHealthCivilDateTime `json:"end"`
}

type googleHealthCivilDateTime struct {
	Date googleHealthDate `json:"date"`
}

type googleHealthDate struct {
	Year  int `json:"year"`
	Month int `json:"month"`
	Day   int `json:"day"`
}

type googleHealthDailyRollUpResponse struct {
	RollupDataPoints []googleHealthDailyRollupPoint `json:"rollupDataPoints"`
	NextPageToken    string                         `json:"nextPageToken,omitempty"`
}

type googleHealthDailyRollupPoint struct {
	CivilStartTime googleHealthCivilDateTime `json:"civilStartTime"`
	Steps          *googleHealthStepsRollup    `json:"steps,omitempty"`
	Distance       *googleHealthDistanceRollup `json:"distance,omitempty"`
	ActiveMinutes  *googleHealthActiveMinutesRollup `json:"activeMinutes,omitempty"`
	ActiveEnergyBurned *googleHealthActiveEnergyRollup `json:"activeEnergyBurned,omitempty"`
}

type googleHealthStepsRollup struct {
	CountSum string `json:"countSum"`
}

type googleHealthDistanceRollup struct {
	MillimetersSum string `json:"millimetersSum"`
}

type googleHealthActiveMinutesRollup struct {
	ActiveMinutesRollupByActivityLevel []struct {
		ActiveMinutesSum string `json:"activeMinutesSum"`
	} `json:"activeMinutesRollupByActivityLevel"`
}

type googleHealthActiveEnergyRollup struct {
	KcalSum float64 `json:"kcalSum"`
}

func googleHealthInfoHandler(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, GoogleHealthInfo{
		APIBaseURL: googleHealthAPIBase,
		Scopes: []string{
			"https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
			"https://www.googleapis.com/auth/googlehealth.sleep.readonly",
		},
		DataTypes: []string{"steps", "distance", "active-minutes", "active-energy-burned"},
		Notes: []string{
			"Google Health Connect har ingen server-API. Android-app leser lokalt og kan POSTe til /api/google-health/ingest.",
			"For skydata (Fitbit/Pixel m.m.) bruker du brukerens Google OAuth-token med Health-scopes mot /api/google-health/daily.",
			"Health-scopes er restriktive og krever Google app verification for mer enn 100 brukere.",
		},
	})
}

func googleHealthDailyHandler(w http.ResponseWriter, r *http.Request) {
	token, err := bearerToken(r)
	if err != nil {
		respondWithError(w, http.StatusUnauthorized, err.Error())
		return
	}

	var req GoogleHealthDailyRequest
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}

	out, code, msg := fetchGoogleHealthDaily(r.Context(), token, req)
	if msg != "" {
		respondWithError(w, code, msg)
		return
	}
	respondWithJSON(w, http.StatusOK, out)
}

func googleHealthIngestHandler(w http.ResponseWriter, r *http.Request) {
	var req HealthConnectIngestRequest
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	out := ingestHealthConnectRecords(req)
	respondWithJSON(w, http.StatusOK, out)
}

func bearerToken(r *http.Request) (string, error) {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if auth == "" {
		return "", fmt.Errorf("Missing Authorization: Bearer <google_access_token>")
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(auth, prefix) {
		return "", fmt.Errorf("Authorization must use Bearer scheme")
	}
	token := strings.TrimSpace(strings.TrimPrefix(auth, prefix))
	if token == "" {
		return "", fmt.Errorf("Empty bearer token")
	}
	return token, nil
}

func fetchGoogleHealthDaily(ctx context.Context, accessToken string, req GoogleHealthDailyRequest) (GoogleHealthDailyResponse, int, string) {
	start, err := parseISODate(req.StartDate)
	if err != nil {
		return GoogleHealthDailyResponse{}, http.StatusBadRequest, "Invalid startDate (use YYYY-MM-DD)"
	}
	end, err := parseISODate(req.EndDate)
	if err != nil {
		return GoogleHealthDailyResponse{}, http.StatusBadRequest, "Invalid endDate (use YYYY-MM-DD)"
	}
	if end.Before(start) {
		return GoogleHealthDailyResponse{}, http.StatusBadRequest, "endDate must be on or after startDate"
	}
	if end.Sub(start) > 90*24*time.Hour {
		return GoogleHealthDailyResponse{}, http.StatusBadRequest, "Date range may be at most 90 days"
	}

	types := normalizeGoogleHealthTypes(req.Types)
	byDate := map[string]*GoogleHealthDailyDay{}
	warnings := []string{}

	for _, dataType := range types {
		points, warn, err := googleHealthDailyRollUp(ctx, accessToken, dataType, start, end.AddDate(0, 0, 1))
		if warn != "" {
			warnings = append(warnings, warn)
		}
		if err != nil {
			return GoogleHealthDailyResponse{}, http.StatusBadGateway, err.Error()
		}
		for _, point := range points {
			date := civilDateToISO(point.CivilStartTime.Date)
			if date == "" {
				continue
			}
			day := byDate[date]
			if day == nil {
				day = &GoogleHealthDailyDay{Date: date}
				byDate[date] = day
			}
			applyGoogleHealthRollup(day, dataType, point)
		}
	}

	days := make([]GoogleHealthDailyDay, 0, len(byDate))
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		iso := d.Format("2006-01-02")
		if day, ok := byDate[iso]; ok {
			days = append(days, *day)
		} else {
			days = append(days, GoogleHealthDailyDay{Date: iso})
		}
	}

	return GoogleHealthDailyResponse{
		StartDate: start.Format("2006-01-02"),
		EndDate:   end.Format("2006-01-02"),
		Days:      days,
		Warnings:  warnings,
	}, http.StatusOK, ""
}

func normalizeGoogleHealthTypes(list []string) []string {
	defaults := []string{"steps", "distance", "active-minutes"}
	if len(list) == 0 {
		return defaults
	}
	allowed := map[string]bool{
		"steps":                true,
		"distance":             true,
		"active-minutes":       true,
		"active-energy-burned": true,
	}
	out := make([]string, 0, len(list))
	seen := map[string]bool{}
	for _, raw := range list {
		t := strings.ToLower(strings.TrimSpace(raw))
		if !allowed[t] || seen[t] {
			continue
		}
		seen[t] = true
		out = append(out, t)
	}
	if len(out) == 0 {
		return defaults
	}
	return out
}

func googleHealthDailyRollUp(
	ctx context.Context,
	accessToken, dataType string,
	start, endExclusive time.Time,
) ([]googleHealthDailyRollupPoint, string, error) {
	parent := fmt.Sprintf("users/me/dataTypes/%s", dataType)
	url := strings.TrimRight(googleHealthAPIBase, "/") + "/v4/" + parent + "/dataPoints:dailyRollUp"
	body := googleHealthDailyRollUpRequest{
		WindowSizeDays:   1,
		DataSourceFamily: "users/me/dataSourceFamilies/all-sources",
		Range: googleHealthCivilRange{
			Start: googleHealthCivilDateTime{Date: timeToGoogleDate(start)},
			End:   googleHealthCivilDateTime{Date: timeToGoogleDate(endExclusive)},
		},
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, "", fmt.Errorf("Failed to encode Google Health request")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	res, err := googleHealthHTTPClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("Google Health request failed: %w", err)
	}
	defer res.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, "", fmt.Errorf("Failed to read Google Health response")
	}
	if res.StatusCode >= 400 {
		msg := googleHealthErrorMessage(raw, res.StatusCode)
		return nil, "", fmt.Errorf("Google Health API (%d): %s", res.StatusCode, msg)
	}

	var parsed googleHealthDailyRollUpResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, "", fmt.Errorf("Invalid Google Health response JSON")
	}
	warn := ""
	if parsed.NextPageToken != "" {
		warn = fmt.Sprintf("Google Health returned a page token for %s; only the first page was fetched", dataType)
	}
	return parsed.RollupDataPoints, warn, nil
}

func googleHealthErrorMessage(raw []byte, status int) string {
	var payload struct {
		Error struct {
			Message string `json:"message"`
			Status  string `json:"status"`
		} `json:"error"`
	}
	if json.Unmarshal(raw, &payload) == nil {
		msg := strings.TrimSpace(payload.Error.Message)
		if msg != "" {
			return msg
		}
	}
	text := strings.TrimSpace(string(raw))
	if text == "" {
		if status == http.StatusForbidden {
			return "Access denied — sjekk at Google Health API er aktivert og at token har riktige scopes"
		}
		return http.StatusText(status)
	}
	if len(text) > 240 {
		return text[:240] + "…"
	}
	return text
}

func applyGoogleHealthRollup(day *GoogleHealthDailyDay, dataType string, point googleHealthDailyRollupPoint) {
	switch dataType {
	case "steps":
		if point.Steps != nil {
			if v, ok := parseInt64String(point.Steps.CountSum); ok {
				day.Steps = &v
			}
		}
	case "distance":
		if point.Distance != nil {
			if mm, ok := parseInt64String(point.Distance.MillimetersSum); ok {
				meters := float64(mm) / 1000.0
				day.DistanceMeters = &meters
			}
		}
	case "active-minutes":
		if point.ActiveMinutes != nil {
			var total int64
			for _, row := range point.ActiveMinutes.ActiveMinutesRollupByActivityLevel {
				if v, ok := parseInt64String(row.ActiveMinutesSum); ok {
					total += v
				}
			}
			if total > 0 {
				day.ActiveMinutes = &total
			}
		}
	case "active-energy-burned":
		if point.ActiveEnergyBurned != nil && point.ActiveEnergyBurned.KcalSum > 0 {
			v := point.ActiveEnergyBurned.KcalSum
			day.ActiveCaloriesKcal = &v
		}
	}
}

func ingestHealthConnectRecords(req HealthConnectIngestRequest) HealthConnectIngestResponse {
	accepted := 0
	skipped := 0
	warnings := []string{}
	seen := map[string]bool{}

	for _, rec := range req.Records {
		id := strings.TrimSpace(rec.RecordID)
		typ := strings.ToLower(strings.TrimSpace(rec.Type))
		start := strings.TrimSpace(rec.StartTime)
		if id == "" || typ == "" || start == "" {
			skipped++
			continue
		}
		key := id + "\x00" + typ
		if seen[key] {
			skipped++
			continue
		}
		seen[key] = true
		accepted++
	}

	if req.TripID == "" {
		warnings = append(warnings, "Ingen tripId — data ble validert men ikke lagret (Firestore-lagring kommer senere)")
	} else if db == nil {
		warnings = append(warnings, "Database ikke tilgjengelig — data ble validert men ikke lagret")
	}

	return HealthConnectIngestResponse{
		Accepted: accepted,
		Skipped:  skipped,
		Warnings: warnings,
	}
}

func parseISODate(raw string) (time.Time, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty date")
	}
	return time.Parse("2006-01-02", s)
}

func timeToGoogleDate(t time.Time) googleHealthDate {
	return googleHealthDate{
		Year:  t.Year(),
		Month: int(t.Month()),
		Day:   t.Day(),
	}
}

func civilDateToISO(d googleHealthDate) string {
	if d.Year == 0 || d.Month == 0 || d.Day == 0 {
		return ""
	}
	return fmt.Sprintf("%04d-%02d-%02d", d.Year, d.Month, d.Day)
}

func parseInt64String(raw string) (int64, bool) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0, false
	}
	v, err := strconv.ParseInt(s, 10, 64)
	return v, err == nil
}

func parseFloatString(raw string) (float64, bool) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(s, 64)
	return v, err == nil
}
