package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

const (
	backupPrefix     = "backups/"
	backupKeep       = 21
	adminTokenTTL    = 12 * time.Hour
	localBackupDir   = "backups"
	defaultBucketEnv = "BACKUP_BUCKET"
)

type firestoreBackup struct {
	CreatedAt string    `json:"createdAt"`
	Trips     []Trip    `json:"trips"`
	Days      []TripDay `json:"days"`
	Journeys  []Journey `json:"journeys"`
}

type backupMeta struct {
	ID        string `json:"id"`
	CreatedAt string `json:"createdAt"`
	Trips     int    `json:"trips"`
	Days      int    `json:"days"`
	Journeys  int    `json:"journeys"`
	Bytes     int64  `json:"bytes"`
}

func backupBucketName() string {
	if b := strings.TrimSpace(os.Getenv(defaultBucketEnv)); b != "" {
		return b
	}
	proj := strings.TrimSpace(os.Getenv("FIREBASE_PROJECT_ID"))
	if proj == "" {
		proj = projectIDFromServiceAccount()
	}
	if proj != "" {
		return proj + "-reise-backups"
	}
	return ""
}

func projectIDFromServiceAccount() string {
	keyPath := strings.TrimSpace(os.Getenv("FIREBASE_KEY_PATH"))
	if keyPath == "" {
		if _, err := os.Stat("service-account.json"); err == nil {
			keyPath = "service-account.json"
		}
	}
	if keyPath == "" {
		return ""
	}
	raw, err := os.ReadFile(keyPath)
	if err != nil {
		return ""
	}
	var partial struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.Unmarshal(raw, &partial); err != nil {
		return ""
	}
	return strings.TrimSpace(partial.ProjectID)
}

func cronSecret() string {
	return strings.TrimSpace(os.Getenv("BACKUP_CRON_SECRET"))
}

func osloLocation() *time.Location {
	oslo, err := time.LoadLocation("Europe/Oslo")
	if err != nil {
		return time.FixedZone("CEST", 2*3600)
	}
	return oslo
}

func newStorageClient(ctx context.Context) (*storage.Client, error) {
	keyPath := strings.TrimSpace(os.Getenv("FIREBASE_KEY_PATH"))
	if keyPath == "" {
		if _, err := os.Stat("service-account.json"); err == nil {
			keyPath = "service-account.json"
		}
	}
	if keyPath != "" {
		return storage.NewClient(ctx, option.WithCredentialsFile(keyPath))
	}
	return storage.NewClient(ctx)
}

func adminPassword() string {
	if p := strings.TrimSpace(os.Getenv("ADMIN_PASSWORD")); p != "" {
		return p
	}
	return "321"
}

func requireCronSecret(w http.ResponseWriter, r *http.Request) bool {
	want := cronSecret()
	if want == "" {
		respondWithError(w, http.StatusServiceUnavailable, "Backup-scheduler er ikke konfigurert")
		return false
	}
	got := strings.TrimSpace(r.Header.Get("X-Backup-Secret"))
	if subtle.ConstantTimeCompare([]byte(got), []byte(want)) != 1 {
		respondWithError(w, http.StatusUnauthorized, "Ugyldig backup-nøkkel")
		return false
	}
	return true
}

func requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	if adminPassword() == "" {
		respondWithError(w, http.StatusServiceUnavailable, "Admin er ikke konfigurert")
		return false
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	token := strings.TrimPrefix(auth, "Bearer ")
	if !validAdminToken(token) {
		respondWithError(w, http.StatusUnauthorized, "Logg inn som admin")
		return false
	}
	return true
}

func signAdminToken(exp time.Time) string {
	payload := strconv.FormatInt(exp.Unix(), 10)
	mac := hmac.New(sha256.New, []byte(adminPassword()))
	mac.Write([]byte("reise-admin|" + payload))
	return payload + "." + hex.EncodeToString(mac.Sum(nil))
}

func validAdminToken(token string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return false
	}
	expUnix, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || time.Now().Unix() > expUnix {
		return false
	}
	want := signAdminToken(time.Unix(expUnix, 0).UTC())
	return subtle.ConstantTimeCompare([]byte(token), []byte(want)) == 1
}

