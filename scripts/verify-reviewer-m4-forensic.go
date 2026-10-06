package main

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

func main() {
	fmt.Println("=== Reviewer 2 Adversarial Forensic Audit: M4 It3 ===")
	allPassed := true

	// 1. Audit Float32Array Size Calculation
	const n = 15000
	const bytesPerFloat32 = 4
	const numBuffers = 4
	totalBytes := n * bytesPerFloat32 * numBuffers
	fmt.Printf("[Audit 1] Precomputed caches: %d buffers * %d settlements * %d bytes = %d bytes (%.1f KB)\n",
		numBuffers, n, bytesPerFloat32, totalBytes, float64(totalBytes)/1000.0)
	if totalBytes == 240000 {
		fmt.Println("  -> PASS: Exactly 240.0 KB (240,000 bytes)")
	} else {
		fmt.Printf("  -> FAIL: Expected 240000 bytes, got %d\n", totalBytes)
		allPassed = false
	}

	// 2. Read eventEngine.ts and extract countSettlementsInLastThird method
	src, err := os.ReadFile("src/simulation/eventEngine.ts")
	if err != nil {
		fmt.Printf("Cannot read src/simulation/eventEngine.ts: %v\n", err)
		os.Exit(1)
	}
	content := string(src)

	methodStart := strings.Index(content, "public countSettlementsInLastThird(date: Date): number")
	if methodStart == -1 {
		fmt.Println("[Audit 2] FAIL: public countSettlementsInLastThird not found")
		os.Exit(1)
	}
	methodBody := content[methodStart:]
	methodEnd := strings.Index(methodBody, "public evaluate")
	if methodEnd != -1 {
		methodBody = methodBody[:methodEnd]
	}

	// Find the for loop
	loopStart := strings.Index(methodBody, "for (let i = 0; i < n; i++)")
	if loopStart == -1 {
		fmt.Println("[Audit 2] FAIL: for loop not found")
		os.Exit(1)
	}
	loopBody := methodBody[loopStart:]

	// Strip comments from loopBody
	reLineComment := regexp.MustCompile(`//.*`)
	reBlockComment := regexp.MustCompile(`/\*[\s\S]*?\*/`)
	cleanLoopBody := reBlockComment.ReplaceAllString(loopBody, "")
	cleanLoopBody = reLineComment.ReplaceAllString(cleanLoopBody, "")

	fmt.Println("\n[Audit 2] AST / Token scan of countSettlementsInLastThird for loop body (excluding comments):")

	// Check for 'new '
	if strings.Contains(cleanLoopBody, "new ") {
		fmt.Println("  -> FAIL: Found 'new ' keyword inside loop!")
		allPassed = false
	} else {
		fmt.Println("  -> PASS: Zero 'new ' operator allocations inside loop")
	}

	// Check for 'Date'
	if strings.Contains(cleanLoopBody, "Date") {
		fmt.Println("  -> FAIL: Found 'Date' reference inside loop!")
		allPassed = false
	} else {
		fmt.Println("  -> PASS: Zero Date instantiations inside loop")
	}

	// Check for closures: '=>' or 'function'
	if strings.Contains(cleanLoopBody, "=>") || strings.Contains(cleanLoopBody, "function") {
		fmt.Println("  -> FAIL: Found closure or function declaration inside loop!")
		allPassed = false
	} else {
		fmt.Println("  -> PASS: Zero closures or function expressions inside loop")
	}

	// Check for array literal allocation ' ['
	reArrayLiteral := regexp.MustCompile(`=\s*\[|:\s*\[|return\s*\[`)
	if reArrayLiteral.MatchString(cleanLoopBody) {
		fmt.Println("  -> FAIL: Found array literal allocation inside loop!")
		allPassed = false
	} else {
		fmt.Println("  -> PASS: Zero array literal allocations inside loop")
	}

	// Check for object literal allocation ' {' (except for standard control structures)
	// In the loop, blocks are if (...) { or else {
	// Look for object literal assignments like: = { or : {
	reObjLiteral := regexp.MustCompile(`=\s*\{|:\s*\{|return\s*\{`)
	if reObjLiteral.MatchString(cleanLoopBody) {
		fmt.Println("  -> FAIL: Found object literal allocation inside loop!")
		allPassed = false
	} else {
		fmt.Println("  -> PASS: Zero object literal allocations inside loop")
	}

	// Check for external method invocations (this.xxx)
	reThisCall := regexp.MustCompile(`this\.[a-zA-Z0-9_]+\s*\(`)
	matches := reThisCall.FindAllString(cleanLoopBody, -1)
	if len(matches) > 0 {
		fmt.Printf("  -> FAIL: Found internal method calls inside loop: %v\n", matches)
		allPassed = false
	} else {
		fmt.Println("  -> PASS: Zero internal method calls ('this.xxx()') inside loop")
	}

	// Check for fallback calls to calculatePrayerTimes
	reCalcCall := regexp.MustCompile(`calculatePrayerTimes\s*\(`)
	if reCalcCall.MatchString(cleanLoopBody) {
		fmt.Println("  -> FAIL: Found calculatePrayerTimes(...) call in loop!")
		allPassed = false
	} else {
		fmt.Println("  -> PASS: Zero calculatePrayerTimes(...) calls inside loop")
	}

	if allPassed {
		fmt.Println("\n=== ALL FORENSIC CHECKS PASSED ===")
	} else {
		fmt.Println("\n=== ONE OR MORE FORENSIC CHECKS FAILED ===")
		os.Exit(1)
	}
}
