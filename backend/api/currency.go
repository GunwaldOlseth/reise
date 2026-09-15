package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

type currencyResponse struct {
	Country        string  `json:"country"`
	CountryEnglish string  `json:"countryEnglish,omitempty"`
	CurrencyCode   string  `json:"currencyCode"`
	CurrencyName   string  `json:"currencyName"`
	RateToNok      float64 `json:"rateToNok,omitempty"`
	RateDate       string  `json:"rateDate,omitempty"`
	IsNok          bool    `json:"isNok"`
	Source         string  `json:"source"`
}

// ISO 4217 by English country name (geocodeCountryEnglish output).
var countryCurrency = map[string]string{
	"Norway":                        "NOK",
	"Sweden":                        "SEK",
	"Denmark":                       "DKK",
	"Iceland":                       "ISK",
	"United Kingdom":                "GBP",
	"United States":                 "USD",
	"Canada":                        "CAD",
	"Mexico":                        "MXN",
	"Brazil":                        "BRL",
	"Argentina":                     "ARS",
	"Chile":                         "CLP",
	"Peru":                          "PEN",
	"Colombia":                      "COP",
	"Switzerland":                   "CHF",
	"Poland":                        "PLN",
	"Czech Republic":                "CZK",
	"Hungary":                       "HUF",
	"Romania":                       "RON",
	"Bulgaria":                      "BGN",
	"Serbia":                        "RSD",
	"Turkey":                        "TRY",
	"Japan":                         "JPY",
	"China":                         "CNY",
	"South Korea":                   "KRW",
	"Thailand":                      "THB",
	"Vietnam":                       "VND",
	"Indonesia":                     "IDR",
	"Malaysia":                      "MYR",
	"Singapore":                     "SGD",
	"Philippines":                   "PHP",
	"India":                         "INR",
	"Australia":                     "AUD",
	"New Zealand":                   "NZD",
	"Egypt":                         "EGP",
	"Morocco":                       "MAD",
	"Tunisia":                       "TND",
	"South Africa":                  "ZAR",
	"United Arab Emirates":          "AED",
	"Israel":                        "ILS",
	"Ukraine":                       "UAH",
	"Russia":                        "RUB",
	"Albania":                       "ALL",
	"North Macedonia":               "MKD",
	"Montenegro":                    "EUR",
	"Bosnia and Herzegovina":        "BAM",
	"Luxembourg":                    "EUR",
	"Malta":                         "EUR",
	"Cyprus":                        "EUR",
	"Croatia":                       "EUR",
	"Slovenia":                      "EUR",
	"Slovakia":                      "EUR",
	"Estonia":                       "EUR",
	"Latvia":                        "EUR",
	"Lithuania":                     "EUR",
	"Finland":                       "EUR",
	"Netherlands":                   "EUR",
	"Belgium":                       "EUR",
	"Austria":                       "EUR",
	"Germany":                       "EUR",
	"France":                        "EUR",
	"Spain":                         "EUR",
	"Italy":                         "EUR",
	"Portugal":                      "EUR",
	"Greece":                        "EUR",
	"Ireland":                       "EUR",
}

var currencyNameNB = map[string]string{
	"NOK": "norske kroner",
	"SEK": "svenske kroner",
	"DKK": "danske kroner",
	"ISK": "islandske kroner",
	"EUR": "euro",
	"GBP": "britiske pund",
	"USD": "amerikanske dollar",
	"CAD": "kanadiske dollar",
	"CHF": "sveitsiske franc",
	"PLN": "polske zloty",
	"CZK": "tsjekkiske koruna",
	"HUF": "ungarske forint",
	"RON": "rumenske leu",
	"BGN": "bulgarske lev",
	"RSD": "serbiske dinarer",
	"TRY": "tyrkiske lira",
	"JPY": "japanske yen",
	"CNY": "kinesiske yuan",
	"KRW": "sørkoreanske won",
	"THB": "thailandske baht",
	"VND": "vietnamesiske dong",
	"IDR": "indonesiske rupiah",
	"MYR": "malaysiske ringgit",
	"SGD": "singaporske dollar",
	"PHP": "filippinske peso",
	"INR": "indiske rupi",
	"AUD": "australske dollar",
	"NZD": "newzealandske dollar",
	"EGP": "egyptiske pund",
	"MAD": "marokkanske dirham",
	"TND": "tunisiske dinarer",
	"ZAR": "sørafrikanske rand",
	"AED": "emiratarabiske dirham",
	"ILS": "israelske shekel",
	"UAH": "ukrainske hryvnia",
	"RUB": "russiske rubler",
	"ALL": "albanske lek",
	"MKD": "makedonske denarer",
	"BAM": "bosnisk-hercegovinske mark",
	"MXN": "meksikanske peso",
	"BRL": "brasilianske real",
	"ARS": "argentinske peso",
	"CLP": "chilenske peso",
	"PEN": "peruanske sol",
	"COP": "colombianske peso",
}