func adminLogin(w http.ResponseWriter, r *http.Request) {
	if adminPassword() == "" {
		respondWithError(w, http.StatusServiceUnavailable, "Admin er ikke konfigurert")
		return
	}
	var body struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respondWithError(w, http.StatusBadRequest, "Ugyldig JSON")
		return
	}
	if subtle.ConstantTimeCompare([]byte(strings.TrimSpace(body.Password)), []byte(adminPassword())) != 1 {
		respondWithError(w, http.StatusUnauthorized, "Feil passord")
		return
	}
	exp := time.Now().Add(adminTokenTTL)
	respondWithJSON(w, http.StatusOK, map[string]string{
		"token":     signAdminToken(exp),
		"expiresAt": exp.UTC().Format(time.RFC3339),
	})
}

func runScheduledBackup(w http.ResponseWriter, r *http.Request) {
	if !requireCronSecret(w, r) {
		return
	}
	meta, err := createBackup(r.Context())
	if err != nil {
		log.Printf("[Backup] scheduled: %v", err)
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, meta)
}

func adminCreateBackup(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	meta, err := createBackup(r.Context())
	if err != nil {
		log.Printf("[Backup] admin create: %v", err)
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, meta)
}

func adminListBackups(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	list, gcsCount, localCount, err := listBackups(r.Context())
	if err != nil {
		log.Printf("[Backup] list: %v", err)
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"backups":    list,
		"bucket":     backupBucketName(),
		"gcsCount":   gcsCount,
		"localCount": localCount,
	})
}

func adminRestoreBackup(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	var body struct {
		ID string `json:"id"`
	}
	if err := decodeJSON(r, &body); err != nil || strings.TrimSpace(body.ID) == "" {
		respondWithError(w, http.StatusBadRequest, "id er påkrevd")
		return
	}
	if err := restoreBackup(r.Context(), strings.TrimSpace(body.ID)); err != nil {
		log.Printf("[Backup] restore %s: %v", body.ID, err)
		respondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondWithJSON(w, http.StatusOK, map[string]string{"message": "Gjenopprettet"})
}

func createBackup(ctx context.Context) (backupMeta, error) {
	now := time.Now().In(osloLocation())
	snap := firestoreBackup{CreatedAt: now.Format(time.RFC3339)}

	trips, err := loadAllTrips(ctx)
	if err != nil {
		return backupMeta{}, err
	}
	days, err := loadAllDays(ctx)
	if err != nil {
		return backupMeta{}, err
	}
	journeys, err := loadAllJourneys(ctx)
	if err != nil {
		return backupMeta{}, err
	}
	snap.Trips = trips
	snap.Days = days
	snap.Journeys = journeys

	raw, err := json.MarshalIndent(snap, "", "  ")
	if err != nil {
		return backupMeta{}, err
	}
	id := backupPrefix + now.Format("2006-01-02T15-04-05") + ".json"
	if err := writeBackupObject(ctx, id, raw); err != nil {
		return backupMeta{}, err
	}
	if err := pruneOldBackups(ctx); err != nil {
		log.Printf("[Backup] prune: %v", err)
	}
	log.Printf("[Backup] wrote %s (%d trips, %d days, %d journeys)", id, len(trips), len(days), len(journeys))
	return backupMeta{
		ID:        id,
		CreatedAt: snap.CreatedAt,
		Trips:     len(trips),
		Days:      len(days),
		Journeys:  len(journeys),
		Bytes:     int64(len(raw)),
	}, nil
}

func loadAllTrips(ctx context.Context) ([]Trip, error) {
	iter := db.Collection(tripsCollection).Documents(ctx)
	defer iter.Stop()
	out := []Trip{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			return out, nil
		}
		if err != nil {
			return nil, err
		}
		var t Trip
		if err := doc.DataTo(&t); err != nil {
			return nil, err
		}
		t.ID = doc.Ref.ID
		out = append(out, t)
	}
}

