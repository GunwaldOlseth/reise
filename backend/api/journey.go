package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const journeysCollection = "trip_journeys"

func emptyJourney(tripID string) Journey {
	now := time.Now().UTC()
	return Journey{
		TripID:    tripID,
		Stops:     []JourneyStop{},
		Legs:      []JourneyLeg{},
		Live:      []JourneyLiveEntry{},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func newJourneyID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

func normalizePurpose(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "transfer":
		return "transfer"
	case "visit":
		return "visit"
	default:
		return ""
	}
}

func normalizeConnection(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "change":
		return "change"
	default:
		return "direct"
	}
}

func normalizeTransportOptions(via *JourneyVia) {
	if via == nil {
		return
	}
	for i := range via.Options {
		via.Options[i].Mode = strings.TrimSpace(via.Options[i].Mode)
		via.Options[i].Title = strings.TrimSpace(via.Options[i].Title)
		via.Options[i].Company = strings.TrimSpace(via.Options[i].Company)
		via.Options[i].StartTime = strings.TrimSpace(via.Options[i].StartTime)
		via.Options[i].EndTime = strings.TrimSpace(via.Options[i].EndTime)
		via.Options[i].Platform = strings.TrimSpace(via.Options[i].Platform)
		via.Options[i].Gate = strings.TrimSpace(via.Options[i].Gate)
		via.Options[i].Minutes = strings.TrimSpace(via.Options[i].Minutes)
		via.Options[i].Info = strings.TrimSpace(via.Options[i].Info)
	}
}

func normalizeSights(sights []JourneySight) {
	for i := range sights {
		sights[i].Purpose = normalizePurpose(sights[i].Purpose)
		sights[i].Notes = strings.TrimSpace(sights[i].Notes)
		normalizeCityDocHolder(&sights[i].Notes, &sights[i].Docs)
	}
}

func normalizeCityDocs(stop *JourneyStop) {
	if stop == nil {
		return
	}
	stop.Notes = strings.TrimSpace(stop.Notes)
	normalizeCityDocHolder(&stop.Notes, &stop.Docs)
}

func normalizeCityDocHolder(notes *string, docs *[]JourneyCityDoc) {
	if notes == nil || docs == nil {
		return
	}
	kept := make([]JourneyCityDoc, 0, len(*docs))
	for _, d := range *docs {
		d.Title = strings.TrimSpace(d.Title)
		d.Body = strings.TrimSpace(d.Body)
		if d.Body == "" {
			continue
		}
		if d.ID == "" || d.ID == "notes" {
			d.ID = newJourneyID("doc")
		}
		d.SortOrder = len(kept)
		kept = append(kept, d)
	}
	if len(kept) == 0 && *notes != "" {
		kept = append(kept, JourneyCityDoc{
			ID:        newJourneyID("doc"),
			Title:     "Om byen",
			Body:      *notes,
			SortOrder: 0,
		})
	}
	if len(kept) > 0 && *notes == "" {
		*notes = kept[0].Body
	}
	*docs = kept
}

func isPackageKind(kind string) bool {
	switch kind {
	case "cruise", "tour", "charter", "roadtrip", "other":
		return true
	default:
		return false
	}
}

// normalizePackageStop trims pack fields and migrates legacy cruise → pack.
func normalizePackageStop(stop *JourneyStop) {
	if stop == nil || !isPackageKind(stop.Kind) {
		return
	}
	stop.Stay = nil
	if stop.Pack == nil && stop.Cruise != nil {
		c := stop.Cruise
		stop.Pack = &JourneyPackage{
			Nights:      c.Nights,
			Title:       strings.TrimSpace(c.ShipName),
			BasePlace:   strings.TrimSpace(c.HomePort),
			BaseCountry: strings.TrimSpace(c.HomeCountry),
			Detail:      strings.TrimSpace(c.CabinNumber),
			Price:       strings.TrimSpace(c.Price),
			Days:        c.Days,
		}
	}
	if stop.Pack == nil {
		return
	}
	p := stop.Pack
	p.Title = strings.TrimSpace(p.Title)
	p.BasePlace = strings.TrimSpace(p.BasePlace)
	p.BaseCountry = strings.TrimSpace(p.BaseCountry)
	p.Detail = strings.TrimSpace(p.Detail)
	p.Price = strings.TrimSpace(p.Price)
	if p.BasePlace == "" {
		p.BasePlace = stop.City
	}
	if p.BaseCountry == "" {
		p.BaseCountry = stop.Country
	}
	if stop.City == "" && p.BasePlace != "" {
		stop.City = p.BasePlace
	}
	if stop.Country == "" && p.BaseCountry != "" {
		stop.Country = p.BaseCountry
	}
	if p.Nights < 1 {
		p.Nights = 1
	}
	if p.Nights > 30 {
		p.Nights = 30
	}
	if p.Days == nil {
		p.Days = []JourneyPackageDay{}
	}
	for i := range p.Days {
		if p.Days[i].Offset < 0 {
			p.Days[i].Offset = 0
		}
		p.Days[i].ArriveTime = strings.TrimSpace(p.Days[i].ArriveTime)
		p.Days[i].LeaveTime = strings.TrimSpace(p.Days[i].LeaveTime)
		p.Days[i].AllAboardTime = strings.TrimSpace(p.Days[i].AllAboardTime)
		p.Days[i].Notes = strings.TrimSpace(p.Days[i].Notes)
		normalizeCityDocHolder(&p.Days[i].Notes, &p.Days[i].Docs)
	}
	// Prefer pack going forward; drop legacy cruise payload once migrated.
	stop.Cruise = nil
}

