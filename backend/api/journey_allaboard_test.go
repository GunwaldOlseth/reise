package main

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

func TestAllAboardTimeJSONRoundTrip(t *testing.T) {
	raw := []byte(`{
		"tripId": "trip_1",
		"stops": [{
			"id": "stop_cruise",
			"city": "Bergen",
			"country": "Norge",
			"arriveDate": "2026-09-01",
			"kind": "cruise",
			"sortOrder": 0,
			"pack": {
				"nights": 2,
				"title": "Testskip",
				"basePlace": "Bergen",
				"days": [
					{
						"id": "d0",
						"offset": "0",
						"atSea": false,
						"city": "Bergen",
						"arriveTime": "",
						"leaveTime": "17:00",
						"allAboardTime": "16:30"
					},
					{
						"id": "d1",
						"offset": 1,
						"atSea": false,
						"city": "Flam",
						"arriveTime": "08:00",
						"leaveTime": "16:00",
						"allAboard": "15:30"
					}
				]
			}
		}],
		"legs": []
	}`)

	var j Journey
	if err := json.Unmarshal(raw, &j); err != nil {
		t.Fatalf("unmarshal PUT body: %v", err)
	}
	if j.Stops[0].Pack == nil {
		t.Fatal("pack is nil after decode")
	}
	if j.Stops[0].Pack.Days[0].Offset != 0 {
		t.Fatalf("string offset should decode to 0, got %d", j.Stops[0].Pack.Days[0].Offset)
	}
	if j.Stops[0].Pack.Days[0].AllAboardTime != "16:30" {
		t.Fatalf("after decode day0 allAboardTime=%q", j.Stops[0].Pack.Days[0].AllAboardTime)
	}
	if j.Stops[0].Pack.Days[1].AllAboardTime != "15:30" {
		t.Fatalf("alias allAboard should map to allAboardTime, got %q", j.Stops[0].Pack.Days[1].AllAboardTime)
	}

	normalizeJourney(&j)
	if j.Stops[0].Pack.Days[0].AllAboardTime != "16:30" {
		t.Fatalf("after normalize day0 allAboardTime=%q", j.Stops[0].Pack.Days[0].AllAboardTime)
	}

	out, err := json.Marshal(j)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(out), `"allAboardTime":"16:30"`) {
		t.Fatalf("response JSON missing allAboardTime:\n%s", out)
	}

	var again Journey
	if err := json.Unmarshal(out, &again); err != nil {
		t.Fatalf("re-unmarshal: %v", err)
	}
	normalizeJourney(&again)
	got := again.Stops[0].Pack.Days[0].AllAboardTime
	if got != "16:30" {
		t.Fatalf("round-trip allAboardTime=%q", got)
	}
}

func TestTripDayJSONRoundTripAllAboard(t *testing.T) {
	raw := []byte(`{
		"tripId": "t1",
		"date": "2026-09-02",
		"sortOrder": 1,
		"country": "Norge",
		"city": "Flam",
		"arriveTime": "08:00",
		"leaveTime": "16:00",
		"allAboardTime": "15:45",
		"hotelName": "",
		"hotelUrl": "",
		"address": "",
		"checkIn": "",
		"checkOut": "",
		"transportNext": "",
		"notes": ""
	}`)
	var day TripDay
	if err := json.Unmarshal(raw, &day); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if day.AllAboardTime != "15:45" {
		t.Fatalf("TripDay.AllAboardTime=%q (classic day PUT used to drop this field)", day.AllAboardTime)
	}
	out, err := json.Marshal(day)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	if !strings.Contains(string(out), `"allAboardTime":"15:45"`) {
		t.Fatalf("marshaled JSON missing allAboardTime: %s", out)
	}
}

func TestPackageDayClockFieldsNotOmitempty(t *testing.T) {
	typ := reflect.TypeOf(JourneyPackageDay{})
	for _, name := range []string{"ArriveTime", "LeaveTime", "AllAboardTime"} {
		f, ok := typ.FieldByName(name)
		if !ok {
			t.Fatalf("missing field %s", name)
		}
		if tag := f.Tag.Get("firestore"); strings.Contains(tag, "omitempty") {
			t.Fatalf("%s firestore tag %q must not omitempty (full Set deletes omitted times)", name, tag)
		}
		if tag := f.Tag.Get("json"); strings.Contains(tag, "omitempty") {
			t.Fatalf("%s json tag %q must not omitempty", name, tag)
		}
	}
}
