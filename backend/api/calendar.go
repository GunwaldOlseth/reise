package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"google.golang.org/api/iterator"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func escapeICS(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, "\r\n", `\n`)
	value = strings.ReplaceAll(value, "\n", `\n`)
	value = strings.ReplaceAll(value, ",", `\,`)
	value = strings.ReplaceAll(value, ";", `\;`)
	return value
}

func foldICS(line string) string {
	if len(line) <= 75 {
		return line
	}
	var b strings.Builder
	b.WriteString(line[:75])
	rest := line[75:]
	for len(rest) > 0 {
		b.WriteString("\r\n ")
		n := 74
		if n > len(rest) {
			n = len(rest)
		}
		b.WriteString(rest[:n])
		rest = rest[n:]
	}
	return b.String()
}

func icsLines(rows ...string) string {
	out := make([]string, 0, len(rows))
	for _, row := range rows {
		if row == "" {
			continue
		}
		out = append(out, foldICS(row))
	}
	return strings.Join(out, "\r\n")
}

func dateOnlyICS(iso string) string {
	return strings.ReplaceAll(iso, "-", "")
}

func nextDateICS(iso string) (string, error) {
	d, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return "", err
	}
	return d.AddDate(0, 0, 1).Format("2006-01-02"), nil
}

var timeRe = regexp.MustCompile(`^(\d{1,2})[:.]?(\d{2})?`)

func parseTimeICS(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", false
	}
	m := timeRe.FindStringSubmatch(raw)
	if m == nil {
		return "", false
	}
	h, _ := strconv.Atoi(m[1])
	min := 0
	if m[2] != "" {
		min, _ = strconv.Atoi(m[2])
	}
	if h > 23 || min > 59 {
		return "", false
	}
	return fmt.Sprintf("%02d%02d00", h, min), true
}

func itemTypeLabelNO(t string) string {
	switch t {
	case ItemHotel:
		return "Hotell"
	case ItemCruise:
		return "Cruise"
	case ItemFlight: // same value as LegFlight
		return "Fly"
	case ItemTrain: // same value as LegTrain
		return "Tog"
	case ItemBus: // same value as LegBus
		return "Buss"
	case LegTram:
		return "Bane/trikk"
	case ItemTaxi: // same value as LegTaxi
		return "Taxi"
	case LegWalk:
		return "Gå"
	case LegOther:
		return "Annet"
	case ItemAttraction:
		return "Severdighet"
	default:
		return t
	}
}

func isTransport(t string) bool {
	return t == ItemFlight || t == ItemTrain || t == ItemBus || t == ItemTaxi
}

func dayDescriptionICS(day TripDay) string {
	var parts []string
	if day.AtSea || strings.EqualFold(strings.TrimSpace(day.City), "Til sjøs") ||
		strings.EqualFold(strings.TrimSpace(day.City), "Til havs") {
		parts = append(parts, "Til sjøs")
	} else if day.City != "" || day.Country != "" {
		loc := day.City
		if day.Country != "" {
			if loc != "" {
				loc += ", "
			}
			loc += day.Country
		}
		parts = append(parts, loc)
	}
	if strings.TrimSpace(day.Notes) != "" {
		parts = append(parts, strings.TrimSpace(day.Notes))
	}
	if len(day.ViaPoints) > 0 {
		route := make([]string, 0, len(day.ViaPoints)*2)
		for i, point := range day.ViaPoints {
			title := point.Title
			if title == "" {
				title = fmt.Sprintf("Via %d", i+1)
			}
			route = append(route, title)
			if i < len(day.Legs) && i+1 < len(day.ViaPoints) {
				leg := day.Legs[i]
				mode := itemTypeLabelNO(leg.Mode)
				if leg.Mode == LegWalk {
					mode = "Gå"
				} else if leg.Mode == LegOther {
					mode = "Annet"
				}
				if leg.Title != "" {
					mode += " " + leg.Title
				}
				route = append(route, "["+mode+"]")
			}
		}
		parts = append(parts, "Rute: "+strings.Join(route, " → "))
	}
	for _, item := range day.Items {
		title := item.Title
		if title == "" {
			title = itemTypeLabelNO(item.Type)
		}
		bit := itemTypeLabelNO(item.Type) + ": " + title
		if isTransport(item.Type) && (item.From != "" || item.To != "") {
			bit += " · " + item.From + " → " + item.To
		}
		if item.Address != "" {
			bit += " · " + item.Address
		}
		if item.StartTime != "" || item.EndTime != "" {
			bit += " · " + strings.Trim(item.StartTime+"–"+item.EndTime, "–")
		}
		if item.URL != "" {
			bit += " · " + item.URL
		}
		parts = append(parts, bit)
	}
	return strings.Join(parts, "\n")
}