func parseFlexibleOffset(raw json.RawMessage) int {
	s := strings.TrimSpace(string(raw))
	if s == "" || s == "null" {
		return 0
	}
	if strings.HasPrefix(s, "\"") {
		var str string
		if err := json.Unmarshal(raw, &str); err != nil {
			return 0
		}
		n, err := strconv.Atoi(strings.TrimSpace(str))
		if err != nil || n < 0 {
			return 0
		}
		return n
	}
	var n int
	if err := json.Unmarshal(raw, &n); err == nil {
		if n < 0 {
			return 0
		}
		return n
	}
	var f float64
	if err := json.Unmarshal(raw, &f); err != nil {
		return 0
	}
	n = int(f)
	if n < 0 {
		return 0
	}
	return n
}

// UnmarshalJSON accepts offset as a number or string. A string offset used to
// fail the entire PUT /journey decode, so allAboardTime never reached Firestore.
func (d *JourneyPackageDay) UnmarshalJSON(data []byte) error {
	var shadow struct {
		ID            string           `json:"id"`
		Offset        json.RawMessage  `json:"offset"`
		AtSea         bool             `json:"atSea"`
		City          string           `json:"city"`
		Country       string           `json:"country"`
		Latitude      float64          `json:"latitude"`
		Longitude     float64          `json:"longitude"`
		ArriveTime    string           `json:"arriveTime"`
		LeaveTime     string           `json:"leaveTime"`
		AllAboardTime string           `json:"allAboardTime"`
		AllAboard     string           `json:"allAboard"`
		HideOnMap     bool             `json:"hideOnMap"`
		Notes         string           `json:"notes"`
		Docs          []JourneyCityDoc `json:"docs"`
	}
	if err := json.Unmarshal(data, &shadow); err != nil {
		return err
	}
	d.ID = shadow.ID
	d.Offset = parseFlexibleOffset(shadow.Offset)
	d.AtSea = shadow.AtSea
	d.City = shadow.City
	d.Country = shadow.Country
	d.Latitude = shadow.Latitude
	d.Longitude = shadow.Longitude
	d.ArriveTime = strings.TrimSpace(shadow.ArriveTime)
	d.LeaveTime = strings.TrimSpace(shadow.LeaveTime)
	d.AllAboardTime = strings.TrimSpace(shadow.AllAboardTime)
	if d.AllAboardTime == "" {
		d.AllAboardTime = strings.TrimSpace(shadow.AllAboard)
	}
	d.HideOnMap = shadow.HideOnMap
	d.Notes = shadow.Notes
	d.Docs = shadow.Docs
	return nil
}

