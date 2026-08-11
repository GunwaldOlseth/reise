package main

import "time"

// Link is a titled URL attached to a day (legacy / ekstra lenker).
type Link struct {
	Title string `json:"title" firestore:"title"`
	URL   string `json:"url" firestore:"url"`
}

// DayItemType values for TripDay.Items.
const (
	ItemHotel      = "hotel"
	ItemCruise     = "cruise"
	ItemPackage    = "package"
	ItemFlight     = "flight"
	ItemTrain      = "train"
	ItemBus        = "bus"
	ItemTaxi       = "taxi"
	ItemBoat       = "boat"
	ItemAttraction = "attraction"
)

// CruisePortCall is ship arrive/leave for one port day on a cruise.
type CruisePortCall struct {
	Date       string `json:"date" firestore:"date"` // YYYY-MM-DD
	ArriveTime string `json:"arriveTime" firestore:"arriveTime"`
	LeaveTime  string `json:"leaveTime" firestore:"leaveTime"`
}

// CruiseActivity is an activity or note for the whole cruise (not a single port day).
type CruiseActivity struct {
	ID        string `json:"id" firestore:"id"`
	Title     string `json:"title" firestore:"title"`
	StartTime string `json:"startTime,omitempty" firestore:"startTime,omitempty"`
	Notes     string `json:"notes,omitempty" firestore:"notes,omitempty"`
	URL       string `json:"url,omitempty" firestore:"url,omitempty"`
	SortOrder int    `json:"sortOrder" firestore:"sortOrder"`
}

// CruiseCost is an extra cost on a cruise (whole sailing or one day).
type CruiseCost struct {
	ID        string `json:"id" firestore:"id"`
	Title     string `json:"title" firestore:"title"`
	Price     string `json:"price,omitempty" firestore:"price,omitempty"`
	Notes     string `json:"notes,omitempty" firestore:"notes,omitempty"`
	SortOrder int    `json:"sortOrder" firestore:"sortOrder"`
}

// CruiseDayCosts holds extra costs for one cruise calendar day.
type CruiseDayCosts struct {
	Date  string       `json:"date" firestore:"date"` // YYYY-MM-DD
	Costs []CruiseCost `json:"costs,omitempty" firestore:"costs,omitempty"`
}

// DayItem is a typed entry on a day (hotel, transport, sight, etc.).
type DayItem struct {
	ID        string `json:"id" firestore:"id"`
	Type      string `json:"type" firestore:"type"` // hotel | cruise | package | flight | train | bus | taxi | boat | attraction
	Title     string `json:"title" firestore:"title"`
	URL       string `json:"url,omitempty" firestore:"url,omitempty"`
	Address   string `json:"address,omitempty" firestore:"address,omitempty"`
	From      string `json:"from,omitempty" firestore:"from,omitempty"` // cruise: hjemhavn
	To        string `json:"to,omitempty" firestore:"to,omitempty"`     // cruise: hjemhavn (samme)
	StartTime string `json:"startTime,omitempty" firestore:"startTime,omitempty"` // innsjekk / embark / avgang
	EndTime   string `json:"endTime,omitempty" firestore:"endTime,omitempty"`     // utsjekk / disembark / ankomst
	Notes     string `json:"notes,omitempty" firestore:"notes,omitempty"`
	Nights    int    `json:"nights" firestore:"nights"` // hotel/cruise overnattinger (1 = utsjekk neste dag)
	// Price is free text for hotel/cruise/transport expected price (e.g. "4500 kr").
	Price string `json:"price,omitempty" firestore:"price,omitempty"`
	// ActualPrice is the real cost after travel (transport); empty = use Price.
	ActualPrice string `json:"actualPrice,omitempty" firestore:"actualPrice,omitempty"`
	// CabinNumber is cruise cabin / lugar (type cruise).
	CabinNumber string `json:"cabinNumber,omitempty" firestore:"cabinNumber,omitempty"`
	// CruisePorts holds per-port ship times (source of truth for list display).
	CruisePorts []CruisePortCall `json:"cruisePorts,omitempty" firestore:"cruisePorts,omitempty"`
	// Activities are whole-cruise activities (type cruise only).
	Activities []CruiseActivity `json:"activities,omitempty" firestore:"activities,omitempty"`
	// Costs are whole-cruise extra costs (type cruise only).
	Costs []CruiseCost `json:"costs,omitempty" firestore:"costs,omitempty"`
	// DayCosts are per-day extra costs on the cruise (type cruise only).
	DayCosts []CruiseDayCosts `json:"dayCosts,omitempty" firestore:"dayCosts,omitempty"`
	SortOrder int             `json:"sortOrder" firestore:"sortOrder"`
}

// Transport modes between via-points.
const (
	LegWalk   = "walk"
	LegTaxi   = "taxi"
	LegBus    = "bus"
	LegTram   = "tram"
	LegTrain  = "train"
	LegFlight = "flight"
	LegBoat   = "boat"
	LegOther  = "other"
)

