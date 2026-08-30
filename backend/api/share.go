package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode"

	"cloud.google.com/go/firestore"
	"github.com/google/uuid"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type shareItinerary struct {
	Name      string       `json:"name"`
	StartDate string       `json:"startDate"`
	EndDate   string       `json:"endDate"`
	Places    []sharePlace `json:"places"`
}

type sharePlace struct {
	Title string     `json:"title"`
	Subs  []shareHop `json:"subs,omitempty"`
	Hops  []shareHop `json:"hops"`
}

type shareHop struct {
	Label string `json:"label"`
}

type shareTokenResponse struct {
	Token string `json:"token"`
}

func validShareToken(token string) bool {
	if len(token) < 8 || len(token) > 64 {
		return false
	}
	for _, r := range token {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' {
			continue
		}
		return false
	}
	return true
}

func newShareToken() string {
	return strings.ReplaceAll(uuid.NewString(), "-", "")
}

func createTripShare(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "Missing trip ID")
		return
	}

	doc, err := db.Collection(tripsCollection).Doc(id).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusNotFound, "Trip not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get trip")
		return
	}

	var trip Trip
	if err := doc.DataTo(&trip); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read trip")
		return
	}
	if validShareToken(trip.ShareToken) {
		respondWithJSON(w, http.StatusOK, shareTokenResponse{Token: trip.ShareToken})
		return
	}

	token := ""
	for i := 0; i < 5; i++ {
		candidate := newShareToken()
		taken, err := shareTokenExists(ctx, candidate)
		if err != nil {
			log.Printf("Error checking share token: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to create share link")
			return
		}
		if !taken {
			token = candidate
			break
		}
	}
	if token == "" {
		respondWithError(w, http.StatusInternalServerError, "Failed to create share link")
		return
	}

	if _, err := db.Collection(tripsCollection).Doc(id).Update(ctx, []firestore.Update{
		{Path: "shareToken", Value: token},
		{Path: "updatedAt", Value: time.Now().UTC()},
	}); err != nil {
		log.Printf("Error saving share token for %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create share link")
		return
	}

	respondWithJSON(w, http.StatusOK, shareTokenResponse{Token: token})
}

func deleteTripShare(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "Missing trip ID")
		return
	}

	doc, err := db.Collection(tripsCollection).Doc(id).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusNotFound, "Trip not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get trip")
		return
	}

	var trip Trip
	if err := doc.DataTo(&trip); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read trip")
		return
	}
	if !validShareToken(trip.ShareToken) {
		respondWithJSON(w, http.StatusOK, map[string]string{"status": "unpublished"})
		return
	}

	if _, err := db.Collection(tripsCollection).Doc(id).Update(ctx, []firestore.Update{
		{Path: "shareToken", Value: firestore.Delete},
		{Path: "updatedAt", Value: time.Now().UTC()},
	}); err != nil {
		log.Printf("Error removing share token for %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to unpublish")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"status": "unpublished"})
}

