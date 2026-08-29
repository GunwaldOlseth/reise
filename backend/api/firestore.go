package main

import (
	"context"
	"log"
	"os"
	"strings"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"google.golang.org/api/option"
)

// db is the global firestore client instance
var db *firestore.Client

func firestoreProjectID() string {
	if projID := strings.TrimSpace(os.Getenv("FIREBASE_PROJECT_ID")); projID != "" {
		return projID
	}
	return "homey-376215"
}

// initFirestore initializes the global Firestore client.
func initFirestore() {
	ctx := context.Background()
	projID := firestoreProjectID()

	if emu := strings.TrimSpace(os.Getenv("FIRESTORE_EMULATOR_HOST")); emu != "" {
		log.Printf("[Firestore] Using emulator %s (project %s)", emu, projID)
		client, err := firestore.NewClient(ctx, projID)
		if err != nil {
			log.Fatalf("[Firestore] Error connecting to emulator: %v", err)
		}
		db = client
		log.Println("[Firestore] Emulator client initialized.")
		return
	}

	var opts []option.ClientOption
	keyPath := os.Getenv("FIREBASE_KEY_PATH")
	if keyPath == "" {
		if _, err := os.Stat("service-account.json"); err == nil {
			keyPath = "service-account.json"
		}
	}
	if keyPath != "" {
		if _, err := os.Stat(keyPath); err != nil {
			log.Printf("[Firestore] Key file not found (%s) — falling back to ADC", keyPath)
			keyPath = ""
		}
	}

	if keyPath != "" {
		log.Printf("[Firestore] Initializing using service account key from: %s", keyPath)
		opts = append(opts, option.WithCredentialsFile(keyPath))
	} else {
		log.Println("[Firestore] Initializing using application default credentials (no key path provided)")
	}

	conf := &firebase.Config{ProjectID: projID}
	log.Printf("[Firestore] Explicit project ID configured: %s", projID)

	app, err := firebase.NewApp(ctx, conf, opts...)
	if err != nil {
		log.Fatalf("[Firestore] Error initializing Firebase app: %v", err)
	}

	client, err := app.Firestore(ctx)
	if err != nil {
		log.Fatalf("[Firestore] Error getting Firestore client: %v", err)
	}

	db = client
	log.Println("[Firestore] Client successfully initialized.")
}