// ViaPoint is a stop on a day's route.
type ViaPoint struct {
	ID        string `json:"id" firestore:"id"`
	Title     string `json:"title" firestore:"title"`
	Address   string `json:"address,omitempty" firestore:"address,omitempty"`
	URL       string `json:"url,omitempty" firestore:"url,omitempty"`
	ArriveTime string `json:"arriveTime,omitempty" firestore:"arriveTime,omitempty"`
	LeaveTime string `json:"leaveTime,omitempty" firestore:"leaveTime,omitempty"`
	Notes     string `json:"notes,omitempty" firestore:"notes,omitempty"`
	SortOrder int    `json:"sortOrder" firestore:"sortOrder"`
}

// RouteLeg is transport between two consecutive via-points.
type RouteLeg struct {
	ID             string `json:"id" firestore:"id"`
	FromViaPointID string `json:"fromViaPointId" firestore:"fromViaPointId"`
	ToViaPointID   string `json:"toViaPointId" firestore:"toViaPointId"`
	Mode           string `json:"mode" firestore:"mode"` // walk | taxi | bus | tram | train | flight | boat | other
	Title          string `json:"title,omitempty" firestore:"title,omitempty"`
	StartTime      string `json:"startTime,omitempty" firestore:"startTime,omitempty"` // valgt / planlagt avgang
	EndTime        string `json:"endTime,omitempty" firestore:"endTime,omitempty"`     // valgt / planlagt ankomst
	// Departures are optional timetable alternatives (info only — not used for sorting/route sync).
	Departures []string `json:"departures,omitempty" firestore:"departures,omitempty"`
	URL        string   `json:"url,omitempty" firestore:"url,omitempty"`
	Notes      string   `json:"notes,omitempty" firestore:"notes,omitempty"`
	SortOrder  int      `json:"sortOrder" firestore:"sortOrder"`
}

// TripFeatures toggles optional modules for a trip (chosen when creating the trip).
type TripFeatures struct {
	Cruise   bool `json:"cruise" firestore:"cruise"`
	Packages bool `json:"packages" firestore:"packages"`
}

// Trip is a travel plan with a date range.
type Trip struct {
	ID             string            `json:"id" firestore:"-"`
	Name           string            `json:"name" firestore:"name"`
	StartDate      string            `json:"startDate" firestore:"startDate"` // YYYY-MM-DD
	EndDate        string            `json:"endDate" firestore:"endDate"`     // YYYY-MM-DD
	ColorByCountry map[string]string `json:"colorByCountry,omitempty" firestore:"colorByCountry,omitempty"`
	Features       TripFeatures      `json:"features" firestore:"features"`
	CreatedAt      time.Time         `json:"createdAt" firestore:"createdAt"`
	UpdatedAt      time.Time         `json:"updatedAt" firestore:"updatedAt"`
}

// TripDay is one day on a trip itinerary.
type TripDay struct {
	ID            string    `json:"id" firestore:"-"`
	TripID        string    `json:"tripId" firestore:"tripId"`
	Date          string    `json:"date" firestore:"date"` // YYYY-MM-DD
	SortOrder     int       `json:"sortOrder" firestore:"sortOrder"`
	Country       string    `json:"country" firestore:"country"`
	City          string    `json:"city" firestore:"city"`
	AtSea         bool      `json:"atSea" firestore:"atSea"` // cruise: hele dagen til havs
	// Ship port call times (cruise). No omitempty: full Set must not drop these.
	ArriveTime    string    `json:"arriveTime" firestore:"arriveTime"`
	LeaveTime     string    `json:"leaveTime" firestore:"leaveTime"`
	HotelName     string    `json:"hotelName" firestore:"hotelName"` // legacy; synces from items
	HotelURL      string    `json:"hotelUrl" firestore:"hotelUrl"`
	Address       string    `json:"address" firestore:"address"`
	CheckIn       string    `json:"checkIn" firestore:"checkIn"`
	CheckOut      string    `json:"checkOut" firestore:"checkOut"`
	TransportNext string    `json:"transportNext" firestore:"transportNext"`
	Notes         string    `json:"notes" firestore:"notes"`
	Links         []Link      `json:"links" firestore:"links"`
	Items         []DayItem   `json:"items" firestore:"items"`
	ViaPoints     []ViaPoint  `json:"viaPoints" firestore:"viaPoints"`
	Legs          []RouteLeg  `json:"legs" firestore:"legs"`
	CreatedAt     time.Time   `json:"createdAt" firestore:"createdAt"`
	UpdatedAt     time.Time   `json:"updatedAt" firestore:"updatedAt"`
}

// ReorderRequest updates sortOrder for multiple days at once.
type ReorderRequest struct {
	Items []ReorderItem `json:"items"`
}

// ReorderItem pairs a day id with its new sort order.
type ReorderItem struct {
	ID        string `json:"id"`
	SortOrder int    `json:"sortOrder"`
}
