package main

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
	"unicode"
)

type Issue struct {
	File     string
	LineNum  int
	Locale   string
	Category string
	Char     rune
	CodeHex  string
	Content  string
	Context  string
}

func main() {
	files := []string{
		"src/i18n/translations.ts",
		"src/i18n/seo.ts",
		"src/i18n/config.ts",
	}

	var issues []Issue

	easternArabicDigits := regexp.MustCompile(`[\x{0660}-\x{0669}]`)
	persianDigits := regexp.MustCompile(`[\x{06F0}-\x{06F9}]`)
	emDashRegex := regexp.MustCompile(`[\x{2014}\x{2015}\x{2E3A}\x{2E3B}]`)
	enDashRegex := regexp.MustCompile(`\x{2013}`)
	bidiControlRegex := regexp.MustCompile(`[\x{200E}\x{200F}\x{061C}\x{202A}-\x{202E}\x{2066}-\x{2069}]`)

	// Track current locale
	localeRe := regexp.MustCompile(`^\s*(en|ar|tr|id|ms|ur|fa|bn|fr|ru):\s*\{`)
	stringLitRe := regexp.MustCompile(`'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|` + "`([^`\\\\]*(?:\\\\.[^`\\\\]*)*)`")

	for _, file := range files {
		f, err := os.Open(file)
		if err != nil {
			fmt.Printf("Error opening %s: %v\n", file, err)
			continue
		}
		defer f.Close()

		scanner := bufio.NewScanner(f)
		lineNum := 0
		currentLocale := "unknown"

		for scanner.Scan() {
			lineNum++
			line := scanner.Text()

			if m := localeRe.FindStringSubmatch(line); len(m) > 1 {
				currentLocale = m[1]
			}

			// Check for string literals on this line
			matches := stringLitRe.FindAllStringSubmatch(line, -1)
			for _, match := range matches {
				strVal := match[1]
				if strVal == "" && len(match) > 2 {
					strVal = match[2]
				}
				if strVal == "" && len(match) > 3 {
					strVal = match[3]
				}

				// 1. Eastern Arabic-Indic digits (0660-0669)
				if easternArabicDigits.MatchString(strVal) {
					for _, r := range strVal {
						if r >= 0x0660 && r <= 0x0669 {
							issues = append(issues, Issue{
								File:     file,
								LineNum:  lineNum,
								Locale:   currentLocale,
								Category: "EASTERN_ARABIC_DIGIT",
								Char:     r,
								CodeHex:  fmt.Sprintf("U+%04X", r),
								Content:  strVal,
								Context:  line,
							})
						}
					}
				}

				// 2. Persian digits (06F0-06F9)
				if persianDigits.MatchString(strVal) {
					for _, r := range strVal {
						if r >= 0x06F0 && r <= 0x06F9 {
							issues = append(issues, Issue{
								File:     file,
								LineNum:  lineNum,
								Locale:   currentLocale,
								Category: "PERSIAN_DIGIT",
								Char:     r,
								CodeHex:  fmt.Sprintf("U+%04X", r),
								Content:  strVal,
								Context:  line,
							})
						}
					}
				}

				// 3. Em dashes (U+2014, U+2015, etc.)
				if emDashRegex.MatchString(strVal) {
					for _, r := range strVal {
						if r == 0x2014 || r == 0x2015 || r == 0x2E3A || r == 0x2E3B {
							issues = append(issues, Issue{
								File:     file,
								LineNum:  lineNum,
								Locale:   currentLocale,
								Category: "EM_DASH",
								Char:     r,
								CodeHex:  fmt.Sprintf("U+%04X", r),
								Content:  strVal,
								Context:  line,
							})
						}
					}
				}

				// En dash check (informational)
				if enDashRegex.MatchString(strVal) {
					for _, r := range strVal {
						if r == 0x2013 {
							issues = append(issues, Issue{
								File:     file,
								LineNum:  lineNum,
								Locale:   currentLocale,
								Category: "EN_DASH",
								Char:     r,
								CodeHex:  fmt.Sprintf("U+%04X", r),
								Content:  strVal,
								Context:  line,
							})
						}
					}
				}

				// 4. BiDi control characters
				if bidiControlRegex.MatchString(strVal) {
					for _, r := range strVal {
						if (r >= 0x202A && r <= 0x202E) || (r >= 0x2066 && r <= 0x2069) || r == 0x200E || r == 0x200F || r == 0x061C {
							issues = append(issues, Issue{
								File:     file,
								LineNum:  lineNum,
								Locale:   currentLocale,
								Category: "BIDI_CONTROL",
								Char:     r,
								CodeHex:  fmt.Sprintf("U+%04X", r),
								Content:  strVal,
								Context:  line,
							})
						}
					}
				}

				// 5. Non-ASCII decimal digits generally (e.g. Bengali digits)
				for _, r := range strVal {
					if unicode.IsDigit(r) && (r < '0' || r > '9') {
						issues = append(issues, Issue{
							File:     file,
							LineNum:  lineNum,
							Locale:   currentLocale,
							Category: "NON_ASCII_DIGIT",
							Char:     r,
							CodeHex:  fmt.Sprintf("U+%04X", r),
							Content:  strVal,
							Context:  line,
						})
					}
				}

				// 6. Parentheses balance check
				openParen := strings.Count(strVal, "(")
				closeParen := strings.Count(strVal, ")")
				if openParen != closeParen {
					issues = append(issues, Issue{
						File:     file,
						LineNum:  lineNum,
						Locale:   currentLocale,
						Category: "UNBALANCED_PARENS",
						Char:     '(',
						CodeHex:  fmt.Sprintf("open=%d close=%d", openParen, closeParen),
						Content:  strVal,
						Context:  line,
					})
				}
			}
		}
	}

	fmt.Printf("Total scanned files: %d\n", len(files))
	fmt.Printf("Total issues identified: %d\n\n", len(issues))

	// Group by category
	catCount := make(map[string]int)
	for _, iss := range issues {
		catCount[iss.Category]++
	}

	for cat, count := range catCount {
		fmt.Printf("Category: %s -> %d occurrences\n", cat, count)
	}

	fmt.Println("\nDetailed issues breakdown:")
	for i, iss := range issues {
		fmt.Printf("[%d] File: %s:%d (Locale: %s) Category: %s Char: %c (%s)\n    Content: %s\n",
			i+1, iss.File, iss.LineNum, iss.Locale, iss.Category, iss.Char, iss.CodeHex, iss.Content)
	}
}
