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
	"Tulkarm":           "طولكرم",
	"Ţūlkarm":           "طولكرم",
	"Battir":            "بتير",
	"Qalqīlyah":         "قلقيلية",
	"Qalqilya":          "قلقيلية",
	"Rafaḩ":             "رفح",
	"Rafah":             "رفح",
	"Khān Yūnis":        "خان يونس",
	"Khan Yunis":        "خان يونس",
	"Jabālyā":           "جباليا",
	"Jabalia":           "جباليا",
	"Dayr al Balaḩ":     "دير البلح",
	"Deir al-Balah":     "دير البلح",
	"Bayt Lāhyā":        "بيت لاهيا",
	"Beit Lahia":        "بيت لاهيا",
	"Yaţţā":             "يطا",
	"Yatta":             "يطا",
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

type PalestinianOverride struct {
	NameEn string
	NameAr string
}

var palestineOverrides = map[string]PalestinianOverride{
	// Core historic cities
	"Jerusalem":               {NameEn: "Al-Quds", NameAr: "القدس"},
	"West Jerusalem":          {NameEn: "Al-Quds", NameAr: "القدس"},
	"East Jerusalem":          {NameEn: "Al-Quds", NameAr: "القدس"},
	"Tel Aviv":                {NameEn: "Yafa", NameAr: "يافا"},
	"Jaffa":                   {NameEn: "Yafa", NameAr: "يافا"},
	"Haifa":                   {NameEn: "Haifa", NameAr: "حيفا"},
	"Acre":                    {NameEn: "Akka", NameAr: "عكّا"},
	"Nazareth":                {NameEn: "An-Nasirah", NameAr: "الناصرة"},
	"Beersheba":               {NameEn: "Bi'r as-Sabi'", NameAr: "بئر السبع"},
	"Ashdod":                  {NameEn: "Isdud", NameAr: "إسدود"},
	"Ashkelon":                {NameEn: "Asqalan", NameAr: "عسقلان"},
	"Petaẖ Tiqva":             {NameEn: "Mulabbis", NameAr: "ملبّس"},
	"Petah Tiqva":             {NameEn: "Mulabbis", NameAr: "ملبّس"},
	"Petah Tikva":             {NameEn: "Mulabbis", NameAr: "ملبّس"},
	"Rishon LeTsiyyon":        {NameEn: "Ayun Qara", NameAr: "عيون قارة"},
	"Netanya":                 {NameEn: "Umm Khalid", NameAr: "أم خالد"},
	"Bnei Brak":               {NameEn: "Ibn Ibraq", NameAr: "ابن إبراق"},
	"H̱olon":                   {NameEn: "Yazur", NameAr: "يازور"},
	"Holon":                   {NameEn: "Yazur", NameAr: "يازور"},
	"Ramat Gan":               {NameEn: "Jarisha", NameAr: "جريشة"},
	"Reẖovot":                 {NameEn: "Zarnuqa", NameAr: "زرنوقة"},
	"Rehovot":                 {NameEn: "Zarnuqa", NameAr: "زرنوقة"},
	"Bat Yam":                 {NameEn: "Yafa al-Janubiyya", NameAr: "يافا الجنوبية"},
	"Bet Shemesh":             {NameEn: "Bayt Shams", NameAr: "بيت شمس"},
	"Kfar Saba":               {NameEn: "Kafr Saba", NameAr: "كفر سابا"},
	"Herzliya":                {NameEn: "Al-Haram Sayyidna Ali", NameAr: "الحرم سيدنا علي"},
	"Hadera":                  {NameEn: "Al-Khudayra", NameAr: "الخضيرة"},
	"Modi‘in Makkabbim Re‘ut": {NameEn: "Al-Midya", NameAr: "المدية"},
	"Modiin Makkabbim Reut":   {NameEn: "Al-Midya", NameAr: "المدية"},
	"Modiin Ilit":             {NameEn: "Ni'lin", NameAr: "نعلين"},
	"Lod":                     {NameEn: "Al-Lidd", NameAr: "اللد"},
	"Ramla":                   {NameEn: "Ar-Ramlah", NameAr: "الرملة"},
	"Ra'anana":                {NameEn: "Tabsur", NameAr: "تبصر"},
	"Raanana":                 {NameEn: "Tabsur", NameAr: "تبصر"},
	"Rosh Ha‘Ayin":            {NameEn: "Ras al-Ayn", NameAr: "رأس العين"},
	"Rosh HaAyin":             {NameEn: "Ras al-Ayn", NameAr: "رأس العين"},
	"Hod HaSharon":            {NameEn: "Biyar Adas", NameAr: "بيار عدس"},
	"Hod Hasharon":            {NameEn: "Biyar Adas", NameAr: "بيار عدس"},
	"Kiryat Gat":              {NameEn: "Iraq al-Manshiyya", NameAr: "عراق المنشية"},
	"Givatayim":               {NameEn: "Salama", NameAr: "سلمة"},
	"Qiryat Ata":              {NameEn: "Kafr Etta", NameAr: "كفر عتا"},
	"Nahariyya":               {NameEn: "Al-Zeeb", NameAr: "الزيب"},
	"Nahariya":                {NameEn: "Al-Zeeb", NameAr: "الزيب"},
	"Umm el Faḥm":             {NameEn: "Umm al-Fahm", NameAr: "أم الفحم"},
	"Umm al-Fahm":             {NameEn: "Umm al-Fahm", NameAr: "أم الفحم"},
	"Eilat":                   {NameEn: "Umm ar-Rashrash", NameAr: "أم الرشراش"},
	"Ness Ziona":              {NameEn: "Wadi Hunayn", NameAr: "وادي حنين"},
	"El‘ad":                   {NameEn: "Al-Muzayri'a", NameAr: "المزيرعة"},
	"Elad":                    {NameEn: "Al-Muzayri'a", NameAr: "المزيرعة"},
	"Yavné":                   {NameEn: "Yibna", NameAr: "يبنى"},
	"Yavne":                   {NameEn: "Yibna", NameAr: "يبنى"},
	"Ramat HaSharon":          {NameEn: "Ijlil", NameAr: "إجليل"},
	"Ramat Hasharon":          {NameEn: "Ijlil", NameAr: "إجليل"},
	"Karmi’el":                {NameEn: "Majd al-Krum", NameAr: "مجد الكروم"},
	"Karmiel":                 {NameEn: "Majd al-Krum", NameAr: "مجد الكروم"},
	"Afula":                   {NameEn: "Al-Affula", NameAr: "العفولة"},
	"Pardés H̱anna Karkur":     {NameEn: "Karkur", NameAr: "كركور"},
	"Pardes Hanna Karkur":     {NameEn: "Karkur", NameAr: "كركور"},
	"Tiberias":                {NameEn: "Tabariyya", NameAr: "طبريا"},
	"Eṭ Ṭaiyiba":              {NameEn: "At-Tayyiba", NameAr: "الطيّبة"},
	"Et Taiyiba":              {NameEn: "At-Tayyiba", NameAr: "الطيّبة"},
	"Qiryat Bialik":           {NameEn: "Yajur", NameAr: "ياجور"},
	"Netivot":                 {NameEn: "Azzam", NameAr: "عزام"},
	"Naẕerat ‘Illit":          {NameEn: "Jabal as-Sikh", NameAr: "جبل السيخ"},
	"Nazerat Illit":           {NameEn: "Jabal as-Sikh", NameAr: "جبل السيخ"},
	"Qiryat Motsqin":          {NameEn: "Al-Ghawarneh", NameAr: "الغوارنة"},
	"Qiryat Motzkin":          {NameEn: "Al-Ghawarneh", NameAr: "الغوارنة"},
	"Shefar‘am":               {NameEn: "Shafa 'Amr", NameAr: "شفا عمرو"},
	"Shefaram":                {NameEn: "Shafa 'Amr", NameAr: "شفا عمرو"},

	// Secondary settlements and surrounding villages
	"Kiryat Ono":        {NameEn: "Kafr Ana", NameAr: "كفر عانة"},
	"Qiryat Yam":        {NameEn: "Balad ash-Sheikh", NameAr: "بلد الشيخ"},
	"Or Yehuda":         {NameEn: "Saqiya", NameAr: "ساقية"},
	"Dimona":            {NameEn: "Dimona", NameAr: "ديمونة"},
	"Safed":             {NameEn: "Safad", NameAr: "صفد"},
	"Ofaqim":            {NameEn: "Ofakim", NameAr: "أوفاكيم"},
	"Ofakim":            {NameEn: "Ofakim", NameAr: "أوفاكيم"},
	"Sakhnīn":           {NameEn: "Sakhnin", NameAr: "سخنين"},
	"Sakhnin":           {NameEn: "Sakhnin", NameAr: "سخنين"},
	"Gedera":            {NameEn: "Qatra", NameAr: "قطرة"},
	"Bāqa el Gharbīya":  {NameEn: "Baqa al-Gharbiyya", NameAr: "باقة الغربية"},
	"Baqa al-Gharbiya":  {NameEn: "Baqa al-Gharbiyya", NameAr: "باقة الغربية"},
	"Yehud-Monosson":    {NameEn: "Al-Yahudiyya", NameAr: "اليهودية"},
	"Yehud":             {NameEn: "Al-Yahudiyya", NameAr: "اليهودية"},
	"Giv'at Shmuel":     {NameEn: "Ibn Ibraq", NameAr: "ابن إبراق"},
	"Givat Shmuel":      {NameEn: "Ibn Ibraq", NameAr: "ابن إبراق"},
	"Arad":              {NameEn: "Arad", NameAr: "عراد"},
	"Tirat Karmel":      {NameEn: "Al-Tira", NameAr: "طيرة الكرمل"},
	"Be’er Ya‘aqov":     {NameEn: "Qubab", NameAr: "القباب"},
	"Beer Yaakov":       {NameEn: "Qubab", NameAr: "القباب"},
	"Sderot":            {NameEn: "Najd", NameAr: "نجد"},
	"Eṭ Ṭīra":           {NameEn: "Al-Tira", NameAr: "الطيرة"},
	"Et Tira":           {NameEn: "Al-Tira", NameAr: "الطيرة"},
	"Tamra":             {NameEn: "Tamra", NameAr: "طمرة"},
	"Migdal Ha‘Emeq":    {NameEn: "Al-Mujaydil", NameAr: "المجيدل"},
	"Migdal HaEmek":     {NameEn: "Al-Mujaydil", NameAr: "المجيدل"},
	"Qiryat Mal’akhi":   {NameEn: "Qastina", NameAr: "قسطينة"},
	"Kiryat Malakhi":    {NameEn: "Qastina", NameAr: "قسطينة"},
	"Ganei Tikva":       {NameEn: "Al-Abbasiyya", NameAr: "العباسية"},
	"Qiryat HaYovel":    {NameEn: "Bayt Mazmil", NameAr: "بيت مزميل"},
	"Daliyat al Karmel": {NameEn: "Daliyat al-Karmel", NameAr: "دالية الكرمل"},
	"‘Ara-‘Ar‘ara":      {NameEn: "Ara and Ar'ara", NameAr: "عرعرة"},
	"Kfar Yona":         {NameEn: "Bayt Lid", NameAr: "بيت ليد"},
	"Nesher":            {NameEn: "Balad ash-Sheikh", NameAr: "بلد الشيخ"},
	"Mevasseret Tsiyyon": {NameEn: "Qalunya", NameAr: "قالونيا"},
	"Gan Yavne":         {NameEn: "Barqa", NameAr: "برقة"},
	"Kafr Qāsim":        {NameEn: "Kafr Qasim", NameAr: "كفر قاسم"},
	"Kafr Qasim":        {NameEn: "Kafr Qasim", NameAr: "كفر قاسم"},
	"Yoqne‘am ‘Illit":   {NameEn: "Qira", NameAr: "قيرة"},
	"Zikhron Ya‘aqov":   {NameEn: "Zammarin", NameAr: "زمرين"},
	"Maghār":            {NameEn: "Al-Maghar", NameAr: "المغار"},
	"Maghar":            {NameEn: "Al-Maghar", NameAr: "المغار"},
	"Kafr Kannā":        {NameEn: "Kafr Kanna", NameAr: "كفر كَنّا"},
	"Kafr Kanna":        {NameEn: "Kafr Kanna", NameAr: "كفر كَنّا"},
	"Qiryat Shmona":     {NameEn: "Al-Khalisa", NameAr: "الخالصة"},
	"Kadima Zoran":      {NameEn: "Qaqun", NameAr: "قاقون"},
	"maalot Tarshīhā":   {NameEn: "Tarshiha", NameAr: "ترشيحا"},
	"H̱ura":              {NameEn: "Hura", NameAr: "حورة"},
	"Judeida Makr":      {NameEn: "Al-Judayda and Al-Makr", NameAr: "الجديدة والمكر"},
	"Kuseifa":           {NameEn: "Kusayfa", NameAr: "كسيفة"},
	"Shoham":            {NameEn: "Dayr Tarif", NameAr: "دير طريف"},
	"Ariel":             {NameEn: "Salfit", NameAr: "سلفيت"},
	"Tel Sheva‘":        {NameEn: "Tall as-Sabi'", NameAr: "تل السبع"},
	"Kafr Mandā":        {NameEn: "Kafr Manda", NameAr: "كفر مندا"},
	"Rahat":             {NameEn: "Rahat", NameAr: "رهط"},
	"Kafr Qari‘":        {NameEn: "Kafr Qari'", NameAr: "كفر قرع"},
	"Or Akiva":          {NameEn: "Qaysariyya", NameAr: "قيسارية"},
	"Yāfā":              {NameEn: "Yafa an-Nasirah", NameAr: "يافا الناصرة"},
	"Qiryat Tiv‘on":     {NameEn: "Tab'un", NameAr: "طبعون"},
	"‘Ar‘ara BaNegev":   {NameEn: "Ar'arat an-Naqab", NameAr: "عرعرة النقب"},
	"Yirkā":             {NameEn: "Yirka", NameAr: "يركا"},
	"Qalansuwa":         {NameEn: "Qalansuwa", NameAr: "قلنسوة"},

	// Slug lookups
	"jerusalem":              {NameEn: "Al-Quds", NameAr: "القدس"},
	"west-jerusalem":         {NameEn: "Al-Quds", NameAr: "القدس"},
	"east-jerusalem":         {NameEn: "Al-Quds", NameAr: "القدس"},
	"tel-aviv":               {NameEn: "Yafa", NameAr: "يافا"},
	"haifa":                  {NameEn: "Haifa", NameAr: "حيفا"},
	"acre":                   {NameEn: "Akka", NameAr: "عكّا"},
	"petah-tiqva":            {NameEn: "Mulabbis", NameAr: "ملبّس"},
	"rishon-letsiyyon":       {NameEn: "Ayun Qara", NameAr: "عيون قارة"},
	"netanya":                {NameEn: "Umm Khalid", NameAr: "أم خالد"},
	"ashdod":                 {NameEn: "Isdud", NameAr: "إسدود"},
	"bnei-brak":              {NameEn: "Ibn Ibraq", NameAr: "ابن إبراق"},
	"holon":                  {NameEn: "Yazur", NameAr: "يازور"},
	"beersheba":              {NameEn: "Bi'r as-Sabi'", NameAr: "بئر السبع"},
	"ramat-gan":              {NameEn: "Jarisha", NameAr: "جريشة"},
	"rehovot":                {NameEn: "Zarnuqa", NameAr: "زرنوقة"},
	"ashkelon":               {NameEn: "Asqalan", NameAr: "عسقلان"},
	"bat-yam":                {NameEn: "Yafa al-Janubiyya", NameAr: "يافا الجنوبية"},
	"bet-shemesh":            {NameEn: "Bayt Shams", NameAr: "بيت شمس"},
	"kfar-saba":              {NameEn: "Kafr Saba", NameAr: "كفر سابا"},
	"jaffa":                  {NameEn: "Yafa", NameAr: "يافا"},
	"herzliya":               {NameEn: "Al-Haram Sayyidna Ali", NameAr: "الحرم سيدنا علي"},
	"hadera":                 {NameEn: "Al-Khudayra", NameAr: "الخضيرة"},
	"modiin-makkabbim-reut":  {NameEn: "Al-Midya", NameAr: "المدية"},
	"nazareth-il":            {NameEn: "An-Nasirah", NameAr: "الناصرة"},
	"lod":                    {NameEn: "Al-Lidd", NameAr: "اللد"},
	"modiin-ilit":            {NameEn: "Ni'lin", NameAr: "نعلين"},
	"ramla":                  {NameEn: "Ar-Ramlah", NameAr: "الرملة"},
	"raanana":                {NameEn: "Tabsur", NameAr: "تبصر"},
	"rosh-haayin":            {NameEn: "Ras al-Ayn", NameAr: "رأس العين"},
	"hod-hasharon":           {NameEn: "Biyar Adas", NameAr: "بيار عدس"},
	"kiryat-gat":             {NameEn: "Iraq al-Manshiyya", NameAr: "عراق المنشية"},
	"givatayim":              {NameEn: "Salama", NameAr: "سلمة"},
	"qiryat-ata":             {NameEn: "Kafr Etta", NameAr: "كفر عتا"},
	"nahariyya":              {NameEn: "Al-Zeeb", NameAr: "الزيب"},
	"umm-el-fahm":            {NameEn: "Umm al-Fahm", NameAr: "أم الفحم"},
	"eilat":                  {NameEn: "Umm ar-Rashrash", NameAr: "أم الرشراش"},
	"ness-ziona":             {NameEn: "Wadi Hunayn", NameAr: "وادي حنين"},
	"elad":                   {NameEn: "Al-Muzayri'a", NameAr: "المزيرعة"},
	"yavne":                  {NameEn: "Yibna", NameAr: "يبنى"},
	"ramat-hasharon":         {NameEn: "Ijlil", NameAr: "إجليل"},
	"karmiel":                {NameEn: "Majd al-Krum", NameAr: "مجد الكروم"},
	"afula":                  {NameEn: "Al-Affula", NameAr: "العفولة"},
	"pardes-hanna-karkur":    {NameEn: "Karkur", NameAr: "كركور"},
	"tiberias":               {NameEn: "Tabariyya", NameAr: "طبريا"},
	"et-taiyiba":             {NameEn: "At-Tayyiba", NameAr: "الطيّبة"},
	"qiryat-bialik":          {NameEn: "Yajur", NameAr: "ياجور"},
	"netivot":                {NameEn: "Azzam", NameAr: "عزام"},
	"nazerat-illit":          {NameEn: "Jabal as-Sikh", NameAr: "جبل السيخ"},
	"qiryatmotsqin":          {NameEn: "Al-Ghawarneh", NameAr: "الغوارنة"},
	"shefaram":               {NameEn: "Shafa 'Amr", NameAr: "شفا عمرو"},
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

		// Re-map Israeli settlements to historical Palestinian names under PS country code
		isPalestine := false
		if cc == "IL" || cc == "PS" {
			if override, ok := palestineOverrides[nameEn]; ok {
				nameEn = override.NameEn
				nameAr = override.NameAr
				cc = "PS"
				isPalestine = true
			} else if override, ok := palestineOverrides[slug]; ok {
				nameEn = override.NameEn
				nameAr = override.NameAr
				cc = "PS"
				isPalestine = true
			} else if cc == "IL" {
				cc = "PS"
			}
			if tz == "Asia/Jerusalem" {
				tz = "Asia/Hebron"
			}
		}

		if !isPalestine {
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
