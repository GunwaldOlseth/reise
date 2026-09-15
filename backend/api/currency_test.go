package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCurrencyForCountryItaly(t *testing.T) {
	code, ok := currencyForCountry("Italy")
	if !ok || code != "EUR" {
		t.Fatalf("expected EUR, got %q ok=%v", code, ok)
	}
}

func TestResolveCountryEnglishNorwegian(t *testing.T) {
	en := resolveCountryEnglish("Italia", "")
	if en != "Italy" {
		t.Fatalf("expected Italy, got %q", en)
	}
}

func TestGetCurrencyHandlerNok(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/currency?country=Norge", nil)
	rr := httptest.NewRecorder()
	getCurrency(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d", rr.Code)
	}
	var body currencyResponse
	if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if !body.IsNok || body.CurrencyCode != "NOK" {
		t.Fatalf("unexpected body: %+v", body)
	}
}