type rateCacheEntry struct {
	rate float64
	date string
	at   time.Time
}

var (
	rateCache   = map[string]rateCacheEntry{}
	rateCacheMu sync.Mutex
	rateCacheTTL = 45 * time.Minute
)

func resolveCountryEnglish(country, countrySearch string) string {
	country = strings.TrimSpace(country)
	countrySearch = strings.TrimSpace(countrySearch)
	if en := geocodeCountryEnglish(country); en != "" {
		return en
	}
	if en := geocodeCountryEnglish(countrySearch); en != "" {
		return en
	}
	// Already English?
	if code, ok := countryCurrency[englishTitle(country)]; ok && code != "" {
		return englishTitle(country)
	}
	return englishTitle(country)
}

func currencyForCountry(countryEn string) (code string, ok bool) {
	countryEn = strings.TrimSpace(countryEn)
	if countryEn == "" {
		return "", false
	}
	if c, found := countryCurrency[countryEn]; found {
		return c, true
	}
	return "", false
}

func currencyDisplayNameNB(code string) string {
	code = strings.ToUpper(strings.TrimSpace(code))
	if name, ok := currencyNameNB[code]; ok {
		return name
	}
	return code
}

func fetchRateToNOK(code string) (rate float64, rateDate string, err error) {
	if code == "NOK" {
		return 1, time.Now().UTC().Format("2006-01-02"), nil
	}

	rateCacheMu.Lock()
	if e, ok := rateCache[code]; ok && time.Since(e.at) < rateCacheTTL {
		rateCacheMu.Unlock()
		return e.rate, e.date, nil
	}
	rateCacheMu.Unlock()

	u := fmt.Sprintf(
		"https://api.frankfurter.app/latest?from=%s&to=NOK",
		url.QueryEscape(code),
	)
	resp, err := http.Get(u)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return 0, "", fmt.Errorf("frankfurter %d: %s", resp.StatusCode, strings.TrimSpace(string(b)))
	}
	var payload struct {
		Date   string             `json:"date"`
		Rates  map[string]float64 `json:"rates"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return 0, "", err
	}
	rate = payload.Rates["NOK"]
	if rate <= 0 {
		return 0, "", fmt.Errorf("missing NOK rate for %s", code)
	}
	rateDate = payload.Date
	rateCacheMu.Lock()
	rateCache[code] = rateCacheEntry{rate: rate, date: rateDate, at: time.Now()}
	rateCacheMu.Unlock()
	return rate, rateDate, nil
}

func getCurrency(w http.ResponseWriter, r *http.Request) {
	country := strings.TrimSpace(r.URL.Query().Get("country"))
	countrySearch := strings.TrimSpace(r.URL.Query().Get("countrySearch"))
	if country == "" && countrySearch == "" {
		respondWithError(w, http.StatusBadRequest, "country is required")
		return
	}

	countryEn := resolveCountryEnglish(country, countrySearch)
	code, ok := currencyForCountry(countryEn)
	if !ok {
		respondWithJSON(w, http.StatusOK, currencyResponse{
			Country:        country,
			CountryEnglish: countryEn,
			CurrencyCode:   "",
			CurrencyName:   "",
			Source:         "unknown-country",
		})
		return
	}

	name := currencyDisplayNameNB(code)
	isNok := code == "NOK"
	out := currencyResponse{
		Country:        country,
		CountryEnglish: countryEn,
		CurrencyCode:   code,
		CurrencyName:   name,
		IsNok:          isNok,
		Source:         "frankfurter",
	}

	if !isNok {
		rate, rateDate, err := fetchRateToNOK(code)
		if err != nil {
			log.Printf("currency rate %s: %v", code, err)
			out.Source = "rate-unavailable"
			respondWithJSON(w, http.StatusOK, out)
			return
		}
		out.RateToNok = rate
		out.RateDate = rateDate
	}

	respondWithJSON(w, http.StatusOK, out)
}
