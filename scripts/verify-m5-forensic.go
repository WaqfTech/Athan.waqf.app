package main

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

func main() {
	fmt.Println("=== Starting Forensic Audit for Milestone 5 ===")
	passed := true

	// 1. Audit CSS diff for physical directional CSS
	fmt.Println("\n[Check 1] Auditing CSS diff for physical directional CSS...")
	cmd := exec.Command("git", "diff", "HEAD", "--", "src/styles/main.css")
	out, err := cmd.Output()
	if err != nil {
		fmt.Printf("FAIL: git diff error: %v\n", err)
		passed = false
	} else {
		lines := strings.Split(string(out), "\n")
		physRegex := regexp.MustCompile(`\b(margin-left|margin-right|padding-left|padding-right|left\s*:|right\s*:|ml-|mr-|pl-|pr-)\b`)
		diffViolations := 0
		addedCount := 0
		for _, line := range lines {
			if strings.HasPrefix(line, "+") && !strings.HasPrefix(line, "+++") {
				addedCount++
				if physRegex.MatchString(line) {
					// Exclude lines with explicit LTR isolation if any
					if !strings.Contains(line, "direction: ltr") {
						fmt.Printf("Physical CSS found in diff: %s\n", line)
						diffViolations++
					}
				}
			}
		}
		if diffViolations > 0 {
			fmt.Printf("FAIL: %d physical CSS properties in diff\n", diffViolations)
			passed = false
		} else {
			fmt.Printf("PASS: 0 physical CSS properties in added diff (%d lines inspected)\n", addedCount)
		}
	}

	// 2. Audit all timeline stat chip rules in main.css
	fmt.Println("\n[Check 2] Auditing timeline stat chip CSS rules...")
	cssBytes, err := os.ReadFile("src/styles/main.css")
	if err != nil {
		fmt.Printf("FAIL: reading main.css: %v\n", err)
		passed = false
	} else {
		css := string(cssBytes)
		chipRegex := regexp.MustCompile(`(?s)\.stat-chip[^{]*\{([^}]+)\}`)
		matches := chipRegex.FindAllStringSubmatch(css, -1)
		chipViolations := 0
		physRegex := regexp.MustCompile(`\b(margin-left|margin-right|padding-left|padding-right|left\s*:|right\s*:)\b`)
		for _, m := range matches {
			ruleBody := m[1]
			if physRegex.MatchString(ruleBody) {
				fmt.Printf("Physical CSS in stat-chip rule: %s\n", ruleBody)
				chipViolations++
			}
		}
		if chipViolations > 0 {
			fmt.Printf("FAIL: %d physical CSS violations in stat-chip rules\n", chipViolations)
			passed = false
		} else {
			fmt.Printf("PASS: All %d stat-chip rules adhere to CSS logical properties\n", len(matches))
		}
	}

	// 3. Audit Numeral Integrity (No Eastern Arabic-Indic numerals in UI/translations)
	fmt.Println("\n[Check 3] Auditing numeral integrity (Western 0-9 only)...")
	easternNumRegex := regexp.MustCompile(`[\x{0660}-\x{0669}\x{06F0}-\x{06F9}]`)
	checkFiles := []string{
		"src/ui/timeline.ts",
		"src/ui/hud.ts",
		"src/main.ts",
		"src/i18n/translations.ts",
	}
	for _, f := range checkFiles {
		content, err := os.ReadFile(f)
		if err != nil {
			fmt.Printf("FAIL reading %s: %v\n", f, err)
			passed = false
			continue
		}
		matches := easternNumRegex.FindAllString(string(content), -1)
		if len(matches) > 0 {
			fmt.Printf("FAIL: %s contains %d Eastern Arabic-Indic numerals\n", f, len(matches))
			passed = false
		} else {
			fmt.Printf("PASS: %s contains 0 Eastern Arabic-Indic numerals\n", f)
		}
	}

	// 4. Verify Telemetry Wiring in main.ts, hud.ts, and timeline.ts
	fmt.Println("\n[Check 4] Verifying telemetry wiring...")
	timelineContent, _ := os.ReadFile("src/ui/timeline.ts")
	hudContent, _ := os.ReadFile("src/ui/hud.ts")
	mainContent, _ := os.ReadFile("src/main.ts")

	tStr := string(timelineContent)
	hStr := string(hudContent)
	mStr := string(mainContent)

	if !strings.Contains(tStr, "updateLastThirdCount") {
		fmt.Println("FAIL: timeline.ts missing updateLastThirdCount")
		passed = false
	} else if !strings.Contains(tStr, "id=\"stat-chip-last-third\"") {
		fmt.Println("FAIL: timeline.ts missing stat-chip-last-third DOM element")
		passed = false
	} else if !strings.Contains(tStr, "safeCount.toLocaleString('en-US')") {
		fmt.Println("FAIL: timeline.ts not formatting with en-US locale")
		passed = false
	} else {
		fmt.Println("PASS: timeline.ts genuine telemetry element and method found")
	}

	if !strings.Contains(hStr, "timeline.updateLastThirdCount(count)") {
		fmt.Println("FAIL: hud.ts does not propagate count to timeline")
		passed = false
	} else if !strings.Contains(hStr, "eventEngine.countSettlementsInLastThird(date)") {
		fmt.Println("FAIL: hud.ts does not call eventEngine.countSettlementsInLastThird")
		passed = false
	} else {
		fmt.Println("PASS: hud.ts wires eventEngine to timeline telemetry")
	}

	if !strings.Contains(mStr, "hud.setEventEngine(eventEngine)") {
		fmt.Println("FAIL: main.ts does not call hud.setEventEngine")
		passed = false
	} else if !strings.Contains(mStr, "eventEngine.countSettlementsInLastThird(currentTime)") {
		fmt.Println("FAIL: main.ts tick loop does not evaluate countSettlementsInLastThird")
		passed = false
	} else if !strings.Contains(mStr, "hud.updateLastThirdCount(lastThirdCount)") {
		fmt.Println("FAIL: main.ts does not update hud in tick loop")
		passed = false
	} else {
		fmt.Println("PASS: main.ts tick loop and lifecycle genuinely wire eventEngine to HUD")
	}

	// 5. Pre-populated artifact detection
	fmt.Println("\n[Check 5] Pre-populated artifact detection...")
	cmd = exec.Command("find", ".", "-maxdepth", "3", "(", "-name", "*.log", "-o", "-name", "*result*", "-o", "-name", "*output*", ")")
	findOut, err := cmd.Output()
	if err == nil {
		found := strings.TrimSpace(string(findOut))
		if found != "" {
			fmt.Printf("Info: Found artifact matches:\n%s\n", found)
		} else {
			fmt.Println("PASS: No pre-populated logs or verification output artifacts found")
		}
	}

	fmt.Println("\n=== Forensic Script Complete ===")
	if !passed {
		os.Exit(1)
	}
}
