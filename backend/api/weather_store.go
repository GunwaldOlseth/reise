package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
	"unicode"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
)

const (
	weatherArchiveCol     = "weather_archive"
	weatherSnapsCol       = "snaps"
	weatherSnapKeep       = 28
	weatherGlobalCooldown = 2 * time.Hour
)

type weatherSnap struct {
	FetchedAt string         `json:"fetchedAt" firestore:"fetchedAt"`
	Days      []weatherDay   `json:"days" firestore:"days"`
	Current   *weatherCurrent `json:"current,omitempty" firestore:"current,omitempty"`
}

type weatherHistoryResponse struct {
	City       string        `json:"city"`
	Country    string        `json:"country"`
	Latest     *weatherSnap  `json:"latest,omitempty"`
	Snapshots  []weatherSnap `json:"snapshots"`
	Resolution string        `json:"resolution"`
}

type weatherPlaceTarget struct {
	City    string
	Country string
}

var weatherPlaceClean = regexp.MustCompile(`_+`)

func weatherPlaceID(city, country string) string {
	raw := strings.ToLower(strings.TrimSpace(city) + "_" + strings.TrimSpace(country))
	var b strings.Builder
	for _, r := range raw {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	id := weatherPlaceClean.ReplaceAllString(strings.Trim(b.String(), "_"), "_")
	if id == "" {
		return "place"
	}
	if len(id) > 80 {
		return id[:80]
	}
	return id
}

func osloNow() time.Time {
	loc, err := time.LoadLocation("Europe/Oslo")
	if err != nil {
		return time.Now()
	}
	return time.Now().In(loc)
}

func osloTodayISO() string {
	return osloNow().Format("2006-01-02")
}

func addDaysISO(iso string, n int) string {
	t, err := time.Parse("2006-01-02", strings.TrimSpace(iso))
	if err != nil {
		return ""
	}
	return t.AddDate(0, 0, n).Format("2006-01-02")
}

// Two buckets a day (morning / evening) is enough for forecast drift.
func weatherSnapBucket(t time.Time) string {
	loc, err := time.LoadLocation("Europe/Oslo")
	if err == nil {
		t = t.In(loc)
	}
	hour := 8
	if t.Hour() >= 14 {
		hour = 19
	}
	return fmt.Sprintf("%s-%02d", t.Format("2006-01-02"), hour)
}

func saveWeatherSnapshot(ctx context.Context, city, country string, days []weatherDay, current *weatherCurrent) {
	if db == nil || len(days) == 0 {
		return
	}
	now := osloNow()
	id := weatherPlaceID(city, country)
	snapID := weatherSnapBucket(now)
	snap := weatherSnap{
		FetchedAt: now.Format(time.RFC3339),
		Days:      days,
		Current:   current,
	}
	ref := db.Collection(weatherArchiveCol).Doc(id)
	if _, err := ref.Set(ctx, map[string]interface{}{
		"city":      city,
		"country":   country,
		"updatedAt": now,
	}); err != nil {
		log.Printf("[Weather] archive meta %s: %v", id, err)
		return
	}
	if _, err := ref.Collection(weatherSnapsCol).Doc(snapID).Set(ctx, snap); err != nil {
		log.Printf("[Weather] archive snap %s/%s: %v", id, snapID, err)
		return
	}
	pruneWeatherSnapsRef(ctx, id)
}

func pruneWeatherSnapsRef(ctx context.Context, placeID string) {
	iter := db.Collection(weatherArchiveCol).Doc(placeID).Collection(weatherSnapsCol).Documents(ctx)
	type item struct {
		id string
	}
	var ids []string
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return
		}
		ids = append(ids, doc.Ref.ID)
	}
	sort.Strings(ids)
	if len(ids) <= weatherSnapKeep {
		return
	}
	drop := ids[:len(ids)-weatherSnapKeep]
	for _, id := range drop {
		_, _ = db.Collection(weatherArchiveCol).Doc(placeID).Collection(weatherSnapsCol).Doc(id).Delete(ctx)
	}
}

