# SkyHawk Auto-Measurement Feature Plan

## Overview
Add automatic roof detection and measurement using the **Google Solar API** (LIDAR-based, ~10cm resolution). The system detects building outlines, roof segments (facets), pitch, and edges (ridge/hip/valley/eave/rake) automatically, then feeds results into the existing manual editing system for user refinement.

Also fix: manual drawing mode bug (clicking vertices to create edge lines not working).

## Prerequisites
- User enables **Solar API** in Google Cloud Console (same project/key as Maps API) -- DONE
- Install `geotiff` npm package for parsing LIDAR data layers
- User provides **Anthropic API key** (Claude) for AI Vision fallback (areas without Solar coverage)

---

## Architecture: Auto-Measurement Pipeline

```
User clicks "Auto Detect Roof"
  --> Google Solar API: buildingInsights(lat, lng)
      --> Roof segments (pitch, azimuth, area, center, height)
  --> Google Solar API: dataLayers(lat, lng, radius)
      --> Mask GeoTIFF URL (binary: which pixels are rooftop)
  --> Fetch + parse mask GeoTIFF with geotiff.js
  --> Connected component labeling (find target building)
  --> Moore boundary tracing (extract outline contour)
  --> Douglas-Peucker simplification (clean polygon, 8-30 vertices)
  --> Pixel-to-LatLng conversion (GeoTIFF affine transform)
  --> Roof type classification (flat/shed/gable/hip/complex)
  --> Geometric reconstruction (place ridge, hip, valley edges)
  --> Convert to SkyHawk data model (RoofVertex/RoofEdge/RoofFacet)
  --> User can edit everything with existing manual tools
```

---

## New Files to Create

### 1. `src/types/solar.ts` - Solar API types
- `SolarBuildingInsights` - buildingInsights response
- `SolarRoofSegment` - per-segment data (pitchDegrees, azimuthDegrees, areaMeters2, center, boundingBox, planeHeight)
- `SolarDataLayers` - dataLayers response (URLs to GeoTIFF files)
- `ParsedMask` - parsed GeoTIFF data (binary array + affine transform)
- `RoofType` - 'flat' | 'shed' | 'gable' | 'hip' | 'cross-gable' | 'complex'
- `ReconstructedRoof` - output type (vertices, typed edges, facets with pitch)
- `AutoMeasureStatus` - 'idle' | 'detecting' | 'downloading' | 'processing' | 'reconstructing' | 'complete' | 'error'

### 2. `src/services/solarApi.ts` - API client
- `fetchBuildingInsights(lat, lng, apiKey)` - calls Solar API buildingInsights endpoint
- `fetchDataLayers(lat, lng, radiusMeters, apiKey)` - calls Solar API dataLayers endpoint
- `fetchGeoTiff(url, apiKey)` - downloads GeoTIFF as ArrayBuffer
- `SolarApiError` class for typed error handling
- Fallback quality: try HIGH, then MEDIUM if unavailable

### 3. `src/utils/contour.ts` - Image processing algorithms
- `parseMaskGeoTiff(buffer)` - parse GeoTIFF with `geotiff` lib, extract binary mask + affine transform
- `labelConnectedComponents(mask, w, h)` - two-pass CCL with union-find to find distinct buildings
- `findTargetComponent(labels, w, h, targetPixel)` - pick the component closest to our building center
- `mooreBoundaryTrace(mask, w, h)` - trace outer boundary of a binary blob (clockwise contour)
- `douglasPeucker(points, epsilon)` - simplify contour to clean polygon (epsilon ~2 pixels)
- `pixelToLatLng(pixel, affine)` / `latLngToPixel(latLng, affine)` - coordinate conversion

### 4. `src/utils/roofReconstruction.ts` - Roof geometry reconstruction
- `classifyRoofType(segments)` - determine roof type from segment count + azimuths
- `reconstructGableRoof(outline, segments)` - 2-segment: compute ridge line, split into 2 facets, classify eave/rake edges
- `reconstructHipRoof(outline, segments)` - 4-segment: compute ridge + 4 hip lines, 4 facets
- `reconstructSimpleRoof(outline, segments)` - flat/shed: single facet with outline as eaves
- `reconstructComplexRoof(outline, segments)` - 5+ segments: decompose into sections, reconstruct each
- Helper: `findLinePolygonIntersections()` - where ridge line meets building outline
- Helper: `assignCornersToRidgeEnds()` - which outline corners connect to which ridge endpoint
- Helper: `splitOutlineAtPoints()` - partition outline vertices into facets

### 5. `src/hooks/useAutoMeasure.ts` - React hook orchestrating the pipeline
- Manages loading/progress/error state
- Calls Solar API -> parses GeoTIFF -> runs detection -> applies to store
- Progress tracking: 10% (insights) -> 40% (data layers) -> 65% (parse) -> 80% (outline) -> 95% (reconstruct) -> 100%

### 6. `src/components/measurement/AutoMeasureButton.tsx` - UI component
- Prominent button at top of ToolsPanel: "Auto Detect Roof" with lightning icon
- Shows progress bar + status text during detection
- Error display with retry
- Disabled when no active property

---

## Files to Modify

### `src/store/useStore.ts`
- Add `applyAutoMeasurement(vertices, edges, facets)` batch action
  - Creates measurement, adds all vertices/edges/facets in one state update
  - Calls `recalculateMeasurements()` once at the end
  - Sets drawingMode to 'select' for user refinement
- Reuses existing: `createEmptyMeasurement()`, `calculateEdgeLengthFt()`, `calculatePolygonAreaSqFt()`, `adjustAreaForPitch()`

