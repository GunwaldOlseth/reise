package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestJourneyStayBookedJSONRoundTrip(t *testing.T) {
	raw := []byte(`{
		"tripId": "trip_1",
		"stops": [{
			"id": "stop_1",
			"city": "Rapallo",
			"country": "Italia",
			"arriveDate": "2026-09-02",
			"kind": "place",
			"sortOrder": 0,
			"stay": {
				"nights": 2,
				"kind": "hotel",
				"hotelName": "Hotel Cavour",
				"booked": true,
				"bookedWhere": " Booking.com "
			}
		}],
		"legs": []
	}`)

	var j Journey
	if err := json.Unmarshal(raw, &j); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	stay := j.Stops[0].Stay
	if stay == nil {
		t.Fatal("stay is nil after decode")
	}
	if !stay.Booked {
		t.Fatal("booked should be true after decode")
	}
	if stay.BookedWhere != " Booking.com " {
		t.Fatalf("bookedWhere=%q", stay.BookedWhere)
	}

	normalizeJourney(&j)
	if j.Stops[0].Stay.BookedWhere != "Booking.com" {
		t.Fatalf("after normalize bookedWhere=%q", j.Stops[0].Stay.BookedWhere)
	}

	out, err := json.Marshal(j)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	body := string(out)
	if !strings.Contains(body, `"booked":true`) {
		t.Fatalf("response JSON missing booked:\n%s", body)
	}
	if !strings.Contains(body, `"bookedWhere":"Booking.com"`) {
		t.Fatalf("response JSON missing bookedWhere:\n%s", body)
	}
}
