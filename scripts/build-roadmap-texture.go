package main

import (
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"
)

const (
	texWidth  = 2048
	texHeight = 1024
)

// Google Maps Roadmap Color Palette
var (
	// Day mode
	dayWaterColor     = color.RGBA{R: 170, G: 211, B: 223, A: 255} // #aad3df (Google Maps ocean)
	dayLandColor      = color.RGBA{R: 245, G: 243, B: 233, A: 255} // #f5f3e9 (Google Maps land)
	dayBorderColor    = color.RGBA{R: 160, G: 174, B: 192, A: 255} // #a0aec0 (slate border)
	dayCoastlineColor = color.RGBA{R: 138, G: 175, B: 189, A: 255} // #8aafbd (subtle coastal accent)

	// Night mode (Google Maps Dark / Cartographic Night)
	nightWaterColor     = color.RGBA{R: 11, G: 17, B: 32, A: 255}  // #0b1120 (slate-950 ocean)
	nightLandColor      = color.RGBA{R: 26, G: 34, B: 51, A: 255}  // #1a2233 (slate-900 land)
	nightBorderColor    = color.RGBA{R: 56, G: 76, B: 106, A: 255} // #384c6a (subtle luminous border)
	nightCoastlineColor = color.RGBA{R: 20, G: 30, B: 50, A: 255}  // #141e32 (coastal outline)
)

type GeoJSONFeatureCollection struct {
	Type     string           `json:"type"`
	Features []GeoJSONFeature `json:"features"`
}

type GeoJSONFeature struct {
	Type     string          `json:"type"`
	Geometry json.RawMessage `json:"geometry"`
}

type GeoJSONGeometryHeader struct {
	Type string `json:"type"`
}

type PolygonGeometry struct {
	Coordinates [][][2]float64 `json:"coordinates"`
}

type MultiPolygonGeometry struct {
	Coordinates [][][][2]float64 `json:"coordinates"`
}

type LineStringGeometry struct {
	Coordinates [][2]float64 `json:"coordinates"`
}

type MultiLineStringGeometry struct {
	Coordinates [][][2]float64 `json:"coordinates"`
}

type Point2D struct {
	X float64
	Y float64
}

type BoundingBox struct {
	MinX, MinY, MaxX, MaxY float64
}

type Polygon2D struct {
	Rings [][]Point2D
	BBox  BoundingBox
}

type Edge struct {
	YMin, YMax float64
	XAtYMin    float64
	InvSlope   float64 // dx/dy
}

func ensureCachedFile(cacheDir, filename, url string) (string, error) {
	destPath := filepath.Join(cacheDir, filename)
	if _, err := os.Stat(destPath); err == nil {
		return destPath, nil
	}

	fmt.Printf("Downloading %s from %s...\n", filename, url)
	client := http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to fetch %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fetch %s returned status %d", url, resp.StatusCode)
	}

	tmpFile := destPath + ".tmp"
	f, err := os.Create(tmpFile)
	if err != nil {
		return "", fmt.Errorf("failed to create file %s: %w", tmpFile, err)
	}
	defer f.Close()

	if _, err := io.Copy(f, resp.Body); err != nil {
		return "", fmt.Errorf("failed to write %s: %w", tmpFile, err)
	}
	f.Close()

	if err := os.Rename(tmpFile, destPath); err != nil {
		return "", fmt.Errorf("failed to rename %s to %s: %w", tmpFile, destPath, err)
	}
	return destPath, nil
}

func lonLatToPixel(lon, lat float64, w, h int) Point2D {
	x := (lon + 180.0) / 360.0 * float64(w)
	y := (90.0 - lat) / 180.0 * float64(h)

	if x < 0 {
		x = 0
	} else if x >= float64(w) {
		x = float64(w) - 0.001
	}
	if y < 0 {
		y = 0
	} else if y >= float64(h) {
		y = float64(h) - 0.001
	}
	return Point2D{X: x, Y: y}
}

