# SkyHawk Auto-Measurement Feature Plan

## Status: COMPLETE

## Overview
Automatic roof detection and measurement using the **Google Solar API** (LIDAR-based, ~10cm resolution). The system detects building outlines, roof segments (facets), pitch, and edges (ridge/hip/valley/eave/rake) automatically, then feeds results into the existing manual editing system for user refinement.

Full pipeline implemented: Solar API → GeoTIFF → Contour Detection → Roof Reconstruction → Store Integration, with Claude Vision AI fallback for areas without Solar API coverage.

## Prerequisites - ALL COMPLETE
- User enables **Solar API** in Google Cloud Console (same project/key as Maps API) - DONE
- Install `geotiff` npm package for parsing LIDAR data layers - DONE
- User provides **Anthropic API key** (Claude) for AI Vision fallback (areas without Solar coverage) - DONE

---

## Architecture: Auto-Measurement Pipeline - FULLY IMPLEMENTED

```
User clicks "Auto Detect Roof"
  --> Google Solar API: buildingInsights(lat, lng) - DONE
      --> Roof segments (pitch, azimuth, area, center, height) - DONE
  --> Google Solar API: dataLayers(lat, lng, radius) - DONE
      --> Mask GeoTIFF URL (binary: which pixels are rooftop) - DONE
  --> Fetch + parse mask GeoTIFF with geotiff.js - DONE
  --> Connected component labeling (find target building) - DONE
  --> Moore boundary tracing (extract outline contour) - DONE
  --> Douglas-Peucker simplification (clean polygon, 8-30 vertices) - DONE
  --> Pixel-to-LatLng conversion (GeoTIFF affine transform) - DONE
  --> Roof type classification (flat/shed/gable/hip/complex) - DONE
  --> Geometric reconstruction (place ridge, hip, valley edges) - DONE
  --> Convert to SkyHawk data model (RoofVertex/RoofEdge/RoofFacet) - DONE
  --> User can edit everything with existing manual tools - DONE
```

---

## Implementation - ALL FILES CREATED AND COMPLETE

### 1. `src/types/solar.ts` - Solar API types - DONE
- `SolarBuildingInsights` - buildingInsights response - DONE
- `SolarRoofSegment` - per-segment data (pitchDegrees, azimuthDegrees, areaMeters2, center, boundingBox, planeHeight) - DONE
- `SolarDataLayers` - dataLayers response (URLs to GeoTIFF files) - DONE
- `ParsedMask` - parsed GeoTIFF data (binary array + affine transform) - DONE
- `RoofType` - 'flat' | 'shed' | 'gable' | 'hip' | 'cross-gable' | 'complex' - DONE
- `ReconstructedRoof` - output type (vertices, typed edges, facets with pitch) - DONE
- `AutoMeasureStatus` - 'idle' | 'detecting' | 'downloading' | 'processing' | 'reconstructing' | 'complete' | 'error' - DONE

### 2. `src/services/solarApi.ts` - API client - DONE
- `fetchBuildingInsights(lat, lng, apiKey)` - calls Solar API buildingInsights endpoint - DONE
- `fetchDataLayers(lat, lng, radiusMeters, apiKey)` - calls Solar API dataLayers endpoint - DONE
- `fetchGeoTiff(url, apiKey)` - downloads GeoTIFF as ArrayBuffer - DONE
- `SolarApiError` class for typed error handling - DONE
- Fallback quality: try HIGH, then MEDIUM if unavailable - DONE

### 3. `src/utils/contour.ts` - Image processing algorithms - DONE
- `parseMaskGeoTiff(buffer)` - parse GeoTIFF with `geotiff` lib, extract binary mask + affine transform - DONE
- `labelConnectedComponents(mask, w, h)` - two-pass CCL with union-find to find distinct buildings - DONE
- `findTargetComponent(labels, w, h, targetPixel)` - pick the component closest to our building center - DONE
- `mooreBoundaryTrace(mask, w, h)` - trace outer boundary of a binary blob (clockwise contour) - DONE
- `douglasPeucker(points, epsilon)` - simplify contour to clean polygon (epsilon ~2 pixels) - DONE
- `pixelToLatLng(pixel, affine)` / `latLngToPixel(latLng, affine)` - coordinate conversion - DONE

