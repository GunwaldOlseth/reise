package main

import "testing"

func TestDropCountryNameFalsePositivesRoma(t *testing.T) {
	list := []placeSuggestion{
		{Name: "Romania", FeatureCode: "PCLI", Population: 19_000_000},
		{Name: "Roma", FeatureCode: "PPLC", Population: 2_300_000, Country: "Italy"},
	}
	out := dropCountryNameFalsePositives("Roma", list)
	if len(out) != 1 {
		t.Fatalf("want 1 place, got %d", len(out))
	}
	if out[0].Name != "Roma" {
		t.Fatalf("want Roma, got %q", out[0].Name)
	}
}

func TestGeocodeCityForSearchRoma(t *testing.T) {
	if got := geocodeCityForSearch("Roma", "Italy"); got != "Rome" {
		t.Fatalf("Roma+Italy: want Rome, got %q", got)
	}
	if got := geocodeCityForSearch("roma", ""); got != "Rome" {
		t.Fatalf("roma: want Rome, got %q", got)
	}
}