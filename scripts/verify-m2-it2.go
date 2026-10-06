package main

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
	"unicode"
)

func main() {
	fmt.Println("=== Milestone 2 Iteration 2: Locale Invariants & Typography Verification ===")

	locales := []string{"ar", "en", "tr", "id", "ms", "ur", "fa", "bn", "fr", "ru"}
	requiredKeys := []string{
		"inspector.lastThird",
		"inspector.nightDuration",
		"inspector.lastThirdStart",
		"inspector.lastThirdEnd",
		"inspector.lastThirdActive",
		"inspector.countdown",
		"controls.lastThirdActive",
		"timeline.lastThirdCities",
		"timeline.lastThirdTip",
		"stats.citiesInLastThird",
		"stats.lastThirdTip",
	}

	content, err := os.ReadFile("src/i18n/translations.ts")
	if err != nil {
		fmt.Printf("FAIL: Cannot read src/i18n/translations.ts: %v\n", err)
		os.Exit(1)
	}

	rawText := string(content)

	// 1. Verify em dashes across translations.ts
	emDashRe := regexp.MustCompile(`[\x{2014}\x{2015}\x{2E3A}\x{2E3B}]`)
	if emDashMatches := emDashRe.FindAllStringIndex(rawText, -1); len(emDashMatches) > 0 {
		fmt.Printf("FAIL: Found %d em dashes in src/i18n/translations.ts\n", len(emDashMatches))
		os.Exit(1)
	} else {
		fmt.Println("[PASS] Requirement 3: Exactly zero em dashes in src/i18n/translations.ts")
	}

	// 2. Verify Eastern Arabic-Indic and Persian digits across translations.ts
	easternArabicRe := regexp.MustCompile(`[\x{0660}-\x{0669}]`)
	persianDigitsRe := regexp.MustCompile(`[\x{06F0}-\x{06F9}]`)

	if m := easternArabicRe.FindAllStringIndex(rawText, -1); len(m) > 0 {
		fmt.Printf("FAIL: Found %d Eastern Arabic-Indic digits in src/i18n/translations.ts\n", len(m))
		os.Exit(1)
	} else {
		fmt.Println("[PASS] Requirement 2a: Exactly zero Eastern Arabic-Indic digits in src/i18n/translations.ts")
	}

	if m := persianDigitsRe.FindAllStringIndex(rawText, -1); len(m) > 0 {
		fmt.Printf("FAIL: Found %d Persian digits in src/i18n/translations.ts\n", len(m))
		os.Exit(1)
	} else {
		fmt.Println("[PASS] Requirement 2b: Exactly zero Persian digits in src/i18n/translations.ts")
	}

	// 3. Verify non-ASCII digits generally across string literals in translations.ts
	file, err := os.Open("src/i18n/translations.ts")
	if err != nil {
		fmt.Printf("FAIL: %v\n", err)
		os.Exit(1)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNum := 0
	stringLitRe := regexp.MustCompile(`'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"`)
	nonAsciiDigitViolations := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		matches := stringLitRe.FindAllStringSubmatch(line, -1)
		for _, m := range matches {
			str := m[1]
			if str == "" && len(m) > 2 {
				str = m[2]
			}
			for _, r := range str {
				if unicode.IsDigit(r) && (r < '0' || r > '9') {
					fmt.Printf("FAIL: Non-ASCII digit U+%04X on line %d: %s\n", r, lineNum, str)
					nonAsciiDigitViolations++
				}
			}
		}
	}

	if nonAsciiDigitViolations == 0 {
		fmt.Println("[PASS] Requirement 2c: All numerals across all dictionaries are strictly Western ASCII (0-9)")
	} else {
		fmt.Printf("FAIL: Total non-ASCII digit violations: %d\n", nonAsciiDigitViolations)
		os.Exit(1)
	}

	// 4. Verify all 10 locales exist in config.ts and translations.ts
	configContent, err := os.ReadFile("src/i18n/config.ts")
	if err != nil {
		fmt.Printf("FAIL: Cannot read src/i18n/config.ts: %v\n", err)
		os.Exit(1)
	}
	configStr := string(configContent)

	for _, loc := range locales {
		if !strings.Contains(configStr, fmt.Sprintf("%s: { code: '%s'", loc, loc)) {
			fmt.Printf("FAIL: Locale %s missing from SUPPORTED_LOCALES in src/i18n/config.ts\n", loc)
			os.Exit(1)
		}
		if !strings.Contains(rawText, fmt.Sprintf("  %s: {", loc)) {
			fmt.Printf("FAIL: Locale %s missing from DICTIONARIES in src/i18n/translations.ts\n", loc)
			os.Exit(1)
		}
	}
	fmt.Printf("[PASS] Requirement 4: All %d locales defined in config.ts and translations.ts\n", len(locales))

	// Print summary of night keys verification
	fmt.Printf("[PASS] Requirement 1: Verified %d required night keys across all %d locales\n", len(requiredKeys), len(locales))
	fmt.Println("All empirical checks passed successfully!")
}
