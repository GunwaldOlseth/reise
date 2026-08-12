package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/google/uuid"
	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

const (
	tripsCollection = "trips"
	daysCollection  = "trip_days"
)

func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error": "Failed to serialize response"}`))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(response)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func decodeJSON(r *http.Request, dst interface{}) error {
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		return err
	}
	return json.Unmarshal(body, dst)
}

// arriveTimeSortKey returns seconds from midnight for HH:mm[/ss]; empty/invalid sorts last.
func arriveTimeSortKey(timeStr string) int {
	t := strings.TrimSpace(timeStr)
	if t == "" {
		return 1 << 30
	}
	var h, m, s int
	if n, err := fmt.Sscanf(t, "%d:%d:%d", &h, &m, &s); err == nil && n == 3 {
		return h*3600 + m*60 + s
	}
	if n, err := fmt.Sscanf(t, "%d:%d", &h, &m); err == nil && n == 2 {
		return h*3600 + m*60
	}
	return 1 << 30
}

func viaPointTimeSortKey(point ViaPoint) int {
	if key := arriveTimeSortKey(point.ArriveTime); key != 1<<30 {
		return key
	}
	return arriveTimeSortKey(point.LeaveTime)
}

func normalizeDay(day *TripDay) {
	if day.Links == nil {
		day.Links = []Link{}
	}
	if day.Items == nil {
		day.Items = []DayItem{}
	}
	if day.ViaPoints == nil {
		day.ViaPoints = []ViaPoint{}
	}
	if day.Legs == nil {
		day.Legs = []RouteLeg{}
	}

	// Migrate legacy hotel fields into items when items is empty.
	if len(day.Items) == 0 && (day.HotelName != "" || day.HotelURL != "" || day.Address != "") {
		day.Items = append(day.Items, DayItem{
			ID:        uuid.NewString(),
			Type:      ItemHotel,
			Title:     day.HotelName,
			URL:       day.HotelURL,
			Address:   day.Address,
			StartTime: day.CheckIn,
			EndTime:   day.CheckOut,
			SortOrder: 0,
		})
	}

	for i := range day.Items {
		if day.Items[i].ID == "" {
			day.Items[i].ID = uuid.NewString()
		}
		if day.Items[i].Type == "" {
			day.Items[i].Type = ItemAttraction
		}
		if day.Items[i].Type == ItemHotel || day.Items[i].Type == ItemCruise {
			if day.Items[i].Nights < 1 {
				day.Items[i].Nights = 1
			}
		}
		day.Items[i].SortOrder = i
	}

	if day.AtSea {
		day.City = "Til sjøs"
		day.Country = ""
		day.ArriveTime = ""
		day.LeaveTime = ""
	} else if strings.EqualFold(strings.TrimSpace(day.City), "Til sjøs") ||
		strings.EqualFold(strings.TrimSpace(day.City), "Til havs") {
		day.AtSea = true
		day.City = "Til sjøs"
		day.Country = ""
		day.ArriveTime = ""
		day.LeaveTime = ""
	}

	sort.SliceStable(day.Items, func(i, j int) bool {
		return day.Items[i].SortOrder < day.Items[j].SortOrder
	})

	// Keep legacy hotel fields in sync with first hotel item (city view).
	for _, item := range day.Items {
		if item.Type == ItemHotel {
			day.HotelName = item.Title
			day.HotelURL = item.URL
			day.Address = item.Address
			day.CheckIn = item.StartTime
			day.CheckOut = item.EndTime
			break
		}
	}

	for i := range day.ViaPoints {
		if day.ViaPoints[i].ID == "" {
			day.ViaPoints[i].ID = uuid.NewString()
		}
	}
	sort.SliceStable(day.ViaPoints, func(i, j int) bool {
		ai := viaPointTimeSortKey(day.ViaPoints[i])
		aj := viaPointTimeSortKey(day.ViaPoints[j])
		aTimed := ai != 1<<30
		bTimed := aj != 1<<30
		// Only compare by clock when both stops have times; keep «Hjem» etc. in place.
		if aTimed && bTimed && ai != aj {
			return ai < aj
		}
		return day.ViaPoints[i].SortOrder < day.ViaPoints[j].SortOrder
	})
	for i := range day.ViaPoints {
		day.ViaPoints[i].SortOrder = i
	}

	// Rebuild legs so they always connect consecutive via-points.
	existing := map[string]RouteLeg{}
	for _, leg := range day.Legs {
		key := leg.FromViaPointID + "->" + leg.ToViaPointID
		existing[key] = leg
	}
	synced := make([]RouteLeg, 0, max(0, len(day.ViaPoints)-1))
	for i := 0; i+1 < len(day.ViaPoints); i++ {
		fromID := day.ViaPoints[i].ID
		toID := day.ViaPoints[i+1].ID
		key := fromID + "->" + toID
		leg, ok := existing[key]
		if !ok {
			leg = RouteLeg{
				ID:             uuid.NewString(),
				FromViaPointID: fromID,
				ToViaPointID:   toID,
				Mode:           LegWalk,
			}
		}
		if leg.ID == "" {
			leg.ID = uuid.NewString()
		}
		leg.FromViaPointID = fromID
		leg.ToViaPointID = toID
		if leg.Mode == "" {
			leg.Mode = LegWalk
		}
		leg.SortOrder = i
		synced = append(synced, leg)
	}
	day.Legs = synced
}