func loadPolygons(filePath string, w, h int) ([]Polygon2D, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var fc GeoJSONFeatureCollection
	if err := json.Unmarshal(data, &fc); err != nil {
		return nil, fmt.Errorf("failed to parse GeoJSON: %w", err)
	}

	var result []Polygon2D

	for _, feat := range fc.Features {
		var header GeoJSONGeometryHeader
		if err := json.Unmarshal(feat.Geometry, &header); err != nil {
			continue
		}

		switch header.Type {
		case "Polygon":
			var polyGeom PolygonGeometry
			if err := json.Unmarshal(feat.Geometry, &polyGeom); err != nil {
				continue
			}
			poly := buildPolygon2D(polyGeom.Coordinates, w, h)
			if poly != nil {
				result = append(result, *poly)
			}
		case "MultiPolygon":
			var multiGeom MultiPolygonGeometry
			if err := json.Unmarshal(feat.Geometry, &multiGeom); err != nil {
				continue
			}
			for _, coords := range multiGeom.Coordinates {
				poly := buildPolygon2D(coords, w, h)
				if poly != nil {
					result = append(result, *poly)
				}
			}
		}
	}

	return result, nil
}

func loadLineStrings(filePath string, w, h int) ([][]Point2D, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var fc GeoJSONFeatureCollection
	if err := json.Unmarshal(data, &fc); err != nil {
		return nil, fmt.Errorf("failed to parse GeoJSON: %w", err)
	}

	var result [][]Point2D

	for _, feat := range fc.Features {
		var header GeoJSONGeometryHeader
		if err := json.Unmarshal(feat.Geometry, &header); err != nil {
			continue
		}

		switch header.Type {
		case "LineString":
			var lineGeom LineStringGeometry
			if err := json.Unmarshal(feat.Geometry, &lineGeom); err != nil {
				continue
			}
			pts := make([]Point2D, len(lineGeom.Coordinates))
			for i, c := range lineGeom.Coordinates {
				pts[i] = lonLatToPixel(c[0], c[1], w, h)
			}
			if len(pts) >= 2 {
				result = append(result, pts)
			}
		case "MultiLineString":
			var multiGeom MultiLineStringGeometry
			if err := json.Unmarshal(feat.Geometry, &multiGeom); err != nil {
				continue
			}
			for _, lineCoords := range multiGeom.Coordinates {
				pts := make([]Point2D, len(lineCoords))
				for i, c := range lineCoords {
					pts[i] = lonLatToPixel(c[0], c[1], w, h)
				}
				if len(pts) >= 2 {
					result = append(result, pts)
				}
			}
		}
	}

	return result, nil
}

func buildPolygon2D(rawRings [][][2]float64, w, h int) *Polygon2D {
	if len(rawRings) == 0 {
		return nil
	}

	minX, minY := math.MaxFloat64, math.MaxFloat64
	maxX, maxY := -math.MaxFloat64, -math.MaxFloat64

	rings := make([][]Point2D, len(rawRings))
	for rIdx, rawRing := range rawRings {
		ring := make([]Point2D, len(rawRing))
		for pIdx, pt := range rawRing {
			p := lonLatToPixel(pt[0], pt[1], w, h)
			ring[pIdx] = p
			if p.X < minX {
				minX = p.X
			}
			if p.X > maxX {
				maxX = p.X
			}
			if p.Y < minY {
				minY = p.Y
			}
			if p.Y > maxY {
				maxY = p.Y
			}
		}
		rings[rIdx] = ring
	}

	return &Polygon2D{
		Rings: rings,
		BBox:  BoundingBox{MinX: minX, MinY: minY, MaxX: maxX, MaxY: maxY},
	}
}