func shareTokenExists(ctx context.Context, token string) (bool, error) {
	iter := db.Collection(tripsCollection).Where("shareToken", "==", token).Limit(1).Documents(ctx)
	defer iter.Stop()
	_, err := iter.Next()
	if err == iterator.Done {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func getSharedItinerary(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	token := strings.TrimSpace(r.PathValue("token"))
	if !validShareToken(token) {
		respondWithError(w, http.StatusNotFound, "Not found")
		return
	}

	iter := db.Collection(tripsCollection).Where("shareToken", "==", token).Limit(1).Documents(ctx)
	defer iter.Stop()
	doc, err := iter.Next()
	if err == iterator.Done {
		respondWithError(w, http.StatusNotFound, "Not found")
		return
	}
	if err != nil {
		log.Printf("Error looking up share token: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to load share")
		return
	}

	var trip Trip
	if err := doc.DataTo(&trip); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to read trip")
		return
	}
	trip.ID = doc.Ref.ID

	j, found, err := getJourneyDoc(ctx, trip.ID)
	if err != nil {
		log.Printf("Error loading shared journey for %s: %v", trip.ID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to load share")
		return
	}
	if !found {
		j = emptyJourney(trip.ID)
	}

	respondWithJSON(w, http.StatusOK, buildShareItinerary(trip, j))
}

func buildShareItinerary(trip Trip, journey Journey) shareItinerary {
	stops := append([]JourneyStop(nil), journey.Stops...)
	sort.SliceStable(stops, func(i, k int) bool {
		if stops[i].SortOrder != stops[k].SortOrder {
			return stops[i].SortOrder < stops[k].SortOrder
		}
		return stops[i].ArriveDate < stops[k].ArriveDate
	})

	places := make([]sharePlace, 0, len(stops))
	for i, stop := range stops {
		hops := []shareHop{}
		if i+1 < len(stops) {
			hops = shareHopsForLeg(legBetween(journey, stop.ID, stops[i+1].ID), shareStopTitle(stops[i+1]))
		}
		places = append(places, sharePlace{
			Title: shareStopTitle(stop),
			Subs:  shareSubsForStop(stop),
			Hops:  hops,
		})
	}

	return shareItinerary{
		Name:      strings.TrimSpace(trip.Name),
		StartDate: strings.TrimSpace(trip.StartDate),
		EndDate:   strings.TrimSpace(trip.EndDate),
		Places:    places,
	}
}

func legBetween(journey Journey, fromID, toID string) *JourneyLeg {
	for i := range journey.Legs {
		if journey.Legs[i].FromStopID == fromID && journey.Legs[i].ToStopID == toID {
			return &journey.Legs[i]
		}
	}
	return nil
}

func shareStopTitle(stop JourneyStop) string {
	var base string
	if isPackageKind(stop.Kind) {
		title := ""
		if stop.Pack != nil {
			title = strings.TrimSpace(stop.Pack.Title)
		}
		if title == "" && stop.Cruise != nil {
			title = strings.TrimSpace(stop.Cruise.ShipName)
		}
		if title == "" {
			title = strings.TrimSpace(stop.City)
		}
		if title == "" {
			return "Pakke"
		}
		return title
	}
	if stop.Kind == "home" {
		if city := strings.TrimSpace(stop.City); city != "" {
			base = city
		} else if addr := strings.TrimSpace(stop.Address); addr != "" {
			base = addr
		} else {
			base = "Hjem"
		}
	} else if city := strings.TrimSpace(stop.City); city != "" {
		if st := strings.TrimSpace(stop.Station); st != "" && !strings.EqualFold(st, city) {
			base = city + " · " + st
		} else {
			base = city
		}
	} else if st := strings.TrimSpace(stop.Station); st != "" {
		base = st
	} else if addr := strings.TrimSpace(stop.Address); addr != "" {
		base = addr
	} else {
		base = "Sted"
	}
	date := strings.TrimSpace(stop.ArriveDate)
	if date != "" {
		if formatted := formatDateNOShare(date); formatted != "" {
			return base + " · " + formatted
		}
	}
	return base
}

func shareHopsForLeg(leg *JourneyLeg, destTitle string) []shareHop {
	if leg == nil {
		return []shareHop{}
	}
	vias := append([]JourneyVia(nil), leg.Vias...)
	sort.SliceStable(vias, func(i, k int) bool {
		return vias[i].SortOrder < vias[k].SortOrder
	})
	if len(vias) == 0 {
		if strings.TrimSpace(leg.Mode) != "" || strings.TrimSpace(leg.StartTime) != "" || strings.TrimSpace(leg.Title) != "" {
			title := strings.TrimSpace(leg.Title)
			if title == "" {
				title = destTitle
			}
			vias = []JourneyVia{{
				Title:     title,
				Mode:      leg.Mode,
				StartTime: leg.StartTime,
				EndTime:   leg.EndTime,
			}}
		}
	}
	hops := make([]shareHop, 0, len(vias))
	for _, via := range vias {
		if label := formatShareHop(via); label != "" {
			hops = append(hops, shareHop{Label: label})
		}
	}
	return hops
}

func viaShareOptions(via JourneyVia) []JourneyTransportOption {
	if len(via.Options) > 0 {
		return via.Options
	}
	start := strings.TrimSpace(via.StartTime)
	if start == "" && len(via.Departures) > 0 {
		start = strings.TrimSpace(via.Departures[0])
	}
	if strings.TrimSpace(via.Mode) == "" && start == "" && strings.TrimSpace(via.EndTime) == "" {
		return nil
	}
	return []JourneyTransportOption{{
		Mode:      via.Mode,
		StartTime: start,
		EndTime:   via.EndTime,
	}}
}

func chosenShareOption(via JourneyVia) *JourneyTransportOption {
	opts := viaShareOptions(via)
	if len(opts) == 0 {
		return nil
	}
	for i := range opts {
		if opts[i].Taken {
			return &opts[i]
		}
	}
	return &opts[0]
}

func shareModeLabel(mode string) string {
	switch strings.TrimSpace(mode) {
	case "flight":
		return "Fly"
	case "train":
		return "Tog"
	case "tram":
		return "Bybane/trikk"
	case "bus":
		return "Buss"
	case "car":
		return "Bil"
	case "boat":
		return "Båt/ferge"
	case "walk":
		return "Til fots"
	case "other":
		return "Annet"
	case "":
		return ""
	default:
		return "Reise"
	}
}

func formatShareHop(via JourneyVia) string {
	opt := chosenShareOption(via)
	if opt == nil {
		return ""
	}
	return shareHopTimeLabel(opt)
}

func shareHopTimeLabel(opt *JourneyTransportOption) string {
	if opt == nil {
		return ""
	}
	if strings.TrimSpace(opt.Mode) == "walk" {
		if m := shareParseMinutes(opt.Minutes); m > 0 {
			return formatShareDuration(m)
		}
		return ""
	}
	start := strings.TrimSpace(opt.StartTime)
	end := strings.TrimSpace(opt.EndTime)
	if mins := shareClockDurationMinutes(start, end, true); mins > 0 {
		return formatShareDuration(mins)
	}
	if m := shareParseMinutes(opt.Minutes); m > 0 {
		return formatShareDuration(m)
	}
	return ""
}

func shareParseMinutes(raw string) int {
	s := strings.TrimSpace(raw)
	if s == "" {
		return -1
	}
	n := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			continue
		}
		n = n*10 + int(r-'0')
	}
	if n <= 0 {
		return -1
	}
	return n
}

