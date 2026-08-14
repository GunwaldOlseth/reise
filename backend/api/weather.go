package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

var streetHintRe = regexp.MustCompile(`(?i)(\d|[øo]vregate|gate[n]?|gata|vei[en]?|väg|street|road|strada|platz|allee|avenue|boulevard)`)

// weatherDay is one calendar day's weather summary.
type weatherDay struct {
	Date          string  `json:"date"`
	TempMax       float64 `json:"tempMax"`
	TempMin       float64 `json:"tempMin"`
	Precipitation float64 `json:"precipitation"`
	WeatherCode   int     `json:"weatherCode"`
	Summary       string  `json:"summary"`
	Icon          string  `json:"icon"`
	IsToday       bool    `json:"isToday"`
}

type weatherCurrent struct {
	Temperature float64 `json:"temperature"`
	WeatherCode int     `json:"weatherCode"`
	Summary     string  `json:"summary"`
	Icon        string  `json:"icon"`
}

type weatherResponse struct {
	City             string          `json:"city"`
	Country          string          `json:"country"`
	Latitude         float64         `json:"latitude"`
	Longitude        float64         `json:"longitude"`
	Today            *weatherDay     `json:"today,omitempty"`
	Current          *weatherCurrent `json:"current,omitempty"`
	Forecast         []weatherDay    `json:"forecast"` // upcoming days within 1 week (excl. today)
	Days             []weatherDay    `json:"days"`     // today + forecast (max 7 days)
	RequestedDate    string          `json:"requestedDate,omitempty"`
	Requested        *weatherDay     `json:"requested,omitempty"`
	RequestedInRange bool            `json:"requestedInRange"`
	Source           string          `json:"source"`
}

type placeSuggestion struct {
	Name       string  `json:"name"`
	Country    string  `json:"country"`
	Admin1     string  `json:"admin1,omitempty"`
	Latitude   float64 `json:"latitude"`
	Longitude  float64 `json:"longitude"`
	Population int     `json:"population,omitempty"`
	FeatureCode string `json:"featureCode,omitempty"`
}

type weatherErrorBody struct {
	Error       string            `json:"error"`
	Suggestions []placeSuggestion `json:"suggestions,omitempty"`
}

type geoResult struct {
	Results []struct {
		Name        string  `json:"name"`
		Country     string  `json:"country"`
		Admin1      string  `json:"admin1"`
		Latitude    float64 `json:"latitude"`
		Longitude   float64 `json:"longitude"`
		Population  int     `json:"population"`
		FeatureCode string  `json:"feature_code"`
	} `json:"results"`
}

type meteoPayload struct {
	Current *struct {
		Temperature  float64 `json:"temperature_2m"`
		WeatherCode  int     `json:"weather_code"`
		WeatherCode2 int     `json:"weathercode"` // legacy alias
	} `json:"current"`
	Daily struct {
		Time             []string  `json:"time"`
		WeatherCode      []int     `json:"weather_code"`
		WeatherCodeLegacy []int    `json:"weathercode"`
		TemperatureMax   []float64 `json:"temperature_2m_max"`
		TemperatureMin   []float64 `json:"temperature_2m_min"`
		PrecipitationSum []float64 `json:"precipitation_sum"`
	} `json:"daily"`
}

func (m meteoPayload) dailyCodes() []int {
	if len(m.Daily.WeatherCode) > 0 {
		return m.Daily.WeatherCode
	}
	return m.Daily.WeatherCodeLegacy
}

func (m meteoPayload) currentCode() int {
	if m.Current == nil {
		return 0
	}
	if m.Current.WeatherCode != 0 {
		return m.Current.WeatherCode
	}
	return m.Current.WeatherCode2
}

