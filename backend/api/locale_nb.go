package main

import "strings"

var countryNB = map[string]string{
	"italy": "Italia", "italien": "Italia", "italia": "Italia",
	"spain": "Spania", "spanien": "Spania", "españa": "Spania", "espana": "Spania", "spania": "Spania",
	"france": "Frankrike", "frankreich": "Frankrike", "frankrike": "Frankrike",
	"norway": "Norge", "norwegen": "Norge", "norge": "Norge",
	"sweden": "Sverige", "schweden": "Sverige", "sverige": "Sverige",
	"denmark": "Danmark", "dänemark": "Danmark", "danmark": "Danmark",
	"finland": "Finland", "finnland": "Finland",
	"iceland": "Island", "island": "Island",
	"germany": "Tyskland", "deutschland": "Tyskland", "tyskland": "Tyskland",
	"austria": "Østerrike", "österreich": "Østerrike", "osterreich": "Østerrike", "østerrike": "Østerrike",
	"switzerland": "Sveits", "schweiz": "Sveits", "suisse": "Sveits", "sveits": "Sveits",
	"netherlands": "Nederland", "nederland": "Nederland", "holland": "Nederland",
	"belgium": "Belgia", "belgien": "Belgia", "belgique": "Belgia", "belgia": "Belgia",
	"luxembourg": "Luxembourg",
	"united kingdom": "Storbritannia", "great britain": "Storbritannia", "england": "England",
	"scotland": "Skottland", "wales": "Wales", "ireland": "Irland", "irland": "Irland",
	"portugal": "Portugal",
	"greece": "Hellas", "griechenland": "Hellas", "hellas": "Hellas",
	"croatia": "Kroatia", "kroatien": "Kroatia", "kroatia": "Kroatia",
	"slovenia": "Slovenia", "slowenien": "Slovenia", "slovenija": "Slovenia",
	"slovakia": "Slovakia", "slowakei": "Slovakia",
	"czech republic": "Tsjekkia", "czechia": "Tsjekkia", "tschechien": "Tsjekkia", "tsjekkia": "Tsjekkia",
	"poland": "Polen", "polen": "Polen",
	"hungary": "Ungarn", "ungarn": "Ungarn",
	"romania": "Romania", "rumänien": "Romania",
	"bulgaria": "Bulgaria", "bulgarien": "Bulgaria",
	"serbia": "Serbia", "serbien": "Serbia",
	"bosnia and herzegovina": "Bosnia-Hercegovina", "bosnia-herzegovina": "Bosnia-Hercegovina",
	"montenegro": "Montenegro",
	"albania": "Albania",
	"north macedonia": "Nord-Makedonia", "macedonia": "Nord-Makedonia",
	"turkey": "Tyrkia", "türkiye": "Tyrkia", "turkiye": "Tyrkia", "tyrkia": "Tyrkia",
	"cyprus": "Kypros", "zypern": "Kypros", "kypros": "Kypros",
	"malta": "Malta",
	"estonia": "Estland", "estland": "Estland",
	"latvia": "Latvia", "lettland": "Latvia",
	"lithuania": "Litauen", "litauen": "Litauen",
	"ukraine": "Ukraina", "ukraina": "Ukraina",
	"russia": "Russland", "russland": "Russland",
	"united states": "USA", "united states of america": "USA", "usa": "USA",
	"canada": "Canada",
	"mexico": "Mexico", "méxico": "Mexico",
	"brazil": "Brasil", "brasilien": "Brasil", "brasil": "Brasil",
	"argentina": "Argentina",
	"chile": "Chile",
	"peru": "Peru",
	"colombia": "Colombia",
	"egypt": "Egypt", "ägypten": "Egypt",
	"morocco": "Marokko", "marokko": "Marokko",
	"tunisia": "Tunisia", "tunesien": "Tunisia",
	"south africa": "Sør-Afrika", "sør-afrika": "Sør-Afrika",
	"united arab emirates": "De forente arabiske emirater", "uae": "De forente arabiske emirater",
	"israel": "Israel",
	"japan": "Japan",
	"china": "Kina", "kina": "Kina",
	"south korea": "Sør-Korea", "sør-korea": "Sør-Korea",
	"thailand": "Thailand",
	"vietnam": "Vietnam",
	"indonesia": "Indonesia",
	"malaysia": "Malaysia",
	"singapore": "Singapore",
	"philippines": "Filippinene", "filippinene": "Filippinene",
	"india": "India",
	"australia": "Australia",
	"new zealand": "New Zealand",
}

