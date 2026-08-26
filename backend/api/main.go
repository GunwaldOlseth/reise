package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	log.Println("[API Server] Starting Reise backend API...")

	initFirestore()
	defer func() {
		if db != nil {
			log.Println("[API Server] Closing Firestore client...")
			db.Close()
		}
	}()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", healthCheck)

	mux.HandleFunc("GET /api/trips", listTrips)
	mux.HandleFunc("POST /api/trips", createTrip)
	mux.HandleFunc("GET /api/trips/{id}/calendar.ics", exportTripCalendar)
	mux.HandleFunc("GET /api/trips/{id}", getTrip)
	mux.HandleFunc("PUT /api/trips/{id}", updateTrip)
	mux.HandleFunc("DELETE /api/trips/{id}", deleteTrip)
	mux.HandleFunc("GET /api/trips/{id}/journey", getJourney)
	mux.HandleFunc("PUT /api/trips/{id}/journey", putJourney)
	mux.HandleFunc("POST /api/trips/{id}/share", createTripShare)
	mux.HandleFunc("DELETE /api/trips/{id}/share", deleteTripShare)
	mux.HandleFunc("GET /api/share/{token}", getSharedItinerary)

	mux.HandleFunc("GET /api/days", listDays)
	mux.HandleFunc("POST /api/days", createDay)
	mux.HandleFunc("PUT /api/days/reorder", reorderDays)
	mux.HandleFunc("GET /api/days/{id}", getDay)
	mux.HandleFunc("PUT /api/days/{id}", updateDay)
	mux.HandleFunc("DELETE /api/days/{id}", deleteDay)

	mux.HandleFunc("GET /api/weather", getWeather)
	mux.HandleFunc("GET /api/weather/history", getWeatherHistory)
	mux.HandleFunc("GET /api/places", getPlaces)

	mux.HandleFunc("POST /api/uploads", uploadImage)
	mux.HandleFunc("GET /api/uploads/{name}", serveUpload)

	mux.HandleFunc("POST /api/internal/backup", runScheduledBackup)
	mux.HandleFunc("POST /api/internal/weather-refresh", runScheduledWeatherRefresh)
	mux.HandleFunc("POST /api/admin/login", adminLogin)
	mux.HandleFunc("GET /api/admin/backups", adminListBackups)
	mux.HandleFunc("POST /api/admin/backups", adminCreateBackup)
	mux.HandleFunc("POST /api/admin/backups/restore", adminRestoreBackup)

	handler := corsMiddleware(mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}

	log.Printf("[API Server] Listening on port %s...", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("[API Server] Server failed to start: %v", err)
	}
}