func normalizeJourney(j *Journey) {
	if j.Stops == nil {
		j.Stops = []JourneyStop{}
	}
	if j.Legs == nil {
		j.Legs = []JourneyLeg{}
	}
	if j.Live == nil {
		j.Live = []JourneyLiveEntry{}
	}
	if j.LiveActivitySkips == nil {
		j.LiveActivitySkips = []JourneyLiveActivitySkip{}
	}
	if j.LiveDailySteps == nil {
		j.LiveDailySteps = []JourneyLiveDailySteps{}
	}
	seenSkips := make(map[string]struct{})
	normSkips := make([]JourneyLiveActivitySkip, 0, len(j.LiveActivitySkips))
	for _, s := range j.LiveActivitySkips {
		date := strings.TrimSpace(s.Date)
		stopID := strings.TrimSpace(s.StopID)
		if date == "" || stopID == "" {
			continue
		}
		offset := s.DayOffset
		if offset < 0 {
			offset = 0
		}
		activityID := strings.TrimSpace(s.ActivityID)
		key := date + "\x00" + stopID + "\x00" + strconv.Itoa(offset) + "\x00" + activityID
		if _, ok := seenSkips[key]; ok {
			continue
		}
		seenSkips[key] = struct{}{}
		normSkips = append(normSkips, JourneyLiveActivitySkip{
			Date:       date,
			StopID:     stopID,
			DayOffset:  offset,
			ActivityID: activityID,
		})
	}
	j.LiveActivitySkips = normSkips
	seenSteps := make(map[string]struct{})
	normSteps := make([]JourneyLiveDailySteps, 0, len(j.LiveDailySteps))
	for _, s := range j.LiveDailySteps {
		date := strings.TrimSpace(s.Date)
		if date == "" {
			continue
		}
		traveler := strings.TrimSpace(s.Traveler)
		steps := s.Steps
		if steps < 0 {
			steps = 0
		}
		key := date + "\x00" + traveler
		if _, ok := seenSteps[key]; ok {
			continue
		}
		seenSteps[key] = struct{}{}
		normSteps = append(normSteps, JourneyLiveDailySteps{
			Date:     date,
			Traveler: traveler,
			Steps:    steps,
		})
	}
	sort.Slice(normSteps, func(i, k int) bool {
		if normSteps[i].Date != normSteps[k].Date {
			return normSteps[i].Date < normSteps[k].Date
		}
		return normSteps[i].Traveler < normSteps[k].Traveler
	})
	j.LiveDailySteps = normSteps
	for i := range j.Live {
		j.Live[i].SortOrder = i
		j.Live[i].Date = strings.TrimSpace(j.Live[i].Date)
		j.Live[i].Title = strings.TrimSpace(j.Live[i].Title)
		j.Live[i].Price = strings.TrimSpace(j.Live[i].Price)
		j.Live[i].Notes = strings.TrimSpace(j.Live[i].Notes)
		j.Live[i].Time = strings.TrimSpace(j.Live[i].Time)
		switch strings.ToLower(j.Live[i].Kind) {
		case "food", "drink", "shop":
			j.Live[i].Kind = strings.ToLower(j.Live[i].Kind)
		default:
			j.Live[i].Kind = "other"
		}
		if j.Live[i].ID == "" {
			j.Live[i].ID = newJourneyID("live")
		}
		if j.Live[i].Rating < 0 {
			j.Live[i].Rating = 0
		}
		if j.Live[i].Rating > 5 {
			j.Live[i].Rating = 5
		}
		photos := make([]JourneyPhoto, 0, len(j.Live[i].Photos))
		for _, p := range j.Live[i].Photos {
			p.URL = strings.TrimSpace(p.URL)
			if p.URL == "" {
				continue
			}
			if p.ID == "" {
				p.ID = newJourneyID("photo")
			}
			photos = append(photos, p)
		}
		j.Live[i].Photos = photos
	}
	kept := make([]JourneyLiveEntry, 0, len(j.Live))
	for _, e := range j.Live {
		if e.Date == "" {
			continue
		}
		if e.Title == "" && e.Price == "" && e.Notes == "" && e.Rating == 0 && len(e.Photos) == 0 {
			continue
		}
		kept = append(kept, e)
	}
	j.Live = kept
	sort.SliceStable(j.Stops, func(i, k int) bool {
		if j.Stops[i].SortOrder != j.Stops[k].SortOrder {
			return j.Stops[i].SortOrder < j.Stops[k].SortOrder
		}
		return j.Stops[i].ArriveDate < j.Stops[k].ArriveDate
	})
	for i := range j.Stops {
		j.Stops[i].SortOrder = i
		if j.Stops[i].ID == "" {
			j.Stops[i].ID = newJourneyID("stop")
		}
		j.Stops[i].City = strings.TrimSpace(j.Stops[i].City)
		j.Stops[i].Country = strings.TrimSpace(j.Stops[i].Country)
		j.Stops[i].Address = strings.TrimSpace(j.Stops[i].Address)
		j.Stops[i].ArriveDate = strings.TrimSpace(j.Stops[i].ArriveDate)
		j.Stops[i].Notes = strings.TrimSpace(j.Stops[i].Notes)
		normalizeCityDocs(&j.Stops[i])
		j.Stops[i].Purpose = normalizePurpose(j.Stops[i].Purpose)
		if j.Stops[i].Kind == "" {
			j.Stops[i].Kind = "place"
		}
		if j.Stops[i].Stay != nil {
			if j.Stops[i].Stay.Nights < 1 {
				j.Stops[i].Stay.Nights = 1
			}
			if j.Stops[i].Stay.Nights > 60 {
				j.Stops[i].Stay.Nights = 60
			}
			j.Stops[i].Stay.BookedWhere = strings.TrimSpace(j.Stops[i].Stay.BookedWhere)
		}
		normalizePackageStop(&j.Stops[i])
		normalizeSights(j.Stops[i].Sights)
	}
	byPair := map[string]JourneyLeg{}
	for _, leg := range j.Legs {
		byPair[leg.FromStopID+"->"+leg.ToStopID] = leg
	}
	synced := make([]JourneyLeg, 0, max(0, len(j.Stops)-1))
	for i := 0; i+1 < len(j.Stops); i++ {
		fromID := j.Stops[i].ID
		toID := j.Stops[i+1].ID
		key := fromID + "->" + toID
		if existing, ok := byPair[key]; ok {
			existing.FromStopID = fromID
			existing.ToStopID = toID
			if existing.ID == "" {
				existing.ID = newJourneyID("leg")
			}
			if existing.Vias == nil {
				existing.Vias = []JourneyVia{}
			}
			for vi := range existing.Vias {
				existing.Vias[vi].SortOrder = vi
				existing.Vias[vi].Purpose = normalizePurpose(existing.Vias[vi].Purpose)
				existing.Vias[vi].Connection = normalizeConnection(existing.Vias[vi].Connection)
				existing.Vias[vi].ChangePlace = strings.TrimSpace(existing.Vias[vi].ChangePlace)
				existing.Vias[vi].ChangePlatform = strings.TrimSpace(existing.Vias[vi].ChangePlatform)
				existing.Vias[vi].ChangeMinutes = strings.TrimSpace(existing.Vias[vi].ChangeMinutes)
				normalizeTransportOptions(&existing.Vias[vi])
				normalizeSights(existing.Vias[vi].Sights)
				if existing.Vias[vi].ID == "" {
					existing.Vias[vi].ID = newJourneyID("via")
				}
			}
			synced = append(synced, existing)
			continue
		}
		synced = append(synced, JourneyLeg{
			ID:         newJourneyID("leg"),
			FromStopID: fromID,
			ToStopID:   toID,
			Vias:       []JourneyVia{},
		})
	}
	j.Legs = synced
}