func shareClockDurationMinutes(start, end string, allowOvernight bool) int {
	a := arriveTimeSortKey(start)
	b := arriveTimeSortKey(end)
	if a >= 1<<30 || b >= 1<<30 {
		return -1
	}
	diff := (b - a) / 60
	if diff < 0 {
		if !allowOvernight {
			return -1
		}
		diff += 24 * 60
	}
	if diff <= 0 {
		return -1
	}
	return diff
}

func sharePortMinutes(arrive, leave string, allowOvernight bool) int {
	return shareClockDurationMinutes(arrive, leave, allowOvernight)
}

func formatShareDuration(minutes int) string {
	if minutes <= 0 {
		return ""
	}
	h := minutes / 60
	m := minutes % 60
	if h > 0 && m > 0 {
		return fmt.Sprintf("%d timer %d min", h, m)
	}
	if h > 0 {
		return fmt.Sprintf("%d timer", h)
	}
	return fmt.Sprintf("%d min", m)
}

func packageOfStop(stop JourneyStop) *JourneyPackage {
	if stop.Pack != nil {
		return stop.Pack
	}
	if stop.Cruise == nil {
		return nil
	}
	c := stop.Cruise
	return &JourneyPackage{
		Nights:      c.Nights,
		Title:       strings.TrimSpace(c.ShipName),
		BasePlace:   strings.TrimSpace(c.HomePort),
		BaseCountry: strings.TrimSpace(c.HomeCountry),
		Detail:      strings.TrimSpace(c.CabinNumber),
		Price:       strings.TrimSpace(c.Price),
		Days:        c.Days,
	}
}

func packageFreeDayLabel(kind string) string {
	switch kind {
	case "cruise":
		return "Til sjøs"
	case "roadtrip":
		return "Kjøredag"
	case "charter":
		return "Fri / pool"
	default:
		return "Fri dag"
	}
}