func weatherCodeInfo(code int) (summary, icon string) {
	switch {
	case code == 0:
		return "Klart", "sun"
	case code == 1:
		return "Stort sett klart", "sun"
	case code == 2:
		return "Delvis skyet", "cloud-sun"
	case code == 3:
		return "Overskyet", "cloud"
	case code == 45 || code == 48:
		return "Tåke", "fog"
	case code >= 51 && code <= 57:
		return "Yr", "drizzle"
	case code >= 61 && code <= 67:
		return "Regn", "rain"
	case code >= 71 && code <= 77:
		return "Snø", "snow"
	case code >= 80 && code <= 82:
		return "Regnbyger", "rain"
	case code >= 85 && code <= 86:
		return "Snøbyger", "snow"
	case code >= 95 && code <= 99:
		return "Torden", "thunder"
	default:
		return "Vær", "cloud"
	}
}

func fetchJSON(urlStr string, dst interface{}) error {
	req, err := http.NewRequest(http.MethodGet, urlStr, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "ReisePlanlegger/1.0")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("upstream %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	return json.Unmarshal(body, dst)
}

func geoResultsToSuggestions(geo geoResult) []placeSuggestion {
	out := make([]placeSuggestion, 0, len(geo.Results))
	seen := map[string]bool{}
	for _, r := range geo.Results {
		key := strings.ToLower(strings.TrimSpace(r.Name) + "|" + strings.TrimSpace(r.Country) + "|" + strings.TrimSpace(r.Admin1))
		if r.Name == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, localizePlace(placeSuggestion{
			Name:        r.Name,
			Country:     r.Country,
			Admin1:      r.Admin1,
			Latitude:    r.Latitude,
			Longitude:   r.Longitude,
			Population:  r.Population,
			FeatureCode: r.FeatureCode,
		}))
	}
	sort.SliceStable(out, func(i, j int) bool {
		si, sj := placeRank(out[i]), placeRank(out[j])
		if si != sj {
			return si > sj
		}
		return out[i].Population > out[j].Population
	})
	return out
}

func placeRank(p placeSuggestion) int {
	score := p.Population
	switch p.FeatureCode {
	case "PPLC": // capital
		score += 5_000_000
	case "PPLA": // admin seat
		score += 1_000_000
	case "PPLA2":
		score += 200_000
	case "PPLA3":
		score += 100_000
	case "PPL":
		score += 10_000
	case "AIRP", "AIRH":
		score += 500_000
	case "ADDR":
		score += 2_000_000
	}
	return score
}

func countryAliases(name string) []string {
	n := strings.ToLower(strings.TrimSpace(name))
	switch n {
	case "italia", "italy", "italien":
		return []string{"italia", "italy", "italien"}
	case "spania", "spain", "spanien", "españa":
		return []string{"spania", "spain", "spanien", "españa"}
	case "frankrike", "france", "frankreich":
		return []string{"frankrike", "france", "frankreich"}
	case "norge", "norway", "norwegen":
		return []string{"norge", "norway", "norwegen"}
	default:
		if n == "" {
			return nil
		}
		return []string{n}
	}
}

func countriesLooselyMatch(a, b string) bool {
	a = strings.ToLower(strings.TrimSpace(a))
	b = strings.ToLower(strings.TrimSpace(b))
	if a == "" || b == "" {
		return false
	}
	if localizeCountry(a) != "" && localizeCountry(a) == localizeCountry(b) {
		return true
	}
	if a == b || strings.Contains(a, b) || strings.Contains(b, a) {
		return true
	}
	for _, x := range countryAliases(a) {
		for _, y := range countryAliases(b) {
			if x == y {
				return true
			}
		}
	}
	return false
}

func searchPlaces(name, language string, count int) ([]placeSuggestion, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, nil
	}
	if count < 1 {
		count = 1
	}
	if count > 10 {
		count = 10
	}
	if language == "" {
		language = "nb"
	}
	u := fmt.Sprintf(
		"https://geocoding-api.open-meteo.com/v1/search?name=%s&count=%d&language=%s&format=json",
		url.QueryEscape(name), count, url.QueryEscape(language),
	)
	var geo geoResult
	if err := fetchJSON(u, &geo); err != nil {
		return nil, err
	}
	return geoResultsToSuggestions(geo), nil
}