// Rasterize polygons with scanline even-odd rule
func rasterizePolygons(img *image.RGBA, polygons []Polygon2D, fillColor color.RGBA) {
	bounds := img.Bounds()
	height := bounds.Dy()
	width := bounds.Dx()

	// Pre-extract edges for each polygon
	type PolyEdges struct {
		minY, maxY int
		edges      []Edge
	}

	polyEdgeList := make([]PolyEdges, 0, len(polygons))

	for i := range polygons {
		poly := &polygons[i]
		minY := int(math.Floor(poly.BBox.MinY))
		maxY := int(math.Ceil(poly.BBox.MaxY))
		if minY < 0 {
			minY = 0
		}
		if maxY >= height {
			maxY = height - 1
		}
		if minY > maxY {
			continue
		}

		var edges []Edge
		for _, ring := range poly.Rings {
			n := len(ring)
			if n < 3 {
				continue
			}
			for i := 0; i < n; i++ {
				p1 := ring[i]
				p2 := ring[(i+1)%n]

				if p1.Y == p2.Y {
					continue // Horizontal edge does not cross scanlines
				}

				var yMin, yMax, xAtYMin, dx, dy float64
				if p1.Y < p2.Y {
					yMin, yMax = p1.Y, p2.Y
					xAtYMin = p1.X
					dx = p2.X - p1.X
					dy = p2.Y - p1.Y
				} else {
					yMin, yMax = p2.Y, p1.Y
					xAtYMin = p2.X
					dx = p1.X - p2.X
					dy = p1.Y - p2.Y
				}

				edges = append(edges, Edge{
					YMin:     yMin,
					YMax:     yMax,
					XAtYMin:  xAtYMin,
					InvSlope: dx / dy,
				})
			}
		}

		if len(edges) > 0 {
			polyEdgeList = append(polyEdgeList, PolyEdges{
				minY:  minY,
				maxY:  maxY,
				edges: edges,
			})
		}
	}

	// For each scanline
	intersections := make([]float64, 0, 64)

	for y := 0; y < height; y++ {
		yScan := float64(y) + 0.5

		for _, pe := range polyEdgeList {
			if y < pe.minY || y > pe.maxY {
				continue
			}

			intersections = intersections[:0]
			for _, e := range pe.edges {
				if yScan >= e.YMin && yScan < e.YMax {
					x := e.XAtYMin + (yScan-e.YMin)*e.InvSlope
					intersections = append(intersections, x)
				}
			}

			if len(intersections) < 2 {
				continue
			}

			sort.Float64s(intersections)

			// Even-odd filling
			for i := 0; i+1 < len(intersections); i += 2 {
				xStart := int(math.Round(intersections[i]))
				xEnd := int(math.Round(intersections[i+1]))

				if xStart < 0 {
					xStart = 0
				}
				if xEnd > width {
					xEnd = width
				}

				rowOffset := (y - bounds.Min.Y) * img.Stride
				for x := xStart; x < xEnd; x++ {
					pxOffset := rowOffset + (x-bounds.Min.X)*4
					img.Pix[pxOffset+0] = fillColor.R
					img.Pix[pxOffset+1] = fillColor.G
					img.Pix[pxOffset+2] = fillColor.B
					img.Pix[pxOffset+3] = fillColor.A
				}
			}
		}
	}
}

// Draw a line with anti-aliasing / thickness
func drawLine(img *image.RGBA, x0, y0, x1, y1 float64, col color.RGBA, thickness float64) {
	bounds := img.Bounds()
	dx := x1 - x0
	dy := y1 - y0
	length := math.Hypot(dx, dy)
	if length == 0 {
		return
	}

	steps := int(math.Ceil(length * 2.0))
	xStep := dx / float64(steps)
	yStep := dy / float64(steps)

	rad := int(math.Ceil(thickness / 2.0))

	curX, curY := x0, y0
	for s := 0; s <= steps; s++ {
		ix := int(math.Round(curX))
		iy := int(math.Round(curY))

		for oy := -rad; oy <= rad; oy++ {
			py := iy + oy
			if py < bounds.Min.Y || py >= bounds.Max.Y {
				continue
			}
			for ox := -rad; ox <= rad; ox++ {
				px := ix + ox
				if px < bounds.Min.X || px >= bounds.Max.X {
					continue
				}
				offset := (py-bounds.Min.Y)*img.Stride + (px-bounds.Min.X)*4
				// Alpha blend
				img.Pix[offset+0] = col.R
				img.Pix[offset+1] = col.G
				img.Pix[offset+2] = col.B
				img.Pix[offset+3] = col.A
			}
		}
		curX += xStep
		curY += yStep
	}
}