func loadAllDays(ctx context.Context) ([]TripDay, error) {
	iter := db.Collection(daysCollection).Documents(ctx)
	defer iter.Stop()
	out := []TripDay{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			return out, nil
		}
		if err != nil {
			return nil, err
		}
		var d TripDay
		if err := doc.DataTo(&d); err != nil {
			return nil, err
		}
		d.ID = doc.Ref.ID
		out = append(out, d)
	}
}

func loadAllJourneys(ctx context.Context) ([]Journey, error) {
	iter := db.Collection(journeysCollection).Documents(ctx)
	defer iter.Stop()
	out := []Journey{}
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			return out, nil
		}
		if err != nil {
			return nil, err
		}
		var j Journey
		if err := doc.DataTo(&j); err != nil {
			return nil, err
		}
		j.ID = doc.Ref.ID
		out = append(out, j)
	}
}

func writeBackupObject(ctx context.Context, id string, raw []byte) error {
	if bucket := backupBucketName(); bucket != "" {
		client, err := newStorageClient(ctx)
		if err != nil {
			return fmt.Errorf("storage client: %w", err)
		}
		defer client.Close()
		w := client.Bucket(bucket).Object(id).NewWriter(ctx)
		w.ContentType = "application/json"
		if _, err := w.Write(raw); err != nil {
			_ = w.Close()
			return err
		}
		if err := w.Close(); err != nil {
			return err
		}
	}
	if err := os.MkdirAll(localBackupDir, 0o755); err != nil {
		return err
	}
	return os.WriteFile(path.Join(localBackupDir, path.Base(id)), raw, 0o644)
}

func readBackupObject(ctx context.Context, id string) ([]byte, error) {
	if !strings.HasPrefix(id, backupPrefix) || strings.Contains(id, "..") {
		return nil, fmt.Errorf("ugyldig backup-id")
	}
	if bucket := backupBucketName(); bucket != "" {
		client, err := newStorageClient(ctx)
		if err != nil {
			return nil, err
		}
		defer client.Close()
		r, err := client.Bucket(bucket).Object(id).NewReader(ctx)
		if err != nil {
			return nil, err
		}
		defer r.Close()
		return io.ReadAll(r)
	}
	return os.ReadFile(path.Join(localBackupDir, path.Base(id)))
}

func listBackups(ctx context.Context) ([]backupMeta, int, int, error) {
	type item struct {
		id   string
		size int64
	}
	seen := map[string]bool{}
	var items []item
	var gcsCount, localCount int

	addItem := func(id string, size int64) {
		if !strings.HasSuffix(id, ".json") || seen[id] {
			return
		}
		seen[id] = true
		items = append(items, item{id: id, size: size})
	}

	if bucket := backupBucketName(); bucket != "" {
		client, err := newStorageClient(ctx)
		if err != nil {
			return nil, 0, 0, err
		}
		defer client.Close()
		it := client.Bucket(bucket).Objects(ctx, &storage.Query{Prefix: backupPrefix})
		for {
			attrs, err := it.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				return nil, 0, 0, err
			}
			gcsCount++
			addItem(attrs.Name, attrs.Size)
		}
	}

	entries, err := os.ReadDir(localBackupDir)
	if err == nil {
		for _, e := range entries {
			if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
				continue
			}
			localCount++
			info, _ := e.Info()
			var size int64
			if info != nil {
				size = info.Size()
			}
			addItem(backupPrefix+e.Name(), size)
		}
	} else if !os.IsNotExist(err) && backupBucketName() == "" {
		return nil, 0, 0, err
	}

	sort.Slice(items, func(i, j int) bool { return items[i].id > items[j].id })
	out := make([]backupMeta, 0, len(items))
	for _, it := range items {
		meta := backupMetaFromID(it.id, it.size)
		if raw, err := readBackupObject(ctx, it.id); err == nil {
			meta = enrichBackupMeta(meta, raw)
		}
		out = append(out, meta)
	}
	return out, gcsCount, localCount, nil
}

func backupMetaFromID(id string, size int64) backupMeta {
	created := strings.TrimSuffix(strings.TrimPrefix(id, backupPrefix), ".json")
	if t, err := time.ParseInLocation("2006-01-02T15-04-05", created, osloLocation()); err == nil {
		created = t.Format(time.RFC3339)
	}
	return backupMeta{ID: id, CreatedAt: created, Bytes: size}
}

