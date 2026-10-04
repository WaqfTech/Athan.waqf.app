package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sort"
	"strings"
	"unicode"
)

// RawCity represents GeoNames row format from cities.json
// [slug, nameAr, nameEn, countryCode, admin1, lat, lng, tz, population]
type RawCity []any

// CompactCity format: [nameEn, nameAr, lat, lng, cc, pop, tz]
type CompactCity []any

func round2(val float64) float64 {
	return math.Round(val*100) / 100
}

// isPureArabic checks if a string is composed strictly of standard Arabic letters and valid punctuation
func isPureArabic(s string) bool {
	s = strings.TrimSpace(s)
	if len(s) == 0 {
		return false
	}

	// Reject if starts with Uyghur initial vowels (e.g. ئاممان)
	if strings.HasPrefix(s, "ئا") || strings.HasPrefix(s, "ئە") || strings.HasPrefix(s, "ئو") || strings.HasPrefix(s, "ئۇ") || strings.HasPrefix(s, "ئى") {
		return false
	}

	// Reject Persian/Urdu administrative terms and US state suffixes
	rejectWords := []string{
		"شہر", "بخش", "شهرستان", "استان", "دهستان", "اردوگاه", "منطقه",
		"اوهایو", "انتاریو", "تگزاس", "کالیفرنیا", "نیویورک", "فلوریدا", "مشی گن",
		"ایلینوی", "پنسیلوانیا", "جورجیا", "ویرجینیا", "کارولینای",
	}
	for _, rw := range rejectWords {
		if strings.Contains(s, rw) {
			return false
		}
	}

	hasArabicLetter := false
	for _, r := range s {
		// Non-Arabic characters used exclusively in Urdu/Farsi/Kurdish/Uyghur/Pashto
		switch r {
		case 'پ', 'چ', 'ژ', 'گ', 'ٹ', 'ڈ', 'ڑ', 'ں', 'ے', 'ہ', 'ی', 'ک', 'ە', 'ڵ', 'ڕ', 'ڤ', 'ۆ', 'ێ', 'ې', 'ۇ', 'ۈ':
			return false
		}

		// Reject any Latin, Cyrillic, or Greek script mixed into Arabic
		if unicode.Is(unicode.Latin, r) || unicode.Is(unicode.Cyrillic, r) || unicode.Is(unicode.Greek, r) {
			return false
		}

		// Standard Arabic letter ranges
		if (r >= 0x0621 && r <= 0x063A) || (r >= 0x0641 && r <= 0x064A) || r == 0x0629 || r == 0x0649 || r == 0x0671 {
			hasArabicLetter = true
			continue
		}
		// Diacritics and tatweel
		if (r >= 0x064B && r <= 0x0652) || r == 0x0670 || r == 0x0640 {
			continue
		}
		// Formatting / separators
		if unicode.IsSpace(r) || r == '-' || r == '–' || r == '\'' || r == '’' || r == '(' || r == ')' {
			continue
		}

		return false
	}

	return hasArabicLetter
}

// cleanArabic strips vowel marks (fatha, damma, kasra, sukun, tanween) while keeping shaddah
func cleanArabic(s string) string {
	var sb strings.Builder
	for _, r := range s {
		if (r >= 0x064B && r <= 0x0650) || r == 0x0652 {
			continue
		}
		sb.WriteRune(r)
	}
	return strings.TrimSpace(sb.String())
}