func drawLineStrings(img *image.RGBA, lines [][]Point2D, col color.RGBA, thickness float64) {
	for _, line := range lines {
		for i := 0; i+1 < len(line); i++ {
			p1 := line[i]
			p2 := line[i+1]
			// Avoid antimeridian wrap spikes
			if math.Abs(p1.X-p2.X) > float64(img.Bounds().Dx())*0.5 {
				continue
			}
			drawLine(img, p1.X, p1.Y, p2.X, p2.Y, col, thickness)
		}
	}
}

func blendNightCityLights(nightImg *image.RGBA, lightsPath string) error {
	f, err := os.Open(lightsPath)
	if err != nil {
		return err
	}
	defer f.Close()

	src, _, err := image.Decode(f)
	if err != nil {
		return fmt.Errorf("failed to decode night lights: %w", err)
	}

	bounds := nightImg.Bounds()
	srcBounds := src.Bounds()

	// Scale and blend night lights onto dark land
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		srcY := int(float64(y-bounds.Min.Y) / float64(bounds.Dy()) * float64(srcBounds.Dy()))
		rowOffset := (y - bounds.Min.Y) * nightImg.Stride

		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			srcX := int(float64(x-bounds.Min.X) / float64(bounds.Dx()) * float64(srcBounds.Dx()))

			r, g, b, _ := src.At(srcX, srcY).RGBA()
			// Convert from 16-bit to 8-bit
			lr := float64(r >> 8)
			lg := float64(g >> 8)
			lb := float64(b >> 8)

			brightness := (lr*0.299 + lg*0.587 + lb*0.114) / 255.0

			if brightness > 0.04 {
				pxOffset := rowOffset + (x-bounds.Min.X)*4
				currR := float64(nightImg.Pix[pxOffset+0])
				currG := float64(nightImg.Pix[pxOffset+1])
				currB := float64(nightImg.Pix[pxOffset+2])

				// Warm amber tint for city illumination
				tintR := lr * 1.3
				tintG := lg * 1.1
				tintB := lb * 0.75

				alpha := math.Min(1.0, brightness*1.8)

				finalR := currR*(1.0-alpha) + tintR*alpha
				finalG := currG*(1.0-alpha) + tintG*alpha
				finalB := currB*(1.0-alpha) + tintB*alpha

				if finalR > 255 {
					finalR = 255
				}
				if finalG > 255 {
					finalG = 255
				}
				if finalB > 255 {
					finalB = 255
				}

				nightImg.Pix[pxOffset+0] = uint8(finalR)
				nightImg.Pix[pxOffset+1] = uint8(finalG)
				nightImg.Pix[pxOffset+2] = uint8(finalB)
			}
		}
	}

	return nil
}