### `src/utils/geometry.ts`
- Add `localFtToLatLng(x, y, ref)` - reverse of existing `latLngToLocalFt()`
- Add `bearing(a, b)` - azimuth between two points in degrees
- Add `findLinePolygonIntersections(point, bearingRad, polygon)` - line-polygon intersection

### `src/components/measurement/ToolsPanel.tsx`
- Add AutoMeasureButton component above the manual drawing tools section
- Add visual separator between auto and manual tools

### `src/components/map/MapView.tsx`
- Add auto-measure progress overlay (positioned over the map during detection)

---

## Key Algorithms

### Building Outline Extraction
1. Parse mask GeoTIFF -> binary 2D array (0=ground, 1=roof) at 10cm/pixel
2. Connected component labeling (union-find) -> find all building blobs
3. Select blob nearest to property lat/lng
4. Moore boundary trace -> ordered pixel contour (hundreds of points)
5. Douglas-Peucker simplification (epsilon=2px ~ 20cm) -> clean polygon (8-30 vertices)
6. Convert pixels to lat/lng using GeoTIFF affine transform metadata

### Roof Type Classification
- 0 segments or all flat pitch -> FLAT
- 1 segment with pitch -> SHED
- 2 segments with opposing azimuths (~180 deg apart) -> GABLE
- 4 segments with ~90 deg spacing -> HIP
- 2 pairs of opposing azimuths -> CROSS-GABLE
- Other -> COMPLEX (fallback: outline + facets, user refines edges)

### Gable Reconstruction
1. Ridge direction = perpendicular to segment azimuth
2. Ridge position = midpoint between the two segment centers
3. Ridge endpoints = where ridge line intersects building outline
4. Split outline vertices into 2 facets at ridge endpoints
5. Edges touching ridge endpoints = RAKE, others = EAVE
6. Pitch from Solar API segment data (LIDAR-accurate)

### Hip Reconstruction
1. Sort segments by area: 2 main (large) + 2 end (small, triangular)
2. Ridge direction = along building's longer axis
3. Ridge length = building length - building width (standard hip geometry)
4. Ridge endpoints = interior points (not on outline)
5. Hip lines = ridge endpoints to nearest outline corners
6. 4 facets bounded by eave + hip + ridge edges

---

## Manual Drawing Bug Fix
The MapView edge drawing handler needs investigation. The issue is likely:
- Click handler on vertex markers not properly detecting edge-drawing modes
- Or `edgeStartVertexId` not being set/read correctly in the click flow
Will diagnose and fix in MapView.tsx during implementation.

---

## AI Vision Fallback (when Solar API has no coverage)

For areas where Google Solar API returns no data (rural, new construction, non-US):

### Pipeline
```
Solar API returns 404/no data
  --> Capture satellite image via Google Maps Static API (zoom 20, 640x640px)
  --> Send image to Claude API (claude-sonnet-4-5-20250929) with structured prompt
  --> Prompt asks AI to identify:
      - Building outline as pixel coordinates [x,y] list
      - Roof type (gable/hip/flat/etc.)
      - Estimated ridge line position
      - Number of roof facets
  --> Convert pixel coords to lat/lng using known image bounds
  --> Apply same reconstruction pipeline (classify type -> place edges -> create facets)
  --> Use default pitch estimates (6/12 for gable, 4/12 for hip) since no LIDAR data
  --> Present with "AI Estimated" badge - user should verify/adjust
```

### New files for fallback
- `src/services/visionApi.ts` - Claude API client for image analysis
  - `analyzeRoofImage(imageBase64, imageBounds)` - send satellite image, get polygon coords
  - Structured JSON output schema for reliable parsing
- Add `VITE_ANTHROPIC_API_KEY` to `.env`

### Accuracy notes
- AI Vision gives ~1-2m accuracy on vertex placement (vs ~10cm for Solar API LIDAR)
- Pitch is estimated (not measured) - user should adjust with slider
- Good enough for initial measurement, user refines manually
- "AI Estimated - verify measurements" badge shown in UI

---

## Error Handling
- Solar API not enabled -> "Please enable the Solar API in Google Cloud Console"
- No Solar data for location -> **Automatically try AI Vision fallback**
- AI Vision also fails -> "Could not detect roof. Use manual tools."
- GeoTIFF CORS blocked -> Fall back to Vite dev proxy or segment-only reconstruction
- Complex roof -> Show partial results with "Medium confidence" badge, user refines manually
- API error -> Show error with retry button

## CORS Strategy for GeoTIFF
1. Try direct fetch with API key (usually works)
2. If blocked: add Vite proxy in vite.config.ts (`/solar-proxy` -> `https://solar.googleapis.com`)
3. Absolute fallback: skip mask, reconstruct from segment bounding boxes only

---

## Verification Plan
1. `npm install geotiff` - add dependency
2. `npx tsc -b --noEmit` - verify TypeScript compiles
3. `npm run test` - existing tests still pass
4. Manual test: search for a known US residential address
5. Click "Auto Detect Roof" -> verify outline appears on map
6. Verify edges are colored correctly (ridge=red, hip=purple, eave=cyan, rake=green)
7. Verify pitch values match realistic roof pitches (4-12/12 typical)
8. Switch to Select mode -> verify vertices are draggable
9. Verify MeasurementsPanel shows correct totals
10. Test edge case: address with no Solar API coverage -> graceful error
11. Test manual drawing tools still work (fix the vertex clicking bug)
