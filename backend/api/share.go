package main

import (
	"context"
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
			return city
		}
		if addr := strings.TrimSpace(stop.Address); addr != "" {
			return addr
		}
		return "Hjem"
	}
	if city := strings.TrimSpace(stop.City); city != "" {
		if st := strings.TrimSpace(stop.Station); st != "" && !strings.EqualFold(st, city) {
			return city + " · " + st
		}
		return city
	}
	if st := strings.TrimSpace(stop.Station); st != "" {
		return st
	}
	if addr := strings.TrimSpace(stop.Address); addr != "" {
		return addr
	}
	return "Sted"
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
	place := strings.TrimSpace(via.Title)
	var bits []string
	if opt != nil {
		mode := strings.TrimSpace(opt.Mode)
		timeStr := strings.TrimSpace(opt.StartTime)
		switch mode {
		case "walk":
			m := strings.TrimSpace(opt.Minutes)
			if m != "" {
				bits = append(bits, "Til fots "+m+" min")
			} else {
				bits = append(bits, "Til fots")
			}
		case "flight":
			nr := strings.TrimSpace(opt.Title)
			bits = append(bits, joinShareBits(shareModeLabel(mode), nr, timeStr))
		case "other":
			typ := strings.TrimSpace(opt.Title)
			if typ == "" {
				typ = shareModeLabel(mode)
			}
			bits = append(bits, joinShareBits(typ, timeStr))
		default:
			bits = append(bits, joinShareBits(shareModeLabel(mode), timeStr))
		}
	}
	if place != "" {
		bits = append(bits, place)
	}
	conn := strings.TrimSpace(via.Connection)
	at := strings.TrimSpace(via.ChangePlace)
	plat := strings.TrimSpace(via.ChangePlatform)
	mins := strings.TrimSpace(via.ChangeMinutes)
	if opt != nil {
		if c := strings.TrimSpace(opt.Connection); c != "" {
			conn = c
		}
		if p := strings.TrimSpace(opt.ChangePlace); p != "" {
			at = p
		}
		if p := strings.TrimSpace(opt.ChangePlatform); p != "" {
			plat = p
		}
		if m := strings.TrimSpace(opt.ChangeMinutes); m != "" {
			mins = m
		}
	}
	where := at
	if plat != "" {
		if where != "" {
			where += " p." + plat
		} else {
			where = "p." + plat
		}
	}
	if strings.EqualFold(conn, "change") || where != "" || mins != "" {
		switch {
		case where != "" && mins != "":
			bits = append(bits, "bytte "+where+" "+mins+" m")
		case where != "":
			bits = append(bits, "bytte "+where)
		case mins != "":
			bits = append(bits, "bytte "+mins+" m")
		default:
			bits = append(bits, "med bytte")
		}
	}
	return strings.Join(bits, " · ")
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