func packagePlaceFallback(kind string) string {
	switch kind {
	case "cruise":
		return "Havn"
	case "charter":
		return "Destinasjon"
	case "roadtrip":
		return "Stopp"
	default:
		return "Sted"
	}
}

func packageNightsForShare(pack *JourneyPackage) int {
	nights := pack.Nights
	if nights < 1 {
		nights = 1
	}
	for _, d := range pack.Days {
		if d.Offset > nights {
			nights = d.Offset
		}
	}
	if nights > 30 {
		nights = 30
	}
	return nights
}

const shareCruiseAtSeaLabel = "Cruise"

func shareSubsForStop(stop JourneyStop) []shareHop {
	if !isPackageKind(stop.Kind) {
		return nil
	}
	pack := packageOfStop(stop)
	if pack == nil {
		return nil
	}
	nights := packageNightsForShare(pack)
	atSeaLabel := shareCruiseAtSeaLabel
	if stop.Kind != "cruise" {
		atSeaLabel = packageFreeDayLabel(stop.Kind)
	}
	fallback := packagePlaceFallback(stop.Kind)
	byOffset := make(map[int]JourneyPackageDay, len(pack.Days))
	for _, day := range pack.Days {
		byOffset[day.Offset] = day
	}
	out := make([]shareHop, 0, nights+1)
	for offset := 0; offset <= nights; offset++ {
		day, ok := byOffset[offset]
		if !ok {
			if stop.Kind == "cruise" {
				day = JourneyPackageDay{Offset: offset, AtSea: true}
			} else {
				continue
			}
		}
		head, duration := formatSharePackageDayParts(
			stop, day, pack, atSeaLabel, fallback, nights,
		)
		if head == "" {
			continue
		}
		parts := []string{head}
		date := strings.TrimSpace(stop.ArriveDate)
		if date != "" {
			dayISO := addDaysISO(date, offset)
			if dayISO != "" {
				if formatted := formatDateNOShare(dayISO); formatted != "" {
					parts = append(parts, formatted)
				}
			}
		}
		if duration != "" {
			parts = append(parts, duration)
		}
		out = append(out, shareHop{Label: strings.Join(parts, " · ")})
	}
	return out
}

func formatSharePackageDayParts(
	stop JourneyStop,
	day JourneyPackageDay,
	pack *JourneyPackage,
	atSeaLabel, placeFallback string,
	nights int,
) (head string, duration string) {
	city := strings.TrimSpace(day.City)
	if day.AtSea {
		if city != "" {
			return city, atSeaLabel
		}
		return atSeaLabel, ""
	}
	place := city
	if place == "" {
		if stop.Kind == "cruise" && day.Offset == 0 {
			place = strings.TrimSpace(pack.BasePlace)
			if place == "" {
				place = "Hjemhavn"
			}
		} else {
			place = placeFallback
		}
	}
	isStart := day.Offset <= 0
	isLast := day.Offset >= nights
	arrive := strings.TrimSpace(day.ArriveTime)
	leave := strings.TrimSpace(day.LeaveTime)
	if stop.Kind == "cruise" && isStart {
		arrive = ""
	}
	if stop.Kind == "cruise" && isLast {
		leave = ""
	}
	allowOvernight := stop.Kind != "cruise"
	if mins := sharePortMinutes(arrive, leave, allowOvernight); mins > 0 {
		duration = formatShareDuration(mins)
	}
	return place, duration
}

func formatDateNOShare(iso string) string {
	t, err := time.Parse("2006-01-02", strings.TrimSpace(iso))
	if err != nil {
		return ""
	}
	weekdays := []string{"søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"}
	months := []string{
		"", "jan", "feb", "mar", "apr", "mai", "jun",
		"jul", "aug", "sep", "okt", "nov", "des",
	}
	wd := weekdays[t.Weekday()]
	m := months[t.Month()]
	if m == "" {
		return ""
	}
	return fmt.Sprintf("%s %02d. %s", wd, t.Day(), m)
}

func joinShareBits(parts ...string) string {
	kept := make([]string, 0, len(parts))
	for _, p := range parts {
		if strings.TrimSpace(p) != "" {
			kept = append(kept, strings.TrimSpace(p))
		}
	}
	return strings.Join(kept, " ")
}
