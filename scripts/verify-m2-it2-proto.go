package main

import (
	"fmt"
	"os"
	"strings"
)

func main() {
	fmt.Println("=== Milestone 2 Iteration 2: Static Prototype Guard Verification ===")

	configBytes, err := os.ReadFile("src/i18n/config.ts")
	if err != nil {
		fmt.Printf("FAIL: Cannot read src/i18n/config.ts: %v\n", err)
		os.Exit(1)
	}
	configStr := string(configBytes)

	transBytes, err := os.ReadFile("src/i18n/translations.ts")
	if err != nil {
		fmt.Printf("FAIL: Cannot read src/i18n/translations.ts: %v\n", err)
		os.Exit(1)
	}
	transStr := string(transBytes)

	// Check 1: isSupportedLocale prototype guard
	hasProtoGuardConfig := strings.Contains(configStr, "Object.prototype.hasOwnProperty.call(SUPPORTED_LOCALES, candidate)")
	if !hasProtoGuardConfig {
		fmt.Println("FAIL: isSupportedLocale does not use Object.prototype.hasOwnProperty.call")
		os.Exit(1)
	}
	fmt.Println("[PASS] Check 1: isSupportedLocale strictly guards via Object.prototype.hasOwnProperty.call")

	// Check 2: getTranslations prototype guard
	hasProtoGuardTrans := strings.Contains(transStr, "Object.prototype.hasOwnProperty.call(DICTIONARIES, locale)")
	if !hasProtoGuardTrans {
		fmt.Println("FAIL: getTranslations does not use Object.prototype.hasOwnProperty.call")
		os.Exit(1)
	}
	fmt.Println("[PASS] Check 2: getTranslations strictly guards via Object.prototype.hasOwnProperty.call")

	// Check 3: getTranslations returns DICTIONARIES.en on fallback
	hasFallbackEn := strings.Contains(transStr, "return DICTIONARIES.en;")
	if !hasFallbackEn {
		fmt.Println("FAIL: getTranslations does not fallback to DICTIONARIES.en")
		os.Exit(1)
	}
	fmt.Println("[PASS] Check 3: getTranslations returns DICTIONARIES.en as default fallback")

	// Check 4: detectLocale validates pathSegment with isSupportedLocale
	if !strings.Contains(configStr, "pathSegment && isSupportedLocale(pathSegment)") {
		fmt.Println("FAIL: detectLocale does not guard pathSegment with isSupportedLocale")
		os.Exit(1)
	}
	fmt.Println("[PASS] Check 4: detectLocale path segment guarded by isSupportedLocale")

	// Check 5: detectLocale validates langParam with isSupportedLocale
	if !strings.Contains(configStr, "langParam && isSupportedLocale(langParam)") {
		fmt.Println("FAIL: detectLocale does not guard langParam with isSupportedLocale")
		os.Exit(1)
	}
	fmt.Println("[PASS] Check 5: detectLocale query param guarded by isSupportedLocale")

	// Check 6: detectLocale validates saved with isSupportedLocale
	if !strings.Contains(configStr, "saved && isSupportedLocale(saved)") {
		fmt.Println("FAIL: detectLocale does not guard saved localStorage with isSupportedLocale")
		os.Exit(1)
	}
	fmt.Println("[PASS] Check 6: detectLocale localStorage guarded by isSupportedLocale")

	// Check 7: detectLocale validates browser navigator languages with isSupportedLocale
	if !strings.Contains(configStr, "isSupportedLocale(code)") {
		fmt.Println("FAIL: detectLocale does not guard navigator languages with isSupportedLocale")
		os.Exit(1)
	}
	fmt.Println("[PASS] Check 7: detectLocale navigator languages guarded by isSupportedLocale")

	fmt.Println("All static prototype guard checks passed successfully!")
}