var canonicalOverrides = map[string]string{
	// Levant & Jordan
	"Amman":             "عمّان",
	"Zarqa":             "الزرقاء",
	"Irbid":             "إربد",
	"Russeifa":          "الرصيفة",
	"Ḩayy Khildā":       "حي خلدا",
	"Khuraybat as Sūq":  "خريبة السوق",
	"Wādī as Sīr":       "وادي السير",
	"Ar Ramthā":         "الرمثا",
	"Ṣuwayliḥ":          "صويلح",
	"‘Ajlūn":            "عجلون",
	"As Salţ":           "السلط",
	"Aqaba":             "العقبة",
	"Mādabā":            "مأدبا",
	"Mafraq":            "المفرق",
	"Ma'an":             "معان",
	"Jerash":            "جرش",
	"Al Jubayhah":       "الجبيهة",
	"Saḩāb":             "سحاب",
	"Marj Al Hamam":     "مرج الحمام",
	"Az̧ Z̧ulayl":         "الضليل",
	"Jerusalem":         "القدس",
	"Gaza":              "غزة",
	"Ramallah":          "رام الله",
	"Hebron":            "الخليل",
	"Nablus":            "نابلس",
	"Bethlehem":         "بيت لحم",
	"Jenin":             "جنين",
	"Damascus":          "دمشق",
	"Aleppo":            "حلب",
	"Homs":              "حمص",
	"Hama":              "حماة",
	"Latakia":           "اللاذقية",
	"al-Yarmūk":         "اليرموك",
	"Beirut":            "بيروت",
	"Sidon":             "صيدا",
	"Tyre":              "صور",
	"Nabatîyé et Tahta": "النبطية التحتا",

	// Gulf & Arabian Peninsula
	"Riyadh":                "الرياض",
	"Makkah":                "مكة المكرمة",
	"Mecca":                 "مكة المكرمة",
	"Medina":                "المدينة المنورة",
	"Madinah":               "المدينة المنورة",
	"Jeddah":                "جدة",
	"Dammam":                "الدمام",
	"Khobar":                "الخبر",
	"Buraydah":              "بريدة",
	"Tabuk":                 "تبوك",
	"Hail":                  "حائل",
	"Najran":                "نجران",
	"Jizan":                 "جازان",
	"Yanbu":                 "ينبع",
	"Arar":                  "عرعر",
	"Sakakah":               "سكاكا",
	"Al Bahah":              "الباحة",
	"Taif":                  "الطائف",
	"Abha":                  "أبها",
	"Khamis Mushait":        "خميس مشيط",
	"Hafar Al-Batin":        "حفر الباطن",
	"Abu Dhabi":             "أبوظبي",
	"Dubai":                 "دبي",
	"Sharjah":               "الشارقة",
	"Ajman":                 "عجمان",
	"Ras Al Khaimah":        "رأس الخيمة",
	"Fujairah":              "الفجيرة",
	"Al Ain":                "العين",
	"Doha":                  "الدوحة",
	"Manama":                "المنامة",
	"Kuwait City":           "مدينة الكويت",
	"Al Farwānīyah":         "الفروانية",
	"Muscat":                "مسقط",
	"Şalālah":               "صلالة",
	"Sanaa":                 "صنعاء",
	"Aden":                  "عدن",
	"Al Ḩudaydah":           "الحديدة",
	"Sa'dah":                "صعدة",
	"Ḩajjah":                "حجة",

	// Iraq
	"Baghdad":  "بغداد",
	"Basra":    "البصرة",
	"Mosul":    "الموصل",
	"Erbil":    "أربيل",
	"Kirkuk":   "كركوك",
	"Najaf":    "النجف",
	"Karbala":  "كربلاء",

	// North & East Africa
	"Cairo":                 "القاهرة",
	"Alexandria":            "الإسكندرية",
	"Giza":                  "الجيزة",
	"Port Said":             "بورسعيد",
	"Suez":                  "السويس",
	"Luxor":                 "الأقصر",
	"Aswan":                 "أسوان",
	"Al ‘Āshir min Ramaḑān": "العاشر من رمضان",
	"Khartoum":              "الخرطوم",
	"Kassala":               "كسلا",
	"Singa":                 "سنجة",
	"Al-Junaynah":           "الجنينة",
	"Tripoli":               "طرابلس",
	"Benghazi":              "بنغازي",
	"Misratah":              "مصراتة",
	"Az Zāwīyah":            "الزاوية",
	"Darnah":                "درنة",
	"Al ‘Azīzīyah":          "العزيزية",
	"Tunis":                 "تونس",
	"Sfax":                  "صفاقس",
	"Sousse":                "سوسة",
	"Aryanah":               "أريانة",
	"Gafsa":                 "قفصة",
	"Béja":                  "باجة",
	"Jendouba":              "جندوبة",
	"Algiers":               "الجزائر",
	"Oran":                  "وهران",
	"Constantine":           "قسنطينة",
	"Annaba":                "عنابة",
	"Blida":                 "البليدة",
	"Batna":                 "باتنة",
	"Djelfa":                "الجلفة",
	"Biskra":                "بسكرة",
	"Béjaïa":                "بجاية",
	"Ghardaïa":              "غرداية",
	"Guelma":                "قالمة",
	"Bouïra":                "البويرة",
	"El Menia":              "المنيعة",
	"Rabat":                 "الرباط",
	"Casablanca":            "الدار البيضاء",
	"Fes":                   "فاس",
	"Marrakech":             "مراكش",
	"Tangier":               "طنجة",
	"Kenitra":               "القنيطرة",
	"Agadir":                "أكادير",
	"Nouakchott":            "نواكشوط",
	"Kiffa":                 "كيفة",
	"Tevragh Zeina":         "تفرغ زينة",
	"Djibouti":              "جيبوتي",
	"Mogadishu":             "مقديشو",
	"Marka":                 "مركا",
	"Baidoa":                "بيدوا",
	"Garoowe":               "غاروي",
	"Jawhar":                "جوهر",
	"Moroni":                "موروني",

	// Major Global Metropolises
	"London":        "لندن",
	"Paris":         "باريس",
	"Tokyo":         "طوكيو",
	"New York":      "نيويورك",
	"Washington":    "واشنطن",
	"Berlin":        "برلين",
	"Rome":          "روما",
	"Madrid":        "مدريد",
	"Moscow":        "موسكو",
	"Beijing":       "بكين",
	"Istanbul":      "إسطنبول",
	"Ankara":        "أنقرة",
	"Jakarta":       "جاكرتا",
	"Kuala Lumpur":  "كوالالمبور",
	"Singapore":     "سنغافورة",
	"Bangkok":       "بانكوك",
	"Seoul":         "سيول",
	"New Delhi":     "نيودلهي",
	"Islamabad":     "إسلام آباد",
	"Karachi":       "كراتشي",
	"Lahore":        "لاهور",
	"Dhaka":         "دكا",
	"Tashkent":      "طشقند",
	"Baku":          "باكو",
	"Tehran":        "طهران",
	"Kabul":         "كابل",
	"Sydney":        "سيدني",
	"Toronto":       "تورونتو",
	"Chicago":       "شيكاغو",
	"Los Angeles":   "لوس أنجلوس",
	"San Francisco": "سان فرانسيسكو",
	"Buenos Aires":  "بوينس آيرس",
	"Rio de Janeiro": "ريو دي جانيرو",
	"Sao Paulo":     "ساو باولو",
	"Vienna":        "فيينا",
	"Brussels":      "بروكسل",
	"Amsterdam":     "أمستردام",
	"Stockholm":     "ستوكهولم",
	"Oslo":          "أوسلو",
	"Helsinki":      "هلسنكي",
	"Copenhagen":    "كوبنهاغن",
	"Athens":        "أثينا",
	"Warsaw":        "وارسو",
	"Prague":        "براغ",
	"Budapest":      "بودابست",
	"Bucharest":     "بوخارست",
	"Kiev":          "كييف",
	"Cape Town":     "كيب تاون",
	"Nairobi":       "نيروبي",
	"Addis Ababa":   "أديس أبابا",
	"Dakar":         "داكار",
	"Honolulu":      "هونولولو",
	"Reykjavik":     "ريكيافيك",
}

