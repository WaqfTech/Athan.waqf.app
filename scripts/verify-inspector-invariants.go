package main

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
)

type Violation struct {
	Category string
	File     string
	Line     int
	Content  string
	Detail   string
}

func main() {
	var violations []Violation

	easternArabicRe := regexp.MustCompile(`[\x{0660}-\x{0669}]`)
	persianRe := regexp.MustCompile(`[\x{06F0}-\x{06F9}]`)
	emDashRe := regexp.MustCompile(`[\x{2014}\x{2015}\x{2E3A}\x{2E3B}]`)

	// 1. Check src/ui/inspector.ts for illegal characters and em dashes
	inspectorFile := "src/ui/inspector.ts"
	f, err := os.Open(inspectorFile)
	if err != nil {
		fmt.Printf("Error opening %s: %v\n", inspectorFile, err)
		os.Exit(1)
	}
	scanner := bufio.NewScanner(f)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		if easternArabicRe.MatchString(line) {
			violations = append(violations, Violation{
				Category: "EASTERN_ARABIC_NUMERAL",
				File:     inspectorFile,
				Line:     lineNum,
				Content:  strings.TrimSpace(line),
				Detail:   "Eastern Arabic-Indic digit found in inspector.ts",
			})
		}
		if persianRe.MatchString(line) {
			violations = append(violations, Violation{
				Category: "PERSIAN_NUMERAL",
				File:     inspectorFile,
				Line:     lineNum,
				Content:  strings.TrimSpace(line),
				Detail:   "Persian digit found in inspector.ts",
			})
		}
		if emDashRe.MatchString(line) {
			violations = append(violations, Violation{
				Category: "EM_DASH",
				File:     inspectorFile,
				Line:     lineNum,
				Content:  strings.TrimSpace(line),
				Detail:   "Em dash character found in inspector.ts",
			})
		}
	}
	f.Close()

	// 2. Check src/styles/main.css for physical directional properties in inspector rules
	cssFile := "src/styles/main.css"
	cssF, err := os.Open(cssFile)
	if err != nil {
		fmt.Printf("Error opening %s: %v\n", cssFile, err)
		os.Exit(1)
	}
	cssScanner := bufio.NewScanner(cssF)
	cssLineNum := 0
	inInspectorNightRule := false
	braceDepth := 0

	physicalPropRe := regexp.MustCompile(`\b(margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius|left|right)\s*:`)

	for cssScanner.Scan() {
		cssLineNum++
		line := cssScanner.Text()
		trimmed := strings.TrimSpace(line)

		if strings.Contains(line, ".inspector-night") {
			inInspectorNightRule = true
		}

		if inInspectorNightRule {
			openBraces := strings.Count(line, "{")
			closeBraces := strings.Count(line, "}")
			braceDepth += openBraces - closeBraces

			// Check for physical properties inside the rule body
			if physicalPropRe.MatchString(trimmed) {
				match := physicalPropRe.FindString(trimmed)
				violations = append(violations, Violation{
					Category: "PHYSICAL_CSS_PROPERTY",
					File:     cssFile,
					Line:     cssLineNum,
					Content:  trimmed,
					Detail:   fmt.Sprintf("Physical directional CSS property '%s' in inspector night rule", match),
				})
			}

			if braceDepth <= 0 && closeBraces > 0 {
				inInspectorNightRule = false
				braceDepth = 0
			}
		}
	}
	cssF.Close()

	// 3. Check src/i18n/translations.ts for inspector keys across all 10 locales
	transFile := "src/i18n/translations.ts"
	transF, err := os.Open(transFile)
	if err != nil {
		fmt.Printf("Error opening %s: %v\n", transFile, err)
		os.Exit(1)
	}
	transScanner := bufio.NewScanner(transF)
	transLineNum := 0
	inInspectorBlock := false
	currentLocale := ""
	localeHeaderRe := regexp.MustCompile(`^\s*(ar|en|tr|id|ms|ur|fa|bn|fr|ru):\s*\{`)

	foundKeysPerLocale := make(map[string]map[string]string)
	locales := []string{"ar", "en", "tr", "id", "ms", "ur", "fa", "bn", "fr", "ru"}
	for _, loc := range locales {
		foundKeysPerLocale[loc] = make(map[string]string)
	}

	for transScanner.Scan() {
		transLineNum++
		line := transScanner.Text()

		if m := localeHeaderRe.FindStringSubmatch(line); len(m) > 1 {
			currentLocale = m[1]
		}

		if currentLocale != "" {
			if strings.Contains(line, "inspector: {") {
				inInspectorBlock = true
			}
			if inInspectorBlock {
				if strings.Contains(line, "};") || (strings.HasPrefix(strings.TrimSpace(line), "},") && !strings.Contains(line, "provenance")) {
					// could exit block if depth tracking
				}

				// Check inspector night keys
				keysToCheck := []string{"lastThird", "nightDuration", "lastThirdStart", "lastThirdEnd", "lastThirdActive", "countdown"}
				for _, k := range keysToCheck {
					prefix := k + ":"
					trimmed := strings.TrimSpace(line)
					if strings.HasPrefix(trimmed, prefix) {
						val := strings.TrimPrefix(trimmed, prefix)
						val = strings.TrimSpace(val)
						val = strings.Trim(val, "',\",")
						foundKeysPerLocale[currentLocale][k] = val

						// Check if value has Eastern numerals or em dash
						if easternArabicRe.MatchString(val) {
							violations = append(violations, Violation{
								Category: "EASTERN_ARABIC_NUMERAL",
								File:     transFile,
								Line:     transLineNum,
								Content:  trimmed,
								Detail:   fmt.Sprintf("Locale '%s' key '%s' has Eastern Arabic digit", currentLocale, k),
							})
						}
						if persianRe.MatchString(val) {
							violations = append(violations, Violation{
								Category: "PERSIAN_NUMERAL",
								File:     transFile,
								Line:     transLineNum,
								Content:  trimmed,
								Detail:   fmt.Sprintf("Locale '%s' key '%s' has Persian digit", currentLocale, k),
							})
						}
						if emDashRe.MatchString(val) {
							violations = append(violations, Violation{
								Category: "EM_DASH",
								File:     transFile,
								Line:     transLineNum,
								Content:  trimmed,
								Detail:   fmt.Sprintf("Locale '%s' key '%s' has em dash", currentLocale, k),
							})
						}
					}
				}
			}
		}
	}
	transF.Close()

	// Verify all 10 locales have non-empty keys
	requiredKeys := []string{"lastThird", "nightDuration", "lastThirdStart", "lastThirdEnd", "lastThirdActive", "countdown"}
	for _, loc := range locales {
		for _, k := range requiredKeys {
			val, ok := foundKeysPerLocale[loc][k]
			if !ok || strings.TrimSpace(val) == "" {
				violations = append(violations, Violation{
					Category: "MISSING_OR_EMPTY_KEY",
					File:     transFile,
					Line:     0,
					Content:  "",
					Detail:   fmt.Sprintf("Locale '%s' missing or empty inspector key '%s'", loc, k),
				})
			}
		}
	}

	// Output results
	fmt.Printf("=== Inspector Invariant Verification Report ===\n")
	fmt.Printf("Total Violations: %d\n", len(violations))
	if len(violations) > 0 {
		for i, v := range violations {
			fmt.Printf("[%d] %s at %s:%d: %s (Detail: %s)\n", i+1, v.Category, v.File, v.Line, v.Content, v.Detail)
		}
		os.Exit(1)
	}

	fmt.Printf("SUCCESS: Zero Eastern Arabic-Indic numerals found.\n")
	fmt.Printf("SUCCESS: Zero Persian numerals found.\n")
	fmt.Printf("SUCCESS: Zero em dashes found.\n")
	fmt.Printf("SUCCESS: Zero physical directional CSS properties in inspector night card selectors.\n")
	fmt.Printf("SUCCESS: All 10 locales have non-empty localized keys for the night section.\n")
}