func mergePlaceSuggestions(lists ...[]placeSuggestion) []placeSuggestion {
	seen := map[string]bool{}
	out := []placeSuggestion{}
	for _, list := range lists {
		for _, p := range list {
			p = localizePlace(p)
			// Same coordinates = same place; first list wins (Norwegian first).
			key := fmt.Sprintf("%.3f|%.3f|%s", p.Latitude, p.Longitude, p.FeatureCode)
			if seen[key] {
				continue
			}
			seen[key] = true
			out = append(out, p)
		}
	}
	return out
}

// resolvePlace picks a geocoded place, or returns suggestions when the query is ambiguous/not found.
func resolvePlace(city, country string) (place placeSuggestion, suggestions []placeSuggestion, err error) {
	city = strings.TrimSpace(city)
	country = strings.TrimSpace(country)
	if city == "" {
		return placeSuggestion{}, nil, fmt.Errorf("city is required")
	}

	query := city
	if country != "" {
		query = city + ", " + country
	}

	primary, err := searchPlaces(query, "nb", 8)
	if err != nil {
		return placeSuggestion{}, nil, err
	}
	if len(primary) == 0 {
		primary, err = searchPlaces(query, "en", 8)
		if err != nil {
			return placeSuggestion{}, nil, err
		}
	}

	// Exact-ish hit: use first result from the full query.
	if len(primary) > 0 {
		return localizePlace(primary[0]), nil, nil
	}

	// Broader search without country / with prefix — return as choices.
	var alt []placeSuggestion
	if country != "" {
		byCity, err := searchPlaces(city, "nb", 8)
		if err != nil {
			return placeSuggestion{}, nil, err
		}
		byCityEn, _ := searchPlaces(city, "en", 8)
		alt = mergePlaceSuggestions(byCity, byCityEn)
	}
	if len(alt) == 0 && len([]rune(city)) >= 3 {
		runes := []rune(city)
		prefixLen := len(runes)
		if prefixLen > 4 {
			prefixLen = max(3, (prefixLen*2)/3)
		}
		prefix := string(runes[:prefixLen])
		byPrefix, err := searchPlaces(prefix, "nb", 8)
		if err != nil {
			return placeSuggestion{}, nil, err
		}
		byPrefixEn, _ := searchPlaces(prefix, "en", 8)
		alt = mergePlaceSuggestions(byPrefix, byPrefixEn)
	}
	if len(alt) > 8 {
		alt = alt[:8]
	}
	return placeSuggestion{}, alt, fmt.Errorf("fant ikke sted")
}

func atIndex(floats []float64, i int) float64 {
	if i < 0 || i >= len(floats) {
		return 0
	}
	return floats[i]
}

func atIndexInt(ints []int, i int) int {
	if i < 0 || i >= len(ints) {
		return 0
	}
	return ints[i]
}

// fetchForecast returns local daily weather. days=1 is today only; days=7 is today + week ahead.
// Uses forecast_days (not start_date/end_date) to avoid UTC/timezone range errors.
func fetchForecast(lat, lon float64, days int) (meteoPayload, error) {
	if days < 1 {
		days = 1
	}
	if days > 7 {
		days = 7
	}
	u := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&current=temperature_2m,weather_code&timezone=auto&forecast_days=%d",
		lat, lon, days,
	)
	var data meteoPayload
	if err := fetchJSON(u, &data); err != nil {
		return meteoPayload{}, err
	}
	if len(data.Daily.Time) == 0 {
		return meteoPayload{}, fmt.Errorf("ingen værdata")
	}
	return data, nil
}

