package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

const (
	uploadPrefix   = "uploads/"
	localUploadDir = "uploads"
	maxUploadBytes = 10 << 20 // 10 MB
)

// uploadName allows only a flat file name (uuid + extension) — no path traversal.
var uploadName = regexp.MustCompile(`^[A-Za-z0-9._-]+$`)

// uploadsBucketName is the GCS bucket for user images. When unset, images are
// stored on local disk (dev). Kept separate from the backup bucket on purpose.
func uploadsBucketName() string {
	return strings.TrimSpace(os.Getenv("UPLOAD_BUCKET"))
}

// imageExtForType maps an accepted image content type to a file extension.
// Returns "" for unsupported types.
func imageExtForType(contentType string) string {
	switch strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0])) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/heic", "image/heif":
		return ".heic"
	default:
		return ""
	}
}

// contentTypeForName infers a content type from a stored file name's extension.
func contentTypeForName(name string) string {
	switch strings.ToLower(path.Ext(name)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	case ".heic", ".heif":
		return "image/heic"
	default:
		return "application/octet-stream"
	}
}

func uploadImage(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	if err := r.ParseMultipartForm(maxUploadBytes); err != nil {
		respondWithError(w, http.StatusBadRequest, "Bildet er for stort eller ugyldig (maks 10 MB)")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Mangler fil ('file')")
		return
	}
	defer file.Close()

	raw, err := io.ReadAll(file)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Kunne ikke lese filen")
		return
	}

	// Trust the sniffed content type over the client-provided header.
	contentType := http.DetectContentType(raw)
	if !strings.HasPrefix(contentType, "image/") {
		// DetectContentType cannot sniff HEIC/WEBP reliably; fall back to header.
		if h := header.Header.Get("Content-Type"); strings.HasPrefix(h, "image/") {
			contentType = h
		}
	}
	ext := imageExtForType(contentType)
	if ext == "" {
		respondWithError(w, http.StatusUnsupportedMediaType, "Filtypen støttes ikke (bruk JPEG, PNG, WEBP, GIF eller HEIC)")
		return
	}

	name := uuid.NewString() + ext
	object := uploadPrefix + name
	if err := writeUploadObject(ctx, object, raw, contentType); err != nil {
		log.Printf("Error storing upload %s: %v", object, err)
		respondWithError(w, http.StatusInternalServerError, "Kunne ikke lagre bildet")
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]string{
		"id":          name,
		"url":         "/api/uploads/" + name,
		"contentType": contentType,
	})
}

func serveUpload(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	name := r.PathValue("name")
	if name == "" || !uploadName.MatchString(name) || strings.Contains(name, "..") {
		respondWithError(w, http.StatusBadRequest, "Ugyldig bilde-id")
		return
	}

	raw, contentType, err := readUploadObject(ctx, uploadPrefix+name)
	if err != nil {
		if os.IsNotExist(err) {
			respondWithError(w, http.StatusNotFound, "Bildet finnes ikke")
			return
		}
		log.Printf("Error reading upload %s: %v", name, err)
		respondWithError(w, http.StatusInternalServerError, "Kunne ikke hente bildet")
		return
	}
	if contentType == "" {
		contentType = contentTypeForName(name)
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(raw)
}

func writeUploadObject(ctx context.Context, object string, raw []byte, contentType string) error {
	if bucket := uploadsBucketName(); bucket != "" {
		client, err := newStorageClient(ctx)
		if err != nil {
			return fmt.Errorf("storage client: %w", err)
		}
		defer client.Close()
		wr := client.Bucket(bucket).Object(object).NewWriter(ctx)
		wr.ContentType = contentType
		wr.CacheControl = "public, max-age=31536000, immutable"
		if _, err := wr.Write(raw); err != nil {
			_ = wr.Close()
			return err
		}
		return wr.Close()
	}
	if err := os.MkdirAll(localUploadDir, 0o755); err != nil {
		return err
	}
	return os.WriteFile(path.Join(localUploadDir, path.Base(object)), raw, 0o644)
}

func readUploadObject(ctx context.Context, object string) ([]byte, string, error) {
	if bucket := uploadsBucketName(); bucket != "" {
		client, err := newStorageClient(ctx)
		if err != nil {
			return nil, "", err
		}
		defer client.Close()
		obj := client.Bucket(bucket).Object(object)
		rd, err := obj.NewReader(ctx)
		if err != nil {
			return nil, "", err
		}
		defer rd.Close()
		raw, err := io.ReadAll(rd)
		if err != nil {
			return nil, "", err
		}
		return raw, rd.Attrs.ContentType, nil
	}
	raw, err := os.ReadFile(path.Join(localUploadDir, path.Base(object)))
	if err != nil {
		return nil, "", err
	}
	return raw, contentTypeForName(object), nil
}
