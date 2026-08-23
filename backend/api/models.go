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
	Paid      bool   `json:"paid,omitempty" firestore:"paid,omitempty"`
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
	Travelers      []string          `json:"travelers,omitempty" firestore:"travelers,omitempty"`
	ShareToken     string            `json:"shareToken,omitempty" firestore:"shareToken,omitempty"`
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

// JourneyStay is optional lodging attached to a journey stop (a block of nights).
type JourneyStay struct {
	Nights       int    `json:"nights" firestore:"nights"`
	Kind         string `json:"kind,omitempty" firestore:"kind,omitempty"` // hotel | airbnb
	HotelName    string `json:"hotelName,omitempty" firestore:"hotelName,omitempty"`
	Address      string `json:"address,omitempty" firestore:"address,omitempty"`
	URL          string `json:"url,omitempty" firestore:"url,omitempty"`
	Price        string `json:"price,omitempty" firestore:"price,omitempty"`
	Paid         bool   `json:"paid,omitempty" firestore:"paid,omitempty"`
	Notes        string `json:"notes,omitempty" firestore:"notes,omitempty"`
	CheckInTime  string `json:"checkInTime,omitempty" firestore:"checkInTime,omitempty"`
	CheckOutTime string `json:"checkOutTime,omitempty" firestore:"checkOutTime,omitempty"`
}

// JourneyPackageDay is one day inside a multi-day package block.
type JourneyPackageDay struct {
	ID         string  `json:"id" firestore:"id"`
	Offset     int     `json:"offset" firestore:"offset"` // 0 = start day
	AtSea      bool    `json:"atSea" firestore:"atSea"`   // free / at-sea / travel day
	City       string  `json:"city,omitempty" firestore:"city,omitempty"`
	Country    string  `json:"country,omitempty" firestore:"country,omitempty"`
	Latitude   float64 `json:"latitude,omitempty" firestore:"latitude,omitempty"`
	Longitude  float64 `json:"longitude,omitempty" firestore:"longitude,omitempty"`
	ArriveTime string  `json:"arriveTime,omitempty" firestore:"arriveTime,omitempty"`
	LeaveTime  string  `json:"leaveTime,omitempty" firestore:"leaveTime,omitempty"`
}

// JourneyPackage is a multi-day block (cruise, pakketur, charter, roadtrip, other).
type JourneyPackage struct {
	Nights       int                 `json:"nights" firestore:"nights"`
	Title        string              `json:"title,omitempty" firestore:"title,omitempty"`
	BasePlace    string              `json:"basePlace,omitempty" firestore:"basePlace,omitempty"`
	BaseCountry  string              `json:"baseCountry,omitempty" firestore:"baseCountry,omitempty"`
	BaseLatitude float64             `json:"baseLatitude,omitempty" firestore:"baseLatitude,omitempty"`
	BaseLongitude float64            `json:"baseLongitude,omitempty" firestore:"baseLongitude,omitempty"`
	Detail       string              `json:"detail,omitempty" firestore:"detail,omitempty"`
	Price        string              `json:"price,omitempty" firestore:"price,omitempty"`
	Paid         bool                `json:"paid,omitempty" firestore:"paid,omitempty"`
	Costs        []CruiseCost        `json:"costs,omitempty" firestore:"costs,omitempty"`
	Days         []JourneyPackageDay `json:"days,omitempty" firestore:"days,omitempty"`
}

// JourneyCruiseDay is legacy alias shape (still accepted when reading old journeys).
type JourneyCruiseDay = JourneyPackageDay

// JourneyCruise is legacy cruise-only payload; prefer JourneyPackage on Pack.
type JourneyCruise struct {
	Nights      int                `json:"nights" firestore:"nights"`
	ShipName    string             `json:"shipName,omitempty" firestore:"shipName,omitempty"`
	HomePort    string             `json:"homePort,omitempty" firestore:"homePort,omitempty"`
	HomeCountry string             `json:"homeCountry,omitempty" firestore:"homeCountry,omitempty"`
	CabinNumber string             `json:"cabinNumber,omitempty" firestore:"cabinNumber,omitempty"`
	Price       string             `json:"price,omitempty" firestore:"price,omitempty"`
	Days        []JourneyCruiseDay `json:"days,omitempty" firestore:"days,omitempty"`
}

