package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestFormatShareHopTimeOnly(t *testing.T) {
	via := JourneyVia{
		Title: "Bergen",
		Options: []JourneyTransportOption{{
			Mode:      "train",
			StartTime: "08:30",
			EndTime:   "10:15",
			Taken:     true,
		}},
	}
	label := formatShareHop(via)
	if strings.Contains(label, "Tog") || strings.Contains(label, "Fly") {
		t.Fatalf("should not include mode label: %q", label)
	}
	if label != "08:30–10:15" {
		t.Fatalf("expected only time span, got %q", label)
	}
	if strings.Contains(label, "Bergen") {
		t.Fatalf("should not include place: %q", label)
	}
}

func TestShareSubsForCruiseStop(t *testing.T) {
	stop := JourneyStop{
		ID:         "cruise1",
		Kind:       "cruise",
		ArriveDate: "2026-09-01",
		Pack: &JourneyPackage{
			Nights:    2,
			Title:     "Testskip",
			BasePlace: "Bergen",
			Days: []JourneyPackageDay{
				{ID: "d0", Offset: 0, City: "Bergen", LeaveTime: "17:00"},
				{ID: "d1", Offset: 1, City: "Flam", ArriveTime: "08:00", LeaveTime: "16:00", AllAboardTime: "15:30"},
				{ID: "d2", Offset: 2, City: "Oslo", AtSea: true},
			},
		},
	}
	subs := shareSubsForStop(stop)
	if len(subs) != 3 {
		t.Fatalf("expected 3 subs (0..nights), got %d: %v", len(subs), subs)
	}
	if !strings.Contains(subs[1].Label, "Flam") {
		t.Fatalf("second day missing port: %q", subs[1].Label)
	}
	if !strings.Contains(subs[1].Label, "08:00–16:00") {
		t.Fatalf("expected clock span without Ank/Avg: %q", subs[1].Label)
	}
	if strings.Contains(subs[1].Label, "Ank.") || strings.Contains(subs[1].Label, "Avg.") {
		t.Fatalf("should not include departure labels: %q", subs[1].Label)
	}
	if !strings.Contains(subs[2].Label, "Oslo") {
		t.Fatalf("at-sea day should list city: %q", subs[2].Label)
	}
	if !strings.Contains(subs[2].Label, "Til sjøs") {
		t.Fatalf("at-sea day should mention til sjøs: %q", subs[2].Label)
	}
}

func TestBuildShareItineraryIncludesSubs(t *testing.T) {
	trip := Trip{Name: "Test", StartDate: "2026-09-01", EndDate: "2026-09-05"}
	j := Journey{
		Stops: []JourneyStop{
			{
				ID:         "cruise1",
				Kind:       "cruise",
				ArriveDate: "2026-09-01",
				SortOrder:  0,
				Pack: &JourneyPackage{
					Nights: 1,
					Title:  "Skip",
					Days: []JourneyPackageDay{
						{ID: "d0", Offset: 0, City: "Bergen"},
					},
				},
			},
			{
				ID:         "place1",
				Kind:       "place",
				City:       "Oslo",
				ArriveDate: "2026-09-03",
				SortOrder:  1,
			},
		},
		Legs: []JourneyLeg{{
			FromStopID: "cruise1",
			ToStopID:   "place1",
			Vias: []JourneyVia{{
				Title: "Oslo",
				Options: []JourneyTransportOption{{
					Mode:      "flight",
					StartTime: "12:00",
					EndTime:   "13:30",
					Taken:     true,
				}},
			}},
		}},
	}
	out := buildShareItinerary(trip, j)
	if len(out.Places) != 2 {
		t.Fatalf("places=%d", len(out.Places))
	}
	if len(out.Places[0].Subs) != 2 {
		t.Fatalf("expected 2 cruise subs (0..1 nights), got %d", len(out.Places[0].Subs))
	}
	hop := out.Places[0].Hops[0].Label
	if hop != "12:00–13:30" {
		t.Fatalf("hop should be time-only: %q", hop)
	}

	raw, err := json.Marshal(out)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"subs"`) {
		t.Fatalf("json missing subs: %s", raw)
	}
}