### 4. `src/utils/roofReconstruction.ts` - Roof geometry reconstruction - DONE
- `classifyRoofType(segments)` - determine roof type from segment count + azimuths - DONE
- `reconstructGableRoof(outline, segments)` - 2-segment: compute ridge line, split into 2 facets, classify eave/rake edges - DONE
- `reconstructHipRoof(outline, segments)` - 4-segment: compute ridge + 4 hip lines, 4 facets - DONE
- `reconstructSimpleRoof(outline, segments)` - flat/shed: single facet with outline as eaves - DONE
- `reconstructComplexRoof(outline, segments)` - 5+ segments: decompose into sections, reconstruct each - DONE
- Helper: `findLinePolygonIntersections()` - where ridge line meets building outline - DONE
- Helper: `assignCornersToRidgeEnds()` - which outline corners connect to which ridge endpoint - DONE
- Helper: `splitOutlineAtPoints()` - partition outline vertices into facets - DONE

### 5. `src/hooks/useAutoMeasure.ts` - React hook orchestrating the pipeline - DONE
- Manages loading/progress/error state - DONE
- Calls Solar API -> parses GeoTIFF -> runs detection -> applies to store - DONE
- Progress tracking: 10% (insights) -> 40% (data layers) -> 65% (parse) -> 80% (outline) -> 95% (reconstruct) -> 100% - DONE

### 6. `src/components/measurement/AutoMeasureButton.tsx` - UI component - DONE
- Prominent button at top of ToolsPanel: "Auto Detect Roof" with lightning icon - DONE
- Shows progress bar + status text during detection - DONE
- Error display with retry - DONE
- Disabled when no active property - DONE

---

## Files Modified - ALL COMPLETE

### `src/store/useStore.ts` - DONE
- Add `applyAutoMeasurement(vertices, edges, facets)` batch action - DONE
  - Creates measurement, adds all vertices/edges/facets in one state update - DONE
  - Calls `recalculateMeasurements()` once at the end - DONE
  - Sets drawingMode to 'select' for user refinement - DONE
- Reuses existing: `createEmptyMeasurement()`, `calculateEdgeLengthFt()`, `calculatePolygonAreaSqFt()`, `adjustAreaForPitch()` - DONE

### `src/utils/geometry.ts` - DONE
- Add `localFtToLatLng(x, y, ref)` - reverse of existing `latLngToLocalFt()` - DONE
- Add `bearing(a, b)` - azimuth between two points in degrees - DONE
- Add `findLinePolygonIntersections(point, bearingRad, polygon)` - line-polygon intersection - DONE

### `src/components/measurement/ToolsPanel.tsx` - DONE
- Add AutoMeasureButton component above the manual drawing tools section - DONE
- Add visual separator between auto and manual tools - DONE

### `src/components/map/MapView.tsx` - DONE
- Add auto-measure progress overlay (positioned over the map during detection) - DONE

---

## Key Algorithms - ALL IMPLEMENTED

### Building Outline Extraction - DONE
1. Parse mask GeoTIFF -> binary 2D array (0=ground, 1=roof) at 10cm/pixel - DONE
2. Connected component labeling (union-find) -> find all building blobs - DONE
3. Select blob nearest to property lat/lng - DONE
4. Moore boundary trace -> ordered pixel contour (hundreds of points) - DONE
5. Douglas-Peucker simplification (epsilon=2px ~ 20cm) -> clean polygon (8-30 vertices) - DONE
6. Convert pixels to lat/lng using GeoTIFF affine transform metadata - DONE

### Roof Type Classification - DONE
- 0 segments or all flat pitch -> FLAT - DONE
- 1 segment with pitch -> SHED - DONE
- 2 segments with opposing azimuths (~180 deg apart) -> GABLE - DONE
- 4 segments with ~90 deg spacing -> HIP - DONE
- 2 pairs of opposing azimuths -> CROSS-GABLE - DONE
- Other -> COMPLEX (fallback: outline + facets, user refines edges) - DONE

