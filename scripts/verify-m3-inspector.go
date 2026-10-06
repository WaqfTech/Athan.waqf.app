package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

func main() {
	fmt.Println("=== Milestone 3 Forensic Verification: Inspector Panel & Telemetry ===")
	passed := true

	// Check 1: Verify src/ui/inspector.ts contains genuine night card structure
	inspectorCode, err := os.ReadFile("src/ui/inspector.ts")
	if err != nil {
		fmt.Printf("[FAIL] Cannot read src/ui/inspector.ts: %v\n", err)
		os.Exit(1)
	}
	inspectorText := string(inspectorCode)

	requiredTokens := []string{
		"formatDuration",
		"sched.islamicNight",
		"inspector-night-card",
		"inspector-night-header",
		"inspector-night-title",
		"inspector-night-badge",
		"inspector-night-times",
		"inspector-night-time-cell",
		"inspector-night-countdown",
		"trans.inspector.lastThird",
		"trans.inspector.lastThirdActive",
		"trans.inspector.lastThirdStart",
		"trans.inspector.lastThirdEnd",
		"trans.inspector.nightDuration",
		"trans.inspector.countdown",
	}

	for _, token := range requiredTokens {
		if !strings.Contains(inspectorText, token) {
			fmt.Printf("[FAIL] src/ui/inspector.ts missing required token: %s\n", token)
			passed = false
		}
	}
	if passed {
		fmt.Println("[PASS] Check 1: src/ui/inspector.ts contains all required night card elements and telemetry bindings")
	}

	// Check 2: Verify zero hardcoded test fixtures or bypass mocks in src/ui/inspector.ts
	prohibitedPatterns := []string{
		"Makkah",
		"Tokyo",
		"Honolulu",
		"return true",
		"return false",
		"return \"0h 0m\"",
		"return \"00:00:00\"",
	}
	for _, pattern := range prohibitedPatterns {
		if strings.Contains(inspectorText, pattern) {
			fmt.Printf("[FAIL] Found hardcoded pattern '%s' in src/ui/inspector.ts\n", pattern)
			passed = false
		}
	}
	if passed {
		fmt.Println("[PASS] Check 2: Zero hardcoded test city fixtures or static returns in src/ui/inspector.ts")
	}

	// Check 3: CSS logical properties audit on inspector-night rules in src/styles/main.css
	cssCode, err := os.ReadFile("src/styles/main.css")
	if err != nil {
		fmt.Printf("[FAIL] Cannot read src/styles/main.css: %v\n", err)
		os.Exit(1)
	}
	cssText := string(cssCode)

	startMarker := "/* Last Third of the Night Inspector Card */"
	endMarker := "/* Prayer Provenance Badges */"
	startIdx := strings.Index(cssText, startMarker)
	endIdx := strings.Index(cssText, endMarker)

	if startIdx == -1 || endIdx == -1 || startIdx >= endIdx {
		fmt.Println("[FAIL] Could not locate inspector night card CSS block in src/styles/main.css")
		passed = false
	} else {
		nightCss := cssText[startIdx:endIdx]

		forbiddenPhysical := []string{
			"margin-left",
			"margin-right",
			"padding-left",
			"padding-right",
			"border-left",
			"border-right",
			"text-align: left",
			"text-align: right",
		}

		for _, prop := range forbiddenPhysical {
			re := regexp.MustCompile(`\b` + regexp.QuoteMeta(prop) + `\b`)
			if re.MatchString(nightCss) {
				fmt.Printf("[FAIL] Found forbidden physical property '%s' in inspector night card CSS\n", prop)
				passed = false
			}
		}

		mandatoryLogical := []string{
			"padding-inline",
			"padding-block",
			"border-inline-start",
			"border-block-start",
			"text-align: start",
			"text-align: end",
		}
		for _, prop := range mandatoryLogical {
			if !strings.Contains(nightCss, prop) {
				fmt.Printf("[FAIL] Missing mandatory logical CSS property '%s' in inspector night card CSS\n", prop)
				passed = false
			}
		}

		if passed {
			fmt.Println("[PASS] Check 3: Inspector night card CSS uses strict logical properties with zero physical directional overrides")
		}
	}

	// Check 4: Numerals check in src/ui/inspector.ts and translations
	easternArabicRe := regexp.MustCompile(`[\x{0660}-\x{0669}\x{06F0}-\x{06F9}]`)
	if easternArabicRe.MatchString(inspectorText) {
		fmt.Println("[FAIL] Found Eastern Arabic-Indic numerals in src/ui/inspector.ts")
		passed = false
	} else {
		fmt.Println("[PASS] Check 4: Zero Eastern Arabic-Indic numerals in src/ui/inspector.ts (Western numerals 0-9 enforced)")
	}

	// Check 5: Em dashes check in src/ui/inspector.ts and inspector CSS block
	emDashRe := regexp.MustCompile(`[\x{2014}\x{2015}\x{2E3A}\x{2E3B}]`)
	if emDashRe.MatchString(inspectorText) {
		fmt.Println("[FAIL] Found em dashes in src/ui/inspector.ts")
		passed = false
	} else {
		fmt.Println("[PASS] Check 5: Zero em dashes in src/ui/inspector.ts")
	}

	if !passed {
		fmt.Println("\n>>> VERDICT: INTEGRITY VIOLATION <<<")
		os.Exit(1)
	}

	fmt.Println("\n>>> VERDICT: CLEAN <<<")
}