func parseWeatherSnapTime(snap weatherSnap) time.Time {
	t, err := time.Parse(time.RFC3339, strings.TrimSpace(snap.FetchedAt))
	if err != nil {
		return time.Time{}
	}
	return t
}

func latestWeatherSnap(ctx context.Context, city, country string) *weatherSnap {
	if db == nil {
		return nil
	}
	id := weatherPlaceID(city, country)
	col := db.Collection(weatherArchiveCol).Doc(id).Collection(weatherSnapsCol)
	iter := col.OrderBy("fetchedAt", firestore.Desc).Limit(1).Documents(ctx)
	doc, err := iter.Next()
	if err != nil {
		hist, herr := loadWeatherHistory(ctx, city, country)
		if herr != nil || hist.Latest == nil || len(hist.Latest.Days) == 0 {
			return nil
		}
		latest := *hist.Latest
		return &latest
	}
	var snap weatherSnap
	if err := doc.DataTo(&snap); err != nil || len(snap.Days) == 0 {
		return nil
	}
	return &snap
}

func weatherResponseFromSnap(city, country, requestedDate string, snap weatherSnap) weatherResponse {
	todayISO := osloTodayISO()
	days := append([]weatherDay(nil), snap.Days...)
	forecast := make([]weatherDay, 0, len(days))
	var today *weatherDay
	for i := range days {
		days[i].IsToday = days[i].Date == todayISO
		if days[i].IsToday {
			copyDay := days[i]
			today = &copyDay
		} else {
			forecast = append(forecast, days[i])
		}
	}
	out := weatherResponse{
		City:             city,
		Country:          country,
		Today:            today,
		Current:          snap.Current,
		Forecast:         forecast,
		Days:             days,
		RequestedDate:    requestedDate,
		RequestedInRange: false,
		Source:           "archive",
	}
	if requestedDate != "" {
		for i := range days {
			if days[i].Date == requestedDate {
				copyDay := days[i]
				out.Requested = &copyDay
				out.RequestedInRange = true
				break
			}
		}
	}
	return out
}

// Normal page loads use Firestore when a snapshot exists.
// After two hours we never call Open-Meteo automatically (cron and Oppdater still do).
func shouldServeWeatherFromArchive(snap *weatherSnap, force bool) bool {
	return !force && snap != nil && len(snap.Days) > 0
}

func loadWeatherHistory(ctx context.Context, city, country string) (weatherHistoryResponse, error) {
	out := weatherHistoryResponse{
		City:       city,
		Country:    country,
		Snapshots:  []weatherSnap{},
		Resolution: "to ganger om dagen (morgen og kveld)",
	}
	if db == nil {
		return out, nil
	}
	iter := db.Collection(weatherArchiveCol).Doc(weatherPlaceID(city, country)).
		Collection(weatherSnapsCol).Documents(ctx)
	var snaps []weatherSnap
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return out, err
		}
		var snap weatherSnap
		if err := doc.DataTo(&snap); err != nil {
			continue
		}
		snaps = append(snaps, snap)
	}
	sort.Slice(snaps, func(i, j int) bool {
		return snaps[i].FetchedAt < snaps[j].FetchedAt
	})
	out.Snapshots = snaps
	if len(snaps) > 0 {
		latest := snaps[len(snaps)-1]
		out.Latest = &latest
	}
	return out, nil
}