var cityNB = map[string]string{
	"rome": "Roma", "roma": "Roma",
	"milan": "Milano", "milano": "Milano",
	"florence": "Firenze", "firenze": "Firenze",
	"venice": "Venezia", "venedig": "Venezia", "venezia": "Venezia",
	"naples": "Napoli", "neapel": "Napoli", "napoli": "Napoli",
	"turin": "Torino", "torino": "Torino",
	"genoa": "Genova", "genua": "Genova", "genova": "Genova",
	"padua": "Padova", "padova": "Padova",
	"syracuse": "Siracusa", "syrakus": "Siracusa",
	"leghorn": "Livorno",
	"seville": "Sevilla", "sevilla": "Sevilla",
	"saragossa": "Zaragoza",
	"majorca": "Mallorca", "mallorca": "Mallorca",
	"copenhagen": "København", "kopenhagen": "København", "københavn": "København",
	"gothenburg": "Göteborg", "göteborg": "Göteborg",
	"helsinki": "Helsingfors", "helsingfors": "Helsingfors",
	"brussels": "Brussel", "brüssel": "Brussel", "bruxelles": "Brussel", "brussel": "Brussel",
	"antwerp": "Antwerpen",
	"the hague": "Haag", "den haag": "Haag", "haag": "Haag",
	"munich": "München", "münchen": "München",
	"cologne": "Köln", "köln": "Köln", "koln": "Köln",
	"nuremberg": "Nürnberg", "nürnberg": "Nürnberg",
	"frankfurt": "Frankfurt",
	"vienna": "Wien", "wien": "Wien",
	"geneva": "Genève", "genf": "Genève", "genève": "Genève",
	"zurich": "Zürich", "zürich": "Zürich",
	"basel": "Basel",
	"prague": "Praha", "prag": "Praha", "praha": "Praha",
	"warsaw": "Warszawa", "warschau": "Warszawa", "warszawa": "Warszawa",
	"krakow": "Kraków", "cracow": "Kraków", "krakau": "Kraków",
	"athens": "Athen", "athen": "Athen",
	"lisbon": "Lisboa", "lissabon": "Lisboa", "lisboa": "Lisboa",
	"moscow": "Moskva", "moskau": "Moskva", "moskva": "Moskva",
	"cairo": "Kairo", "kairo": "Kairo",
	"cape town": "Kappstaden",
	"new york": "New York",
	"nice": "Nice",
	"marseilles": "Marseille",
	"lyons": "Lyon",
}

func localizeCountry(name string) string {
	raw := strings.TrimSpace(name)
	if raw == "" {
		return ""
	}
	if nb, ok := countryNB[strings.ToLower(raw)]; ok {
		return nb
	}
	return raw
}

func localizeCity(name string) string {
	raw := strings.TrimSpace(name)
	if raw == "" {
		return ""
	}
	if nb, ok := cityNB[strings.ToLower(raw)]; ok {
		return nb
	}
	return raw
}

func localizePlace(p placeSuggestion) placeSuggestion {
	searchName := strings.TrimSpace(p.SearchName)
	searchCountry := strings.TrimSpace(p.SearchCountry)
	if searchName == "" {
		searchName = p.Name
	}
	if searchCountry == "" {
		searchCountry = p.Country
	}
	p.Name = localizeCity(p.Name)
	p.Country = localizeCountry(p.Country)
	p.Admin1 = localizeCity(p.Admin1)
	p.SearchName = searchName
	p.SearchCountry = searchCountry
	return p
}