func main() {
	start := time.Now()
	fmt.Printf("Building Google Maps style roadmap textures (%dx%d)...\n", texWidth, texHeight)

	cacheDir := "/tmp/map-data"
	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create cache dir: %v\n", err)
		os.Exit(1)
	}

	// 1. Data URLs
	const baseURL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
	landFile, err := ensureCachedFile(cacheDir, "ne_50m_land.geojson", baseURL+"ne_50m_land.geojson")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	lakesFile, err := ensureCachedFile(cacheDir, "ne_50m_lakes.geojson", baseURL+"ne_50m_lakes.geojson")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	bordersFile, err := ensureCachedFile(cacheDir, "ne_50m_admin_0_boundary_lines_land.geojson", baseURL+"ne_50m_admin_0_boundary_lines_land.geojson")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	coastFile, err := ensureCachedFile(cacheDir, "ne_50m_coastline.geojson", baseURL+"ne_50m_coastline.geojson")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}

	// 2. Load vectors
	fmt.Println("Parsing landmass polygons...")
	landPolys, err := loadPolygons(landFile, texWidth, texHeight)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading land: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Loaded %d land polygons\n", len(landPolys))

	fmt.Println("Parsing lake polygons...")
	lakePolys, err := loadPolygons(lakesFile, texWidth, texHeight)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading lakes: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Loaded %d lake polygons\n", len(lakePolys))

	fmt.Println("Parsing international border lines...")
	borderLines, err := loadLineStrings(bordersFile, texWidth, texHeight)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading borders: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Loaded %d border line segments\n", len(borderLines))

	fmt.Println("Parsing coastline lines...")
	coastLines, err := loadLineStrings(coastFile, texWidth, texHeight)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading coastlines: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Loaded %d coastline line segments\n", len(coastLines))

	// 3. Render Day Texture
	fmt.Println("Rendering Day Roadmap Texture...")
	dayImg := image.NewRGBA(image.Rect(0, 0, texWidth, texHeight))
	// Fill background water
	draw.Draw(dayImg, dayImg.Bounds(), &image.Uniform{C: dayWaterColor}, image.Point{}, draw.Src)
	// Rasterize land
	rasterizePolygons(dayImg, landPolys, dayLandColor)
	// Rasterize lakes
	rasterizePolygons(dayImg, lakePolys, dayWaterColor)
	// Draw coastlines
	drawLineStrings(dayImg, coastLines, dayCoastlineColor, 1.0)
	// Draw borders
	drawLineStrings(dayImg, borderLines, dayBorderColor, 1.2)

	// Save Day Texture
	dayOut := "public/textures/earth-roadmap-day.png"
	fDay, err := os.Create(dayOut)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create %s: %v\n", dayOut, err)
		os.Exit(1)
	}
	if err := png.Encode(fDay, dayImg); err != nil {
		fDay.Close()
		fmt.Fprintf(os.Stderr, "Failed to encode day png: %v\n", err)
		os.Exit(1)
	}
	fDay.Close()
	fmt.Printf("Saved %s\n", dayOut)

	// 4. Render Night Texture
	fmt.Println("Rendering Night Roadmap Texture...")
	nightImg := image.NewRGBA(image.Rect(0, 0, texWidth, texHeight))
	// Fill background water
	draw.Draw(nightImg, nightImg.Bounds(), &image.Uniform{C: nightWaterColor}, image.Point{}, draw.Src)
	// Rasterize land
	rasterizePolygons(nightImg, landPolys, nightLandColor)
	// Rasterize lakes
	rasterizePolygons(nightImg, lakePolys, nightWaterColor)
	// Draw coastlines
	drawLineStrings(nightImg, coastLines, nightCoastlineColor, 1.0)
	// Draw borders
	drawLineStrings(nightImg, borderLines, nightBorderColor, 1.2)

	// Blend night city lights if exists
	existingNight := "public/textures/earth-night.png"
	if _, err := os.Stat(existingNight); err == nil {
		fmt.Println("Blending city lights into dark roadmap...")
		if err := blendNightCityLights(nightImg, existingNight); err != nil {
			fmt.Printf("Warning: failed to blend night lights: %v\n", err)
		}
	}

	// Save Night Texture
	nightOut := "public/textures/earth-roadmap-night.png"
	fNight, err := os.Create(nightOut)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create %s: %v\n", nightOut, err)
		os.Exit(1)
	}
	if err := png.Encode(fNight, nightImg); err != nil {
		fNight.Close()
		fmt.Fprintf(os.Stderr, "Failed to encode night png: %v\n", err)
		os.Exit(1)
	}
	fNight.Close()
	fmt.Printf("Saved %s\n", nightOut)

	fmt.Printf("Successfully generated Google Maps roadmap textures in %v!\n", time.Since(start))
}
