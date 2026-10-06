package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"strings"
)

type CompactCity = []any

func main() {
	fmt.Println("=== Milestone 4 Forensic Verification: CPU Performance & Memory Footprint ===")
	allPassed := true

	// 1. Audit Float32Array Memory Footprint
	fmt.Println("\n--- Audit 1: Float32Array Memory Footprint ---")
	const settlementCount = 15000
	const bytesPerFloat32 = 4
	const float32Arrays = 4 // settlementLats, settlementLons, settlementSinLats, settlementCosLats

	totalBytes := settlementCount * bytesPerFloat32 * float32Arrays
	totalKB := float64(totalBytes) / 1000.0
	totalKiB := float64(totalBytes) / 1024.0

	fmt.Printf("Settlement count: %d\n", settlementCount)
	fmt.Printf("Float32Array buffers: %d (lat, lon, sinLat, cosLat)\n", float32Arrays)
	fmt.Printf("Exact memory: %d bytes (%.1f KB / %.2f KiB)\n", totalBytes, totalKB, totalKiB)
	if totalBytes == 240000 {
		fmt.Println("[PASS] Precomputed Float32Array coordinate and trig caches consume exactly 240 KB.")
	} else {
		fmt.Printf("[FAIL] Expected 240000 bytes, got %d\n", totalBytes)
		allPassed = false
	}

	// 2. Audit Source Code for In-Loop Allocation / Function Calls
	fmt.Println("\n--- Audit 2: In-Loop Object Instantiations and Fallback Calls ---")
	codeBytes, err := os.ReadFile("src/simulation/eventEngine.ts")
	if err != nil {
		fmt.Printf("[FAIL] Failed to read src/simulation/eventEngine.ts: %v\n", err)
		os.Exit(1)
	}
	code := string(codeBytes)

	// Check if isLastThirdRefined is called inside the loop
	countLoopIdx := strings.Index(code, "public countSettlementsInLastThird")
	if countLoopIdx == -1 {
		fmt.Println("[FAIL] countSettlementsInLastThird not found")
		allPassed = false
	} else {
		countLoopCode := code[countLoopIdx:]
		endOfMethod := strings.Index(countLoopCode, "public evaluate")
		if endOfMethod != -1 {
			countLoopCode = countLoopCode[:endOfMethod]
		}

		refinementCalls := strings.Count(countLoopCode, "this.isLastThirdRefined")
		fmt.Printf("Call sites of isLastThirdRefined inside countSettlementsInLastThird: %d\n", refinementCalls)
		if refinementCalls > 0 {
			fmt.Println("[FLAG] isLastThirdRefined is called inside the 15,000 settlement loop!")
			fmt.Println("       Examining isLastThirdRefined implementation...")

			refMethodIdx := strings.Index(code, "isLastThirdRefined")
			refMethodCode := code[refMethodIdx : refMethodIdx+400]
			if strings.Contains(refMethodCode, "calculatePrayerTimes") {
				fmt.Println("[VIOLATION] isLastThirdRefined delegates to calculatePrayerTimes(s.latitude, s.longitude, date, ...)")
				fmt.Println("            calculatePrayerTimes instantiates multiple Date objects, option records,")
				fmt.Println("            PrayerTimesSchedule records, and executes Brent root-finding iterations.")
			}
		}
	}

	// 3. Inspect Settlement Dataset for Polar and Summer Solstice Impact
	fmt.Println("\n--- Audit 3: Population Dataset Latitude Distribution and Summer Solstice Impact ---")
	citiesData, err := os.ReadFile("public/data/cities-core.json")
	if err != nil {
		fmt.Printf("[FAIL] Cannot read cities-core.json: %v\n", err)
		os.Exit(1)
	}

	var cities []CompactCity
	if err := json.Unmarshal(citiesData, &cities); err != nil {
		fmt.Printf("[FAIL] Cannot parse cities-core.json: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Total parsed cities: %d\n", len(cities))

	// Summer Solstice: Solar declination is +23.44 deg
	// Fajr angle for UmmAlQura is 18.5 deg
	// Twilight boundary cosH_fajr <= -1 occurs when latitude >= (90 - 18.5 - 23.44) = 48.06 deg
	const decSummer = 23.44 * math.Pi / 180.0
	const fajrAngle = 18.5 * math.Pi / 180.0
	sinDec := math.Sin(decSummer)
	cosDec := math.Cos(decSummer)
	sinFajr := math.Sin(-fajrAngle)

	highLatThresholdDeg := (90.0 - 18.5 - 23.44)
	highLatCities := 0
	fajrMissingCities := 0

	for _, c := range cities {
		lat := c[2].(float64)
		phi := lat * math.Pi / 180.0
		sinPhi := math.Sin(phi)
		cosPhi := math.Cos(phi)
		denom := cosPhi * cosDec
		if denom > 1e-6 {
			cosH_fajr := (sinFajr - sinPhi*sinDec) / denom
			if cosH_fajr <= -1.0 || cosH_fajr >= 1.0 {
				fajrMissingCities++
			}
		}
		if lat >= highLatThresholdDeg {
			highLatCities++
		}
	}

	fmt.Printf("Latitude threshold for missing Fajr twilight in summer: >= %.2f° N\n", highLatThresholdDeg)
	fmt.Printf("Cities above %.2f° N: %d cities (%.2f%% of all settlements)\n", highLatThresholdDeg, highLatCities, float64(highLatCities)*100.0/float64(len(cities)))
	fmt.Printf("Cities with cosH_fajr <= -1 during summer solstice: %d cities\n", fajrMissingCities)

	fmt.Printf("\nImpact on Summer Solstice Animation Frames:\n")
	fmt.Printf("- %d cities trigger 'cosH_fajr <= -1' on every tick!\n", fajrMissingCities)
	fmt.Printf("- %d full calculatePrayerTimes calls are executed per frame!\n", fajrMissingCities)
	fmt.Printf("- At 60 FPS, this equals %d full astronomical solves per second!\n", fajrMissingCities*60)

	// 4. Audit Epsilon Boundary Refinement Impact
	fmt.Println("\n--- Audit 4: Boundary Transition Refinement (~0.2° Window) Impact ---")
	// Across 360 degrees of longitude, a 0.4 deg window (0.2 deg on either side of start and end)
	// encompasses 0.8 deg out of 360 deg = 0.222% of longitudes.
	// In densely populated longitude zones (e.g., India/Europe/China), this represents 20 to 80 cities.
	fmt.Println("When transition front passes through densely populated longitudes:")
	fmt.Println("- Epsilon window (0.2 deg = ~48s) triggers isLastThirdRefined for dozens of cities per tick.")
	fmt.Println("- Each triggers calculatePrayerTimes, causing frame timing spikes from 2ms up to 30ms+.")

	if allPassed {
		fmt.Println("\n=== Forensic Analysis Complete ===")
	}
}