### Gable Reconstruction - DONE
1. Ridge direction = perpendicular to segment azimuth - DONE
2. Ridge position = midpoint between the two segment centers - DONE
3. Ridge endpoints = where ridge line intersects building outline - DONE
4. Split outline vertices into 2 facets at ridge endpoints - DONE
5. Edges touching ridge endpoints = RAKE, others = EAVE - DONE
6. Pitch from Solar API segment data (LIDAR-accurate) - DONE

### Hip Reconstruction - DONE
1. Sort segments by area: 2 main (large) + 2 end (small, triangular) - DONE
2. Ridge direction = along building's longer axis - DONE
3. Ridge length = building length - building width (standard hip geometry) - DONE
4. Ridge endpoints = interior points (not on outline) - DONE
5. Hip lines = ridge endpoints to nearest outline corners - DONE
6. 4 facets bounded by eave + hip + ridge edges - DONE

---

## AI Vision Fallback (when Solar API has no coverage) - FULLY IMPLEMENTED

For areas where Google Solar API returns no data (rural, new construction, non-US):

### Pipeline - DONE
```
Solar API returns 404/no data - DONE
  --> Capture satellite image via Google Maps Static API (zoom 20, 640x640px) - DONE
  --> Send image to Claude API (claude-sonnet-4-5-20250929) with structured prompt - DONE
  --> Prompt asks AI to identify: - DONE
      - Building outline as pixel coordinates [x,y] list - DONE
      - Roof type (gable/hip/flat/etc.) - DONE
      - Estimated ridge line position - DONE
      - Number of roof facets - DONE
  --> Convert pixel coords to lat/lng using known image bounds - DONE
  --> Apply same reconstruction pipeline (classify type -> place edges -> create facets) - DONE
  --> Use default pitch estimates (6/12 for gable, 4/12 for hip) since no LIDAR data - DONE
  --> Present with "AI Estimated" badge - user should verify/adjust - DONE
```

### Implementation - DONE
- `src/services/visionApi.ts` - Claude API client for image analysis - DONE
  - `analyzeRoofImage(imageBase64, imageBounds)` - send satellite image, get polygon coords - DONE
  - Structured JSON output schema for reliable parsing - DONE
- Add `VITE_ANTHROPIC_API_KEY` to `.env` - DONE

### Accuracy notes
- AI Vision gives ~1-2m accuracy on vertex placement (vs ~10cm for Solar API LIDAR)
- Pitch is estimated (not measured) - user should adjust with slider
- Good enough for initial measurement, user refines manually
- "AI Estimated - verify measurements" badge shown in UI

---

## Error Handling - FULLY IMPLEMENTED
- Solar API not enabled -> "Please enable the Solar API in Google Cloud Console" - DONE
- No Solar data for location -> **Automatically try AI Vision fallback** - DONE
- AI Vision also fails -> "Could not detect roof. Use manual tools." - DONE
- GeoTIFF CORS blocked -> Fall back to Vite dev proxy or segment-only reconstruction - DONE
- Complex roof -> Show partial results with "Medium confidence" badge, user refines manually - DONE
- API error -> Show error with retry button - DONE

## CORS Strategy for GeoTIFF - IMPLEMENTED
1. Try direct fetch with API key (usually works) - DONE
2. If blocked: add Vite proxy in vite.config.ts (`/solar-proxy` -> `https://solar.googleapis.com`) - DONE
3. Absolute fallback: skip mask, reconstruct from segment bounding boxes only - DONE

---

## Verification - ALL STEPS COMPLETE
1. `npm install geotiff` - add dependency - DONE
2. `npx tsc -b --noEmit` - verify TypeScript compiles - DONE
3. `npm run test` - existing tests still pass - DONE
4. Manual test: search for a known US residential address - DONE
5. Click "Auto Detect Roof" -> verify outline appears on map - DONE
6. Verify edges are colored correctly (ridge=red, hip=purple, eave=cyan, rake=green) - DONE
7. Verify pitch values match realistic roof pitches (4-12/12 typical) - DONE
8. Switch to Select mode -> verify vertices are draggable - DONE
9. Verify MeasurementsPanel shows correct totals - DONE
10. Test edge case: address with no Solar API coverage -> graceful AI Vision fallback - DONE
11. Test manual drawing tools still work - DONE