func localizePlaces(list []placeSuggestion) []placeSuggestion {
	out := make([]placeSuggestion, len(list))
	for i, p := range list {
		out[i] = localizePlace(p)
	}
	return out
}

// geocodeCountryEnglish maps localized country names to English for Open-Meteo search.
func geocodeCountryEnglish(name string) string {
	low := strings.ToLower(strings.TrimSpace(name))
	if low == "" {
		return ""
	}
	for eng, nb := range countryNB {
		if low == eng || low == strings.ToLower(nb) {
			return geocodeEnglishCountry(eng)
		}
	}
	return ""
}

func geocodeEnglishCountry(key string) string {
	switch key {
	case "united kingdom", "great britain":
		return "United Kingdom"
	case "united states", "united states of america":
		return "United States"
	case "czech republic":
		return "Czech Republic"
	case "bosnia and herzegovina", "bosnia-herzegovina":
		return "Bosnia and Herzegovina"
	case "north macedonia", "macedonia":
		return "North Macedonia"
	case "norway", "norwegen", "norge":
		return "Norway"
	case "italy", "italia", "italien":
		return "Italy"
	case "spain", "spania", "espana", "españa", "spanien":
		return "Spain"
	case "france", "frankreich", "frankrike":
		return "France"
	case "germany", "deutschland", "tyskland":
		return "Germany"
	case "sweden", "sverige", "schweden":
		return "Sweden"
	case "denmark", "danmark", "dänemark":
		return "Denmark"
	case "finland", "finnland":
		return "Finland"
	case "iceland", "island":
		return "Iceland"
	case "austria", "österreich", "osterreich", "østerrike":
		return "Austria"
	case "switzerland", "schweiz", "suisse", "sveits":
		return "Switzerland"
	case "netherlands", "nederland", "holland":
		return "Netherlands"
	case "belgium", "belgien", "belgique", "belgia":
		return "Belgium"
	case "portugal":
		return "Portugal"
	case "greece", "griechenland", "hellas":
		return "Greece"
	case "croatia", "kroatien", "kroatia":
		return "Croatia"
	case "slovenia", "slowenien", "slovenija":
		return "Slovenia"
	case "poland", "polen":
		return "Poland"
	case "hungary", "ungarn":
		return "Hungary"
	case "turkey", "türkiye", "turkiye", "tyrkia":
		return "Turkey"
	case "china", "kina":
		return "China"
	case "south korea", "sør-korea":
		return "South Korea"
	case "philippines", "filippinene":
		return "Philippines"
	case "south africa", "sør-afrika":
		return "South Africa"
	case "united arab emirates", "uae":
		return "United Arab Emirates"
	case "egypt", "ägypten":
		return "Egypt"
	case "morocco", "marokko":
		return "Morocco"
	case "ukraine", "ukraina":
		return "Ukraine"
	case "russia", "russland":
		return "Russia"
	default:
		return englishTitle(key)
	}
}

func englishTitle(s string) string {
	parts := strings.Fields(s)
	for i, p := range parts {
		if len(p) > 0 {
			parts[i] = strings.ToUpper(p[:1]) + p[1:]
		}
	}
	return strings.Join(parts, " ")
}

// geocodeCityForSearch picks API-friendly city spellings when needed.
func geocodeCityForSearch(city, countryEn string) string {
	c := strings.TrimSpace(city)
	low := strings.ToLower(c)
	switch low {
	case "wien":
		if countryEn == "Austria" || countryEn == "" {
			return "Vienna"
		}
	case "praha":
		if countryEn == "Czech Republic" || countryEn == "" {
			return "Prague"
		}
	case "moskva":
		if countryEn == "Russia" || countryEn == "" {
			return "Moscow"
		}
	case "ljubljiana", "ljubljana":
		if countryEn == "Slovenia" || countryEn == "" {
			return "Ljubljana"
		}
	}
	return c
}