func buildWeatherDays(data meteoPayload) (today *weatherDay, forecast []weatherDay, all []weatherDay) {
	forecast = []weatherDay{}
	all = []weatherDay{}
	codes := data.dailyCodes()
	// First day from Open-Meteo (location-local) is "today".
	todayISO := ""
	if len(data.Daily.Time) > 0 {
		todayISO = data.Daily.Time[0]
	}
	for i, date := range data.Daily.Time {
		code := atIndexInt(codes, i)
		summary, icon := weatherCodeInfo(code)
		day := weatherDay{
			Date:          date,
			TempMax:       atIndex(data.Daily.TemperatureMax, i),
			TempMin:       atIndex(data.Daily.TemperatureMin, i),
			Precipitation: atIndex(data.Daily.PrecipitationSum, i),
			WeatherCode:   code,
			Summary:       summary,
			Icon:          icon,
			IsToday:       date == todayISO,
		}
		all = append(all, day)
		if day.IsToday {
			copyDay := day
			today = &copyDay
		} else {
			forecast = append(forecast, day)
		}
	}
	return today, forecast, all
}

func looksLikeStreetAddress(q string) bool {
	return streetHintRe.MatchString(strings.TrimSpace(q))
}

// searchNominatim resolves street addresses Open-Meteo cannot find (e.g. Lille Øvregaten 10).
func searchNominatim(q string) ([]placeSuggestion, error) {
	q = strings.TrimSpace(q)
	if q == "" {
		return nil, nil
	}
	u := "https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=" +
		url.QueryEscape(q)
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "ReiseTravelPlanner/1.0 (homey-376215)")
	req.Header.Set("Accept-Language", "nb")

	client := &http.Client{Timeout: 8 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return nil, fmt.Errorf("nominatim %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}

	var rows []struct {
		Lat         string `json:"lat"`
		Lon         string `json:"lon"`
		DisplayName string `json:"display_name"`
		Name        string `json:"name"`
		Class       string `json:"class"`
		Type        string `json:"type"`
		Address     *struct {
			Road        string `json:"road"`
			HouseNumber string `json:"house_number"`
			City        string `json:"city"`
			Town        string `json:"town"`
			Village     string `json:"village"`
			Municipality string `json:"municipality"`
			County      string `json:"county"`
			State       string `json:"state"`
			Country     string `json:"country"`
		} `json:"address"`
	}
	if err := json.NewDecoder(res.Body).Decode(&rows); err != nil {
		return nil, err
	}

	out := make([]placeSuggestion, 0, len(rows))
	for _, row := range rows {
		lat, err1 := strconv.ParseFloat(row.Lat, 64)
		lon, err2 := strconv.ParseFloat(row.Lon, 64)
		if err1 != nil || err2 != nil {
			continue
		}
		name := strings.TrimSpace(row.Name)
		admin1 := ""
		country := ""
		if row.Address != nil {
			country = row.Address.Country
			admin1 = firstNonEmpty(
				row.Address.City,
				row.Address.Town,
				row.Address.Village,
				row.Address.Municipality,
				row.Address.County,
				row.Address.State,
			)
			if name == "" {
				road := strings.TrimSpace(row.Address.Road)
				num := strings.TrimSpace(row.Address.HouseNumber)
				switch {
				case road != "" && num != "":
					name = road + " " + num
				case road != "":
					name = road
				}
			}
		}
		if name == "" {
			// First comma-separated part of display name is usually the house/road.
			parts := strings.Split(row.DisplayName, ",")
			if len(parts) > 0 {
				name = strings.TrimSpace(parts[0])
			}
		}
		if name == "" {
			name = q
		}
		fc := "ADDR"
		if row.Class == "aeroway" || row.Type == "aerodrome" {
			fc = "AIRP"
		}
		out = append(out, localizePlace(placeSuggestion{
			Name:        name,
			Country:     country,
			Admin1:      admin1,
			Latitude:    lat,
			Longitude:   lon,
			Population:  0,
			FeatureCode: fc,
		}))
	}
	return out, nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func getPlaces(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		q = strings.TrimSpace(r.URL.Query().Get("city"))
	}
	country := strings.TrimSpace(r.URL.Query().Get("country"))
	if q == "" {
		respondWithError(w, http.StatusBadRequest, "q is required")
		return
	}

	streetQuery := looksLikeStreetAddress(q)

	// Search several languages in parallel — Open-Meteo "nb" often omits
	// major cities (e.g. Roma), and serial calls make /places feel slow.
	type placeBatch struct {
		places []placeSuggestion
		err    error
	}
	var byCityEn, byCityNb, byCityIt placeBatch
	var langWG sync.WaitGroup
	langWG.Add(3)
	go func() {
		defer langWG.Done()
		p, e := searchPlaces(q, "en", 10)
		byCityEn = placeBatch{p, e}
	}()
	go func() {
		defer langWG.Done()
		p, e := searchPlaces(q, "nb", 10)
		byCityNb = placeBatch{p, e}
	}()
	go func() {
		defer langWG.Done()
		p, e := searchPlaces(q, "it", 10)
		byCityIt = placeBatch{p, e}
	}()
	langWG.Wait()
	if byCityEn.err != nil {
		log.Printf("[Places] search %q: %v", q, byCityEn.err)
		respondWithError(w, http.StatusBadGateway, byCityEn.err.Error())
		return
	}
	primary := mergePlaceSuggestions(byCityNb.places, byCityEn.places, byCityIt.places)
	sort.SliceStable(primary, func(i, j int) bool {
		si, sj := placeRank(primary[i]), placeRank(primary[j])
		if si != sj {
			return si > sj
		}
		return primary[i].Population > primary[j].Population
	})

	if country != "" && !streetQuery {
		var withCountryEn, withCountryNb placeBatch
		var countryWG sync.WaitGroup
		countryWG.Add(2)
		go func() {
			defer countryWG.Done()
			p, e := searchPlaces(q+", "+country, "en", 8)
			withCountryEn = placeBatch{p, e}
		}()
		go func() {
			defer countryWG.Done()
			p, e := searchPlaces(q+", "+country, "nb", 8)
			withCountryNb = placeBatch{p, e}
		}()
		countryWG.Wait()
		primary = mergePlaceSuggestions(withCountryNb.places, withCountryEn.places, primary)
		sort.SliceStable(primary, func(i, j int) bool {
			si, sj := placeRank(primary[i]), placeRank(primary[j])
			if si != sj {
				return si > sj
			}
			return primary[i].Population > primary[j].Population
		})
		// Soft-rank: same country (incl. Italia/Italy etc.) first, keep population order within.
		ranked := make([]placeSuggestion, 0, len(primary))
		rest := make([]placeSuggestion, 0, len(primary))
		for _, p := range primary {
			if countriesLooselyMatch(country, p.Country) {
				ranked = append(ranked, p)
			} else {
				rest = append(rest, p)
			}
		}
		primary = append(ranked, rest...)
	}

	// Open-Meteo is city-centric — fall back to Nominatim for streets/house numbers.
	if streetQuery || len(primary) == 0 {
		nomQ := q
		if country != "" && streetQuery {
			// Prefer bare street first; country from the trip day is often wrong
			// (e.g. Bergen-adresse på en Italia-dag).
			if hits, err := searchNominatim(q); err == nil && len(hits) > 0 {
				primary = mergePlaceSuggestions(hits, primary)
			} else if hits, err := searchNominatim(q + ", " + country); err == nil {
				primary = mergePlaceSuggestions(hits, primary)
			} else if err != nil {
				log.Printf("[Places] nominatim %q: %v", nomQ, err)
			}
		} else if hits, err := searchNominatim(nomQ); err == nil {
			primary = mergePlaceSuggestions(hits, primary)
		} else if err != nil {
			log.Printf("[Places] nominatim %q: %v", nomQ, err)
		}
		if streetQuery && len(primary) > 1 {
			// Keep Nominatim address hits ahead of weak city namesakes.
			sort.SliceStable(primary, func(i, j int) bool {
				ai := primary[i].FeatureCode == "ADDR" || primary[i].FeatureCode == "AIRP"
				aj := primary[j].FeatureCode == "ADDR" || primary[j].FeatureCode == "AIRP"
				if ai != aj {
					return ai
				}
				return placeRank(primary[i]) > placeRank(primary[j])
			})
		}
	}

	if len(primary) > 8 {
		primary = primary[:8]
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"places": localizePlaces(primary),
	})
}