func loadGeonamesAlternates() map[string][]string {
	res := make(map[string][]string)

	candidates := []string{
		"/tmp/cities1000.txt",
		"cities1000.txt",
	}

	for _, p := range candidates {
		f, err := os.Open(p)
		if err != nil {
			continue
		}
		defer f.Close()

		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			line := scanner.Text()
			parts := strings.Split(line, "\t")
			if len(parts) < 19 {
				continue
			}
			name := parts[1]
			asciiname := parts[2]
			cc := parts[8]
			alternates := parts[3]

			var pureAr []string
			for _, alt := range strings.Split(alternates, ",") {
				alt = strings.TrimSpace(alt)
				if isPureArabic(alt) {
					pureAr = append(pureAr, cleanArabic(alt))
				}
			}

			if len(pureAr) > 0 {
				res[name+"|"+cc] = pureAr
				if asciiname != name {
					res[asciiname+"|"+cc] = pureAr
				}
			}
		}
		fmt.Printf("Loaded pure Arabic alternates from %s (%d entries)\n", p, len(res))
		break
	}

	return res
}

func main() {
	sourcePath := "/mnt/Jad/github/projects/waqftech/PrayerTime.is/public/data/cities.json"
	destDir := "public/data"
	destPath := destDir + "/cities-core.json"

	data, err := os.ReadFile(sourcePath)
	if err != nil {
		fmt.Printf("Error reading source cities file: %v\n", err)
		os.Exit(1)
	}

	var rawCities []RawCity
	if err := json.Unmarshal(data, &rawCities); err != nil {
		fmt.Printf("Error unmarshaling json: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Read %d cities from source\n", len(rawCities))

	geonamesMap := loadGeonamesAlternates()

	mustHave := map[string]bool{
		"mecca": true, "medina": true, "cairo": true, "istanbul": true,
		"jakarta": true, "riyadh": true, "dubai": true, "karachi": true,
		"baghdad": true, "damascus": true, "amman": true, "jerusalem": true,
		"rabat": true, "casablanca": true, "algiers": true, "tunis": true,
		"tripoli": true, "doha": true, "kuwait-city": true, "manama": true,
		"muscat": true, "khartoum": true, "mogadishu": true, "djibouti": true,
		"moroni": true, "nouakchott": true, "beirut": true, "sanaa": true,
		"london": true, "paris": true, "tokyo": true, "new-york": true,
		"sydney": true, "toronto": true, "buenos-aires": true, "cape-town": true,
		"honolulu": true, "reykjavik": true, "dhaka": true, "tashkent": true,
		"kuala-lumpur": true, "singapore": true, "lahore": true, "islamabad": true,
	}

	type ScoredCity struct {
		compact    CompactCity
		population int64
		slug       string
	}

	var scored []ScoredCity

	for _, rc := range rawCities {
		if len(rc) < 9 {
			continue
		}

		slug, _ := rc[0].(string)
		nameAr, _ := rc[1].(string)
		nameEn, _ := rc[2].(string)
		cc, _ := rc[3].(string)
		lat, _ := rc[5].(float64)
		lng, _ := rc[6].(float64)
		tz, _ := rc[7].(string)
		popFloat, _ := rc[8].(float64)
		pop := int64(popFloat)

		if lat == 0 && lng == 0 {
			continue
		}

		// 1. Check canonical override first
		if cc == "US" && nameEn == "Mecca" {
			nameAr = "مكة"
		} else if canon, ok := canonicalOverrides[nameEn]; ok {
			nameAr = canon
		} else if isPureArabic(nameAr) {
			// Already clean Arabic
			nameAr = cleanArabic(nameAr)
		} else if alts, ok := geonamesMap[nameEn+"|"+cc]; ok && len(alts) > 0 {
			// Find best Arabic alternate from raw GeoNames
			best := alts[0]
			for _, alt := range alts {
				if strings.HasPrefix(alt, "ال") {
					best = alt
					break
				}
			}
			nameAr = best
		} else {
			// Fallback safely to English name instead of non-Arabic/corrupted transliteration
			nameAr = nameEn
		}

		comp := CompactCity{
			nameEn,
			nameAr,
			round2(lat),
			round2(lng),
			cc,
			pop,
			tz,
		}

		scored = append(scored, ScoredCity{
			compact:    comp,
			population: pop,
			slug:       slug,
		})
	}

	// Sort by population descending with guaranteed cities taking precedence
	sort.Slice(scored, func(i, j int) bool {
		iMust := mustHave[scored[i].slug]
		jMust := mustHave[scored[j].slug]
		if iMust != jMust {
			return iMust
		}
		return scored[i].population > scored[j].population
	})

	targetCount := 15000
	if len(scored) < targetCount {
		targetCount = len(scored)
	}

	finalList := make([]CompactCity, targetCount)
	for i := 0; i < targetCount; i++ {
		finalList[i] = scored[i].compact
	}

	// Strict verification of the final output:
	verifiedArabicCount := 0
	fallbackEnglishCount := 0
	for _, c := range finalList {
		nameEn := c[0].(string)
		nameAr := c[1].(string)
		if nameAr != nameEn {
			if !isPureArabic(nameAr) {
				fmt.Printf("ERROR: Non-Arabic translation survived in dataset: [%s] -> [%s]\n", nameEn, nameAr)
				os.Exit(1)
			}
			verifiedArabicCount++
		} else {
			fallbackEnglishCount++
		}
	}

	fmt.Printf("Strict verification passed: 0 errors across %d cities (%d pure Arabic, %d English fallback)\n",
		len(finalList), verifiedArabicCount, fallbackEnglishCount)

	if err := os.MkdirAll(destDir, 0755); err != nil {
		fmt.Printf("Error creating dest dir: %v\n", err)
		os.Exit(1)
	}

	outBytes, err := json.Marshal(finalList)
	if err != nil {
		fmt.Printf("Error marshaling json: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(destPath, outBytes, 0644); err != nil {
		fmt.Printf("Error writing file: %v\n", err)
		os.Exit(1)
	}

	fi, _ := os.Stat(destPath)
	fmt.Printf("Wrote %d cities to %s (%.2f MB)\n", len(finalList), destPath, float64(fi.Size())/1024/1024)
}