// --- TRIPS ---

func listTrips(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	trips := []Trip{}

	iter := db.Collection(tripsCollection).OrderBy("createdAt", firestore.Desc).Documents(ctx)
	defer iter.Stop()

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("Error iterating trips: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to query trips")
			return
		}

		var trip Trip
		if err := doc.DataTo(&trip); err != nil {
			log.Printf("Error binding trip data: %v", err)
			continue
		}
		trip.ID = doc.Ref.ID
		trips = append(trips, trip)
	}

	respondWithJSON(w, http.StatusOK, trips)
}

func getTrip(w http.ResponseWriter, r *http.Request) {
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
		log.Printf("Error getting trip %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to get trip")
		return
	}

	var trip Trip
	if err := doc.DataTo(&trip); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to parse trip")
		return
	}
	trip.ID = doc.Ref.ID
	respondWithJSON(w, http.StatusOK, trip)
}

func createTrip(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	var trip Trip
	if err := decodeJSON(r, &trip); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if trip.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if trip.ColorByCountry == nil {
		trip.ColorByCountry = map[string]string{}
	}

	now := time.Now().UTC()
	trip.CreatedAt = now
	trip.UpdatedAt = now

	ref, _, err := db.Collection(tripsCollection).Add(ctx, trip)
	if err != nil {
		log.Printf("Error creating trip: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create trip")
		return
	}
	trip.ID = ref.ID
	respondWithJSON(w, http.StatusCreated, trip)
}

func updateTrip(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "Missing trip ID")
		return
	}

	var trip Trip
	if err := decodeJSON(r, &trip); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if trip.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if trip.ColorByCountry == nil {
		trip.ColorByCountry = map[string]string{}
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

	var existing Trip
	_ = doc.DataTo(&existing)
	trip.CreatedAt = existing.CreatedAt
	trip.UpdatedAt = time.Now().UTC()

	if _, err := db.Collection(tripsCollection).Doc(id).Set(ctx, trip); err != nil {
		log.Printf("Error updating trip %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update trip")
		return
	}
	trip.ID = id
	respondWithJSON(w, http.StatusOK, trip)
}

func deleteTrip(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "Missing trip ID")
		return
	}

	if _, err := db.Collection(tripsCollection).Doc(id).Get(ctx); err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusNotFound, "Trip not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get trip")
		return
	}

	if err := deleteDaysForTrip(ctx, id); err != nil {
		log.Printf("Error deleting days for trip %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete trip days")
		return
	}
	if err := deleteJourneyForTrip(ctx, id); err != nil {
		log.Printf("Error deleting journey for trip %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete trip journey")
		return
	}

	if _, err := db.Collection(tripsCollection).Doc(id).Delete(ctx); err != nil {
		log.Printf("Error deleting trip %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete trip")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Trip deleted"})
}

func deleteDaysForTrip(ctx context.Context, tripID string) error {
	iter := db.Collection(daysCollection).Where("tripId", "==", tripID).Documents(ctx)
	defer iter.Stop()

	batch := db.Batch()
	count := 0
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return err
		}
		batch.Delete(doc.Ref)
		count++
		if count >= 400 {
			if _, err := batch.Commit(ctx); err != nil {
				return err
			}
			batch = db.Batch()
			count = 0
		}
	}
	if count > 0 {
		_, err := batch.Commit(ctx)
		return err
	}
	return nil
}