func getWeather(w http.ResponseWriter, r *http.Request) {
	city := strings.TrimSpace(r.URL.Query().Get("city"))
	country := strings.TrimSpace(r.URL.Query().Get("country"))
	requestedDate := strings.TrimSpace(r.URL.Query().Get("date"))
	wantWeek := r.URL.Query().Get("week") == "1" || strings.EqualFold(r.URL.Query().Get("week"), "true")
	forceLive := r.URL.Query().Get("refresh") == "1" || strings.EqualFold(r.URL.Query().Get("refresh"), "true")

	if city == "" {
		respondWithError(w, http.StatusBadRequest, "city is required")
		return
	}
	if requestedDate != "" {
		if _, err := time.Parse("2006-01-02", requestedDate); err != nil {
			respondWithError(w, http.StatusBadRequest, "date must be YYYY-MM-DD")
			return
		}
	}

	archived := latestWeatherSnap(r.Context(), city, country)
	if shouldServeWeatherFromArchive(archived, forceLive) {
		respondWithJSON(w, http.StatusOK, weatherResponseFromSnap(city, country, requestedDate, *archived))
		return
	}

	place, suggestions, err := resolvePlace(city, country)
	if err != nil {
		log.Printf("[Weather] geocode %q: %v (suggestions=%d)", city, err, len(suggestions))
		if archived != nil {
			respondWithJSON(w, http.StatusOK, weatherResponseFromSnap(city, country, requestedDate, *archived))
			return
		}
		status := http.StatusNotFound
		if err.Error() == "city is required" {
			status = http.StatusBadRequest
		}
		respondWithJSON(w, status, weatherErrorBody{
			Error:       err.Error(),
			Suggestions: suggestions,
		})
		return
	}

	// Default: today only. Full week only when client asks (trip day within 7 days).
	forecastDays := 1
	if wantWeek {
		forecastDays = 7
	}

	data, err := fetchForecast(place.Latitude, place.Longitude, forecastDays)
	if err != nil {
		log.Printf("[Weather] forecast %s: %v", city, err)
		if archived != nil {
			respondWithJSON(w, http.StatusOK, weatherResponseFromSnap(city, country, requestedDate, *archived))
			return
		}
		respondWithError(w, http.StatusBadGateway, err.Error())
		return
	}

	todayDay, forecast, days := buildWeatherDays(data)

	out := weatherResponse{
		City:             localizeCity(place.Name),
		Country:          localizeCountry(place.Country),
		Latitude:         place.Latitude,
		Longitude:        place.Longitude,
		Today:            todayDay,
		Forecast:         forecast,
		Days:             days,
		RequestedDate:    requestedDate,
		RequestedInRange: false,
		Source:           "forecast",
	}

	if data.Current != nil {
		code := data.currentCode()
		summary, icon := weatherCodeInfo(code)
		out.Current = &weatherCurrent{
			Temperature: data.Current.Temperature,
			WeatherCode: code,
			Summary:     summary,
			Icon:        icon,
		}
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

	if len(days) > 0 {
		snapDays := append([]weatherDay(nil), days...)
		var snapCurrent *weatherCurrent
		if out.Current != nil {
			c := *out.Current
			snapCurrent = &c
		}
		archiveCity := city
		if strings.TrimSpace(archiveCity) == "" {
			archiveCity = out.City
		}
		go saveWeatherSnapshot(context.Background(), archiveCity, country, snapDays, snapCurrent)
	}

	respondWithJSON(w, http.StatusOK, out)
}