func getJourneyDoc(ctx context.Context, tripID string) (Journey, bool, error) {
	iter := db.Collection(journeysCollection).Where("tripId", "==", tripID).Limit(1).Documents(ctx)
	doc, err := iter.Next()
	if err == iterator.Done {
		return emptyJourney(tripID), false, nil
	}
	if err != nil {
		return Journey{}, false, err
	}
	var j Journey
	if err := doc.DataTo(&j); err != nil {
		return Journey{}, false, err
	}
	j.ID = doc.Ref.ID
	normalizeJourney(&j)
	return j, true, nil
}

func getJourney(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	tripID := r.PathValue("id")
	if tripID == "" {
		respondWithError(w, http.StatusBadRequest, "Missing trip ID")
		return
	}
	if _, err := db.Collection(tripsCollection).Doc(tripID).Get(ctx); err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusNotFound, "Trip not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get trip")
		return
	}
	j, found, err := getJourneyDoc(ctx, tripID)
	if err != nil {
		log.Printf("Error loading journey for %s: %v", tripID, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to load journey")
		return
	}
	if !found {
		j = emptyJourney(tripID)
	}
	respondWithJSON(w, http.StatusOK, j)
}

func putJourney(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	tripID := r.PathValue("id")
	if tripID == "" {
		respondWithError(w, http.StatusBadRequest, "Missing trip ID")
		return
	}
	if _, err := db.Collection(tripsCollection).Doc(tripID).Get(ctx); err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusNotFound, "Trip not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get trip")
		return
	}

	var incoming Journey
	if err := decodeJSON(r, &incoming); err != nil {
		log.Printf("putJourney decode: %v", err)
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	incoming.TripID = tripID
	normalizeJourney(&incoming)

	existing, found, err := getJourneyDoc(ctx, tripID)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load journey")
		return
	}
	now := time.Now().UTC()
	if found {
		incoming.ID = existing.ID
		incoming.CreatedAt = existing.CreatedAt
		incoming.UpdatedAt = now
		if _, err := db.Collection(journeysCollection).Doc(existing.ID).Set(ctx, incoming); err != nil {
			log.Printf("Error updating journey %s: %v", existing.ID, err)
			respondWithError(w, http.StatusInternalServerError, "Failed to save journey")
			return
		}
	} else {
		incoming.CreatedAt = now
		incoming.UpdatedAt = now
		ref, _, err := db.Collection(journeysCollection).Add(ctx, incoming)
		if err != nil {
			log.Printf("Error creating journey: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to save journey")
			return
		}
		incoming.ID = ref.ID
	}
	respondWithJSON(w, http.StatusOK, incoming)
}

func deleteJourneyForTrip(ctx context.Context, tripID string) error {
	iter := db.Collection(journeysCollection).Where("tripId", "==", tripID).Documents(ctx)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			return nil
		}
		if err != nil {
			return err
		}
		if _, err := doc.Ref.Delete(ctx); err != nil {
			return err
		}
	}
}