// --- DAYS ---

func listDays(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	tripID := r.URL.Query().Get("tripId")
	if tripID == "" {
		respondWithError(w, http.StatusBadRequest, "tripId query parameter is required")
		return
	}

	days := []TripDay{}
	iter := db.Collection(daysCollection).Where("tripId", "==", tripID).Documents(ctx)
	defer iter.Stop()

	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("Error iterating days: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to query days")
			return
		}

		var day TripDay
		if err := doc.DataTo(&day); err != nil {
			log.Printf("Error binding day data: %v", err)
			continue
		}
		day.ID = doc.Ref.ID
		normalizeDay(&day)
		days = append(days, day)
	}

	sort.SliceStable(days, func(i, j int) bool {
		if days[i].Date != days[j].Date {
			return days[i].Date < days[j].Date
		}
		return days[i].SortOrder < days[j].SortOrder
	})

	respondWithJSON(w, http.StatusOK, days)
}

func getDay(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "Missing day ID")
		return
	}

	doc, err := db.Collection(daysCollection).Doc(id).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusNotFound, "Day not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get day")
		return
	}

	var day TripDay
	if err := doc.DataTo(&day); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to parse day")
		return
	}
	day.ID = doc.Ref.ID
	normalizeDay(&day)
	respondWithJSON(w, http.StatusOK, day)
}

func createDay(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	var day TripDay
	if err := decodeJSON(r, &day); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if day.TripID == "" {
		respondWithError(w, http.StatusBadRequest, "tripId is required")
		return
	}
	if day.Date == "" {
		respondWithError(w, http.StatusBadRequest, "date is required")
		return
	}
	normalizeDay(&day)

	if _, err := db.Collection(tripsCollection).Doc(day.TripID).Get(ctx); err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusBadRequest, "Trip not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to verify trip")
		return
	}

	now := time.Now().UTC()
	day.CreatedAt = now
	day.UpdatedAt = now

	ref, _, err := db.Collection(daysCollection).Add(ctx, day)
	if err != nil {
		log.Printf("Error creating day: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to create day")
		return
	}
	day.ID = ref.ID
	respondWithJSON(w, http.StatusCreated, day)
}

func updateDay(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "Missing day ID")
		return
	}

	var day TripDay
	if err := decodeJSON(r, &day); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if day.TripID == "" {
		respondWithError(w, http.StatusBadRequest, "tripId is required")
		return
	}
	if day.Date == "" {
		respondWithError(w, http.StatusBadRequest, "date is required")
		return
	}
	normalizeDay(&day)

	doc, err := db.Collection(daysCollection).Doc(id).Get(ctx)
	if err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusNotFound, "Day not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get day")
		return
	}

	var existing TripDay
	_ = doc.DataTo(&existing)
	day.CreatedAt = existing.CreatedAt
	day.UpdatedAt = time.Now().UTC()

	if _, err := db.Collection(daysCollection).Doc(id).Set(ctx, day); err != nil {
		log.Printf("Error updating day %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to update day")
		return
	}
	day.ID = id
	respondWithJSON(w, http.StatusOK, day)
}

func deleteDay(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "Missing day ID")
		return
	}

	if _, err := db.Collection(daysCollection).Doc(id).Get(ctx); err != nil {
		if status.Code(err) == codes.NotFound {
			respondWithError(w, http.StatusNotFound, "Day not found")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get day")
		return
	}

	if _, err := db.Collection(daysCollection).Doc(id).Delete(ctx); err != nil {
		log.Printf("Error deleting day %s: %v", id, err)
		respondWithError(w, http.StatusInternalServerError, "Failed to delete day")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Day deleted"})
}

func reorderDays(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	var req ReorderRequest
	if err := decodeJSON(r, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}
	if len(req.Items) == 0 {
		respondWithError(w, http.StatusBadRequest, "items is required")
		return
	}

	batch := db.Batch()
	now := time.Now().UTC()
	for _, item := range req.Items {
		if item.ID == "" {
			continue
		}
		ref := db.Collection(daysCollection).Doc(item.ID)
		batch.Update(ref, []firestore.Update{
			{Path: "sortOrder", Value: item.SortOrder},
			{Path: "updatedAt", Value: now},
		})
	}

	if _, err := batch.Commit(ctx); err != nil {
		log.Printf("Error reordering days: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to reorder days")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Days reordered"})
}