func buildTripICS(trip Trip, days []TripDay) string {
	dtstamp := time.Now().UTC().Format("20060102T150405Z")
	var events []string

	sort.SliceStable(days, func(i, j int) bool {
		if days[i].Date != days[j].Date {
			return days[i].Date < days[j].Date
		}
		return days[i].SortOrder < days[j].SortOrder
	})

	for _, day := range days {
		if day.Date == "" {
			continue
		}
		next, err := nextDateICS(day.Date)
		if err != nil {
			continue
		}
		place := day.City
		if day.Country != "" {
			if place != "" {
				place += ", "
			}
			place += day.Country
		}
		summary := trip.Name + ": "
		if day.City != "" {
			summary += day.City
		} else if day.Country != "" {
			summary += day.Country
		} else {
			summary += "Reisedag"
		}
		desc := dayDescriptionICS(day)
		events = append(events, icsLines(
			"BEGIN:VEVENT",
			"UID:day-"+day.ID+"@reise.app",
			"DTSTAMP:"+dtstamp,
			"DTSTART;VALUE=DATE:"+dateOnlyICS(day.Date),
			"DTEND;VALUE=DATE:"+dateOnlyICS(next),
			"SUMMARY:"+escapeICS(summary),
			func() string {
				if desc == "" {
					return ""
				}
				return "DESCRIPTION:" + escapeICS(desc)
			}(),
			func() string {
				if place == "" {
					return ""
				}
				return "LOCATION:" + escapeICS(place)
			}(),
			"CATEGORIES:Reise",
			"END:VEVENT",
		))

		for _, item := range day.Items {
			start, hasStart := parseTimeICS(item.StartTime)
			end, hasEnd := parseTimeICS(item.EndTime)
			title := item.Title
			if title == "" {
				title = itemTypeLabelNO(item.Type)
			}
			itemSummary := itemTypeLabelNO(item.Type) + ": " + title
			if isTransport(item.Type) && (item.From != "" || item.To != "") {
				itemSummary += " (" + item.From + " → " + item.To + ")"
			}
			var itemDescParts []string
			if item.Address != "" {
				itemDescParts = append(itemDescParts, item.Address)
			}
			if item.Notes != "" {
				itemDescParts = append(itemDescParts, item.Notes)
			}
			if item.URL != "" {
				itemDescParts = append(itemDescParts, item.URL)
			}
			itemDesc := strings.Join(itemDescParts, "\n")
			loc := item.Address
			if loc == "" {
				loc = place
			}

			if hasStart {
				startDT := dateOnlyICS(day.Date) + "T" + start
				endDT := startDT
				if hasEnd {
					endDT = dateOnlyICS(day.Date) + "T" + end
					if end <= start {
						endDT = dateOnlyICS(next) + "T" + end
					}
				} else {
					h, _ := strconv.Atoi(start[:2])
					m, _ := strconv.Atoi(start[2:4])
					t, _ := time.Parse("2006-01-02 15:04", fmt.Sprintf("%s %02d:%02d", day.Date, h, m))
					t = t.Add(time.Hour)
					endDT = t.Format("20060102T150405")
				}
				events = append(events, icsLines(
					"BEGIN:VEVENT",
					fmt.Sprintf("UID:item-%s-%d@reise.app", day.ID, item.SortOrder),
					"DTSTAMP:"+dtstamp,
					"DTSTART:"+startDT,
					"DTEND:"+endDT,
					"SUMMARY:"+escapeICS(itemSummary),
					func() string {
						if itemDesc == "" {
							return ""
						}
						return "DESCRIPTION:" + escapeICS(itemDesc)
					}(),
					func() string {
						if loc == "" {
							return ""
						}
						return "LOCATION:" + escapeICS(loc)
					}(),
					"CATEGORIES:Reise,"+escapeICS(itemTypeLabelNO(item.Type)),
					"END:VEVENT",
				))
			} else if item.Type == ItemHotel && (item.Title != "" || item.Address != "") {
				events = append(events, icsLines(
					"BEGIN:VEVENT",
					"UID:hotel-"+day.ID+"-"+strconv.Itoa(item.SortOrder)+"@reise.app",
					"DTSTAMP:"+dtstamp,
					"DTSTART;VALUE=DATE:"+dateOnlyICS(day.Date),
					"DTEND;VALUE=DATE:"+dateOnlyICS(next),
					"SUMMARY:"+escapeICS("Hotell: "+title),
					func() string {
						if itemDesc == "" {
							return ""
						}
						return "DESCRIPTION:" + escapeICS(itemDesc)
					}(),
					func() string {
						if loc == "" {
							return ""
						}
						return "LOCATION:" + escapeICS(loc)
					}(),
					"CATEGORIES:Reise,Hotell",
					"END:VEVENT",
				))
			}
		}
	}

	cal := []string{
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Reise//Reiseplanlegger//NO",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"X-WR-CALNAME:" + escapeICS(trip.Name),
		"X-WR-CALDESC:" + escapeICS("Reiseplan: "+trip.Name),
	}
	cal = append(cal, events...)
	cal = append(cal, "END:VCALENDAR")
	return strings.Join(cal, "\r\n") + "\r\n"
}

func exportTripCalendar(w http.ResponseWriter, r *http.Request) {
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
		respondWithError(w, http.StatusInternalServerError, "Failed to get trip")
		return
	}

	var trip Trip
	if err := doc.DataTo(&trip); err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to parse trip")
		return
	}
	trip.ID = doc.Ref.ID

	days := []TripDay{}
	iter := db.Collection(daysCollection).Where("tripId", "==", id).Documents(ctx)
	defer iter.Stop()
	for {
		dayDoc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			log.Printf("Error iterating days for calendar: %v", err)
			respondWithError(w, http.StatusInternalServerError, "Failed to query days")
			return
		}
		var day TripDay
		if err := dayDoc.DataTo(&day); err != nil {
			continue
		}
		day.ID = dayDoc.Ref.ID
		normalizeDay(&day)
		days = append(days, day)
	}

	ics := buildTripICS(trip, days)
	filename := sanitizeFilename(trip.Name) + ".ics"
	w.Header().Set("Content-Type", "text/calendar; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"; filename*=UTF-8''%s`, filename, url.PathEscape(filename)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(ics))
}

func sanitizeFilename(name string) string {
	name = strings.TrimSpace(strings.ToLower(name))
	if name == "" {
		return "reise"
	}
	re := regexp.MustCompile(`[^a-z0-9æøå]+`)
	name = re.ReplaceAllString(name, "-")
	name = strings.Trim(name, "-")
	if name == "" {
		return "reise"
	}
	return name
}