func enrichBackupMeta(meta backupMeta, raw []byte) backupMeta {
	var partial struct {
		Trips    []json.RawMessage `json:"trips"`
		Days     []json.RawMessage `json:"days"`
		Journeys []json.RawMessage `json:"journeys"`
	}
	if err := json.Unmarshal(raw, &partial); err != nil {
		return meta
	}
	meta.Trips = len(partial.Trips)
	meta.Days = len(partial.Days)
	meta.Journeys = len(partial.Journeys)
	return meta
}

func pruneOldBackups(ctx context.Context) error {
	list, _, _, err := listBackups(ctx)
	if err != nil || len(list) <= backupKeep {
		return err
	}
	drop := list[backupKeep:]
	if bucket := backupBucketName(); bucket != "" {
		client, err := newStorageClient(ctx)
		if err != nil {
			return err
		}
		defer client.Close()
		for _, m := range drop {
			if err := client.Bucket(bucket).Object(m.ID).Delete(ctx); err != nil {
				log.Printf("[Backup] delete %s: %v", m.ID, err)
			}
		}
		return nil
	}
	for _, m := range drop {
		_ = os.Remove(path.Join(localBackupDir, path.Base(m.ID)))
	}
	return nil
}

func restoreBackup(ctx context.Context, id string) error {
	raw, err := readBackupObject(ctx, id)
	if err != nil {
		return err
	}
	var snap firestoreBackup
	if err := json.Unmarshal(raw, &snap); err != nil {
		return err
	}
	if err := replaceCollection(ctx, tripsCollection, tripIDs(snap.Trips), func(batch setFn) error {
		for _, t := range snap.Trips {
			id := t.ID
			t.ID = ""
			if err := batch(id, t); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}
	if err := replaceCollection(ctx, daysCollection, dayIDs(snap.Days), func(batch setFn) error {
		for _, d := range snap.Days {
			id := d.ID
			d.ID = ""
			if err := batch(id, d); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}
	return replaceCollection(ctx, journeysCollection, journeyIDs(snap.Journeys), func(batch setFn) error {
		for _, j := range snap.Journeys {
			id := j.ID
			j.ID = ""
			if err := batch(id, j); err != nil {
				return err
			}
		}
		return nil
	})
}

type setFn func(id string, data interface{}) error

func replaceCollection(ctx context.Context, collection string, keep map[string]bool, write func(setFn) error) error {
	existing := map[string]bool{}
	iter := db.Collection(collection).Documents(ctx)
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			iter.Stop()
			return err
		}
		existing[doc.Ref.ID] = true
	}
	iter.Stop()

	batch := db.Batch()
	n := 0
	flush := func() error {
		if n == 0 {
			return nil
		}
		if _, err := batch.Commit(ctx); err != nil {
			return err
		}
		batch = db.Batch()
		n = 0
		return nil
	}
	set := func(id string, data interface{}) error {
		if id == "" {
			return fmt.Errorf("mangler dokument-id i %s", collection)
		}
		batch.Set(db.Collection(collection).Doc(id), data)
		n++
		if n >= 400 {
			return flush()
		}
		return nil
	}
	if err := write(set); err != nil {
		return err
	}
	if err := flush(); err != nil {
		return err
	}
	for id := range existing {
		if keep[id] {
			continue
		}
		batch.Delete(db.Collection(collection).Doc(id))
		n++
		if n >= 400 {
			if err := flush(); err != nil {
				return err
			}
		}
	}
	return flush()
}

func tripIDs(items []Trip) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, t := range items {
		if t.ID != "" {
			m[t.ID] = true
		}
	}
	return m
}

func dayIDs(items []TripDay) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, d := range items {
		if d.ID != "" {
			m[d.ID] = true
		}
	}
	return m
}

func journeyIDs(items []Journey) map[string]bool {
	m := make(map[string]bool, len(items))
	for _, j := range items {
		if j.ID != "" {
			m[j.ID] = true
		}
	}
	return m
}
