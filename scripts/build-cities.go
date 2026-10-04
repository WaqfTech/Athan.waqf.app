package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sort"
)

// RawCity represents GeoNames row format from cities.json
// [slug, nameAr, nameEn, countryCode, admin1, lat, lng, tz, population]
type RawCity []any

// CompactCity format: [nameEn, nameAr, lat, lng, cc, pop, tz]
type CompactCity []any

func round2(val float64) float64 {
	return math.Round(val*100) / 100
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

	// Guaranteed must-have cities by slug or name
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

		// Ensure fallback for nameAr
		if nameAr == "" {
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

	// Sort by population descending
	sort.Slice(scored, func(i, j int) bool {
		// Guaranteed cities always take precedence
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