// JourneyStop is one place on the trip thread (not a single calendar day).
type JourneyStop struct {
	ID         string          `json:"id" firestore:"id"`
	City          string          `json:"city" firestore:"city"`
	Country       string          `json:"country" firestore:"country"`
	CitySearch    string          `json:"citySearch,omitempty" firestore:"citySearch,omitempty"`
	CountrySearch string          `json:"countrySearch,omitempty" firestore:"countrySearch,omitempty"`
	Latitude      float64         `json:"latitude,omitempty" firestore:"latitude,omitempty"`
	Longitude  float64         `json:"longitude,omitempty" firestore:"longitude,omitempty"`
	Address    string          `json:"address,omitempty" firestore:"address,omitempty"`
	Station    string          `json:"station,omitempty" firestore:"station,omitempty"`
	ArriveDate string          `json:"arriveDate" firestore:"arriveDate"` // YYYY-MM-DD
	Kind       string          `json:"kind" firestore:"kind"`             // place | home | cruise | tour | charter | roadtrip | other
	Stay       *JourneyStay    `json:"stay,omitempty" firestore:"stay,omitempty"`
	Pack       *JourneyPackage `json:"pack,omitempty" firestore:"pack,omitempty"`
	Cruise     *JourneyCruise  `json:"cruise,omitempty" firestore:"cruise,omitempty"` // legacy
	Notes      string           `json:"notes,omitempty" firestore:"notes,omitempty"`
	Docs       []JourneyCityDoc `json:"docs,omitempty" firestore:"docs,omitempty"`
	Sights     []JourneySight   `json:"sights,omitempty" firestore:"sights,omitempty"`
	Purpose    string          `json:"purpose,omitempty" firestore:"purpose,omitempty"` // visit | transfer
	SortOrder  int             `json:"sortOrder" firestore:"sortOrder"`
}

// JourneyCityDoc is a titled info note attached to a city stop.
type JourneyCityDoc struct {
	ID        string `json:"id" firestore:"id"`
	Title     string `json:"title" firestore:"title"`
	Body      string `json:"body" firestore:"body"`
	SortOrder int    `json:"sortOrder" firestore:"sortOrder"`
}

// JourneySight is an attraction or excursion at a city, via place, or city-day.
type JourneySight struct {
	ID         string `json:"id" firestore:"id"`
	Title      string `json:"title" firestore:"title"`
	Notes      string `json:"notes,omitempty" firestore:"notes,omitempty"`
	URL        string `json:"url,omitempty" firestore:"url,omitempty"`
	Kind       string `json:"kind,omitempty" firestore:"kind,omitempty"` // sight | excursion | other
	DayOffset  int    `json:"dayOffset,omitempty" firestore:"dayOffset,omitempty"`
	StartTime  string `json:"startTime,omitempty" firestore:"startTime,omitempty"`
	EndTime    string `json:"endTime,omitempty" firestore:"endTime,omitempty"`
	Purpose    string `json:"purpose,omitempty" firestore:"purpose,omitempty"` // visit | transfer
	SortOrder  int    `json:"sortOrder" firestore:"sortOrder"`
}

// JourneyTransportOption is one way to travel between two places (e.g. bus OR train).
type JourneyTransportOption struct {
	ID         string   `json:"id" firestore:"id"`
	Mode       string   `json:"mode,omitempty" firestore:"mode,omitempty"`
	Title      string   `json:"title,omitempty" firestore:"title,omitempty"` // flight nr / line
	Company    string   `json:"company,omitempty" firestore:"company,omitempty"`
	StartTime  string   `json:"startTime,omitempty" firestore:"startTime,omitempty"`
	EndTime    string   `json:"endTime,omitempty" firestore:"endTime,omitempty"`
	Platform   string   `json:"platform,omitempty" firestore:"platform,omitempty"` // perong (buss/tog)
	Gate       string   `json:"gate,omitempty" firestore:"gate,omitempty"`         // flygate
	Minutes     string   `json:"minutes,omitempty" firestore:"minutes,omitempty"` // gåtid i minutter
	Info        string   `json:"info,omitempty" firestore:"info,omitempty"`       // ekstra info (annet)
	Price       string   `json:"price,omitempty" firestore:"price,omitempty"`
	ActualPrice string   `json:"actualPrice,omitempty" firestore:"actualPrice,omitempty"`
	Taken       bool     `json:"taken,omitempty" firestore:"taken,omitempty"`
	Ticket      bool     `json:"ticket,omitempty" firestore:"ticket,omitempty"`
	Paid        bool     `json:"paid,omitempty" firestore:"paid,omitempty"`
	Connection  string   `json:"connection,omitempty" firestore:"connection,omitempty"` // direct | change
	ChangePlace    string   `json:"changePlace,omitempty" firestore:"changePlace,omitempty"`
	ChangeTitle    string   `json:"changeTitle,omitempty" firestore:"changeTitle,omitempty"`
	ChangeStartTime string  `json:"changeStartTime,omitempty" firestore:"changeStartTime,omitempty"`
	ChangeEndTime   string  `json:"changeEndTime,omitempty" firestore:"changeEndTime,omitempty"`
	ChangePlatform string   `json:"changePlatform,omitempty" firestore:"changePlatform,omitempty"`
	ChangeMinutes  string   `json:"changeMinutes,omitempty" firestore:"changeMinutes,omitempty"`
	Changes        []JourneyLineChange `json:"changes,omitempty" firestore:"changes,omitempty"`
	Departures     []string `json:"departures,omitempty" firestore:"departures,omitempty"`
}