func collectUpcomingWeatherPlaces(ctx context.Context) []weatherPlaceTarget {
	today := osloTodayISO()
	horizon := addDaysISO(today, 45)
	past := addDaysISO(today, -2)
	seen := map[string]weatherPlaceTarget{}
	iter := db.Collection(journeysCollection).Documents(ctx)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("[Weather] list journeys: %v", err)
			break
		}
		var j Journey
		if err := doc.DataTo(&j); err != nil {
			continue
		}
		normalizeJourney(&j)
		for _, stop := range j.Stops {
			add := func(city, country, date string) {
				city = strings.TrimSpace(city)
				if city == "" || date == "" {
					return
				}
				if date < past || date > horizon {
					return
				}
				key := strings.ToLower(city) + "|" + strings.ToLower(strings.TrimSpace(country))
				seen[key] = weatherPlaceTarget{City: city, Country: strings.TrimSpace(country)}
			}
			if isPackageKind(stop.Kind) && stop.Pack != nil {
				nights := stop.Pack.Nights
				if nights < 1 {
					nights = 1
				}
				byOff := map[int]JourneyPackageDay{}
				for _, d := range stop.Pack.Days {
					byOff[d.Offset] = d
				}
				for off := 0; off <= nights; off++ {
					day := byOff[off]
					if day.AtSea {
						continue
					}
					city := strings.TrimSpace(day.City)
					if city == "" && (off == 0 || off == nights) {
						city = strings.TrimSpace(stop.Pack.BasePlace)
						if city == "" {
							city = stop.City
						}
					}
					country := strings.TrimSpace(day.Country)
					if country == "" {
						country = stop.Pack.BaseCountry
						if country == "" {
							country = stop.Country
						}
					}
					add(city, country, addDaysISO(stop.ArriveDate, off))
				}
				continue
			}
			if stop.City == "" || stop.ArriveDate == "" {
				continue
			}
			nights := 1
			if stop.Stay != nil && stop.Stay.Nights > 0 {
				nights = stop.Stay.Nights
			}
			for i := 0; i < nights; i++ {
				add(stop.City, stop.Country, addDaysISO(stop.ArriveDate, i))
			}
		}
	}
	out := make([]weatherPlaceTarget, 0, len(seen))
	for _, p := range seen {
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].City == out[j].City {
			return out[i].Country < out[j].Country
		}
		return out[i].City < out[j].City
	})
	return out
}

func refreshWeatherArchive(ctx context.Context) (ok, fail int) {
	places := collectUpcomingWeatherPlaces(ctx)
	log.Printf("[Weather] archive refresh %d places", len(places))
	for i, p := range places {
		if i > 0 {
			time.Sleep(450 * time.Millisecond)
		}
		place, _, err := resolvePlace(p.City, p.Country)
		if err != nil {
			log.Printf("[Weather] archive geocode %q: %v", p.City, err)
			fail++
			continue
		}
		data, err := fetchForecast(place.Latitude, place.Longitude, 7)
		if err != nil {
			log.Printf("[Weather] archive forecast %q: %v", p.City, err)
			fail++
			continue
		}
		_, _, days := buildWeatherDays(data)
		var current *weatherCurrent
		if data.Current != nil {
			code := data.currentCode()
			summary, icon := weatherCodeInfo(code)
			current = &weatherCurrent{
				Temperature: data.Current.Temperature,
				WeatherCode: code,
				Summary:     summary,
				Icon:        icon,
			}
		}
		saveWeatherSnapshot(ctx, localizeCity(place.Name), localizeCountry(place.Country), days, current)
		ok++
	}
	return ok, fail
}

func runScheduledWeatherRefresh(w http.ResponseWriter, r *http.Request) {
	if !requireCronSecret(w, r) {
		return
	}
	ok, fail := refreshWeatherArchive(r.Context())
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"ok":         ok,
		"failed":     fail,
		"resolution": "2x/day",
	})
}

func getWeatherHistory(w http.ResponseWriter, r *http.Request) {
	city := strings.TrimSpace(r.URL.Query().Get("city"))
	country := strings.TrimSpace(r.URL.Query().Get("country"))
	if city == "" {
		respondWithError(w, http.StatusBadRequest, "city is required")
		return
	}
	out, err := loadWeatherHistory(r.Context(), city, country)
	if err != nil {
		log.Printf("[Weather] history %q: %v", city, err)
		respondWithError(w, http.StatusInternalServerError, "Kunne ikke hente værhistorikk")
		return
	}
	respondWithJSON(w, http.StatusOK, out)
}