// JourneyLineChange is one same-mode change on a transport option.
type JourneyLineChange struct {
	ID        string `json:"id" firestore:"id"`
	Place     string `json:"place,omitempty" firestore:"place,omitempty"`
	Title     string `json:"title,omitempty" firestore:"title,omitempty"`
	StartTime string `json:"startTime,omitempty" firestore:"startTime,omitempty"`
	EndTime   string `json:"endTime,omitempty" firestore:"endTime,omitempty"`
	Platform  string `json:"platform,omitempty" firestore:"platform,omitempty"`
	Minutes   string `json:"minutes,omitempty" firestore:"minutes,omitempty"`
}

// JourneyVia is a city or airport point on a transport block between two stops.
type JourneyVia struct {
	ID         string                   `json:"id" firestore:"id"`
	Title      string                   `json:"title" firestore:"title"` // by eller flyplass
	Station    string                   `json:"station,omitempty" firestore:"station,omitempty"`
	Country    string                   `json:"country,omitempty" firestore:"country,omitempty"`
	Latitude   float64                  `json:"latitude,omitempty" firestore:"latitude,omitempty"`
	Longitude  float64                  `json:"longitude,omitempty" firestore:"longitude,omitempty"`
	Mode       string                   `json:"mode,omitempty" firestore:"mode,omitempty"` // legacy single mode
	StartTime  string                   `json:"startTime,omitempty" firestore:"startTime,omitempty"`
	EndTime    string                   `json:"endTime,omitempty" firestore:"endTime,omitempty"`
	Notes      string                   `json:"notes,omitempty" firestore:"notes,omitempty"`
	Departures []string                 `json:"departures,omitempty" firestore:"departures,omitempty"`
	// Options are alternative ways to arrive at this place from the previous one.
	Options   []JourneyTransportOption `json:"options,omitempty" firestore:"options,omitempty"`
	Sights    []JourneySight           `json:"sights,omitempty" firestore:"sights,omitempty"`
	Purpose    string                   `json:"purpose,omitempty" firestore:"purpose,omitempty"`       // visit | transfer
	Connection string                   `json:"connection,omitempty" firestore:"connection,omitempty"` // direct | change
	ChangePlace    string               `json:"changePlace,omitempty" firestore:"changePlace,omitempty"`
	ChangePlatform string               `json:"changePlatform,omitempty" firestore:"changePlatform,omitempty"`
	ChangeMinutes  string               `json:"changeMinutes,omitempty" firestore:"changeMinutes,omitempty"`
	SortOrder  int                      `json:"sortOrder" firestore:"sortOrder"`
}

// JourneyLeg is travel between two consecutive stops on the thread.
type JourneyLeg struct {
	ID         string       `json:"id" firestore:"id"`
	FromStopID string       `json:"fromStopId" firestore:"fromStopId"`
	ToStopID   string       `json:"toStopId" firestore:"toStopId"`
	Mode       string       `json:"mode,omitempty" firestore:"mode,omitempty"` // flight|train|bus|car|boat|walk|other
	Title      string       `json:"title,omitempty" firestore:"title,omitempty"`
	StartTime  string       `json:"startTime,omitempty" firestore:"startTime,omitempty"`
	EndTime    string       `json:"endTime,omitempty" firestore:"endTime,omitempty"`
	Notes      string       `json:"notes,omitempty" firestore:"notes,omitempty"`
	URL        string       `json:"url,omitempty" firestore:"url,omitempty"`
	Vias       []JourneyVia `json:"vias,omitempty" firestore:"vias,omitempty"`
}

// JourneyPhoto is an uploaded image attached to a live log entry.
type JourneyPhoto struct {
	ID  string `json:"id" firestore:"id"`
	URL string `json:"url" firestore:"url"`
}

// JourneyLiveEntry is an off-plan item logged while travelling (food, drink, shop).
type JourneyLiveEntry struct {
	ID        string         `json:"id" firestore:"id"`
	Date      string         `json:"date" firestore:"date"`
	Kind      string         `json:"kind" firestore:"kind"` // food | drink | shop | other
	Title     string         `json:"title" firestore:"title"`
	Price     string         `json:"price,omitempty" firestore:"price,omitempty"`
	Notes     string         `json:"notes,omitempty" firestore:"notes,omitempty"`
	Time      string         `json:"time,omitempty" firestore:"time,omitempty"`
	Rating    int            `json:"rating,omitempty" firestore:"rating,omitempty"` // 0 = unset, else 1..5
	Photos    []JourneyPhoto `json:"photos,omitempty" firestore:"photos,omitempty"`
	SortOrder int            `json:"sortOrder" firestore:"sortOrder"`
}

// Journey is the trip thread: ordered stops + legs between them (v2 planner).
type Journey struct {
	ID        string             `json:"id" firestore:"-"`
	TripID    string             `json:"tripId" firestore:"tripId"`
	Stops     []JourneyStop      `json:"stops" firestore:"stops"`
	Legs      []JourneyLeg       `json:"legs" firestore:"legs"`
	Live      []JourneyLiveEntry `json:"live,omitempty" firestore:"live,omitempty"`
	CreatedAt time.Time          `json:"createdAt" firestore:"createdAt"`
	UpdatedAt time.Time          `json:"updatedAt" firestore:"updatedAt"`
}
