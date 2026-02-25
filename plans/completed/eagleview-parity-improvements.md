# Plan: SkyHawk Report — Close the Gap with EagleView

## Competitive Analysis

### What EagleView "Bid Perfect" Delivers (3 pages, $15-25)
1. **Page 1 — Hero wireframe overlay**: Clean yellow wireframe on high-res satellite imagery with numbered facets, summary table below (Area, Pitch, # Facets, Waste Factor), "Certified Accurate" badge
2. **Page 2 — Close-up aerial photo**: High-res oblique (angled) imagery showing actual shingle texture and roof details
3. **Page 3 — 4-direction oblique views**: North/South/East/West angled photos showing all sides of the structure

### What EagleView "Premium" Adds ($30-60, their upsell from Bid Perfect)
- 3D Roof Diagrams (isometric view)
- Length Diagram (edge-by-edge measurements labeled on wireframe)
- Area Diagram (facet areas labeled on wireframe)
- Pitch Diagram (pitch per facet labeled on wireframe)
- Notes Diagram (annotations)
- Square Footage Pitch Table
- Waste Calculation Table
- Report Summary page

### What SkyHawk Currently Delivers (4 pages, free)
1. **Page 1**: Property info, measurement summary, line measurements (text only, no imagery)
2. **Page 2**: Facet details table, waste factor table
3. **Page 3**: Material estimates, solar potential analysis
4. **Page 4**: Solar per-facet analysis, monthly production chart

### Gap Analysis

| Feature | EagleView Bid Perfect | EagleView Premium | SkyHawk Current | Gap |
|---------|----------------------|-------------------|-----------------|-----|
| Wireframe overlay image | Page 1 hero | Yes | Missing | **HIGH** |
| Numbered facets on image | Yes (clean yellow) | Yes | In-app only | **HIGH** |
| Oblique/angled imagery | Pages 2-3 (4 angles) | Yes | None | MEDIUM |
| Length diagram | No | Yes | None | MEDIUM |
| Area diagram | No | Yes | None | MEDIUM |
| Pitch diagram | No | Yes | None | MEDIUM |
| 3D isometric view | No | Yes | None | LOW (hard) |
| Summary table | Basic | Detailed | Detailed | OK |
| Facet-level detail table | No | Yes (pitch table) | Yes | AHEAD |
| Waste factor table | No | Yes | Yes | AHEAD |
| Material estimates | No | No | Yes | **AHEAD** |
| Solar analysis | No | No | Yes (4 sections) | **FAR AHEAD** |
| Damage assessment | No | No | Yes | **FAR AHEAD** |
| Claims tracking | No | No | Yes | **FAR AHEAD** |
| Certified/Guarantee badge | Yes | Yes | None | MEDIUM |
| Individual edge measurements | No | Yes (length diagram) | In-app only | MEDIUM |
| Per-facet pitch on diagram | No | Yes | In table only | MEDIUM |

### Key Takeaway
SkyHawk already **exceeds** EagleView Premium in data richness (materials, solar, damage, claims). What we lack is the **visual presentation** — the wireframe overlay imagery that makes the report immediately understandable at a glance. A contractor should be able to look at page 1 and instantly understand the roof geometry.

---

## Implementation Plan (5 Phases)

### Phase 1: Wireframe Overlay Screenshot in PDF (HIGH IMPACT)
**Goal**: Capture the map's "Report View" as an image and embed it as the hero image on page 1

**Problem**: We already have a `mapScreenshot` option in `ReportOptions` but it's never populated. We need to capture the map canvas with wireframe overlay.

**Files to modify:**
- `src/components/panels/ReportPanel.tsx` — Before generating PDF, capture map screenshot using `html2canvas`
- `src/utils/reportGenerator.ts` — Already supports `mapScreenshot` option, just needs to be populated
- `package.json` — Add `html2canvas` dependency (if not already present)

**Steps:**
1. Install `html2canvas` if not present
2. In the report export flow, before calling `generateReport()`:
   a. Temporarily switch to Report View (`showVertexMarkers = false`)
   b. Wait for re-render (requestAnimationFrame)
   c. Capture the map container div with `html2canvas`
   d. Pass the base64 data URL as `mapScreenshot`
   e. Restore previous view state
3. The existing `AERIAL VIEW` section in reportGenerator.ts already handles embedding the image — just ensure it renders on page 1 (before the summary tables, not after)

**Result**: Page 1 will show the clean yellow wireframe on satellite imagery, just like EagleView's hero page.

### Phase 2: Labeled Wireframe Diagrams (MEDIUM IMPACT)
**Goal**: Generate additional annotated diagram pages showing lengths, areas, and pitches on the wireframe — matching EagleView Premium's diagram pages

**New file:** `src/utils/diagramRenderer.ts`

**Approach**: Rather than capturing the Google Maps view multiple times, render SVG diagrams programmatically:

1. **Length Diagram**:
   - Project all vertices to a 2D local coordinate system (reuse `latLngToLocalFt`)
   - Draw edges as colored lines (by type)
   - Label each edge with its length in feet at the midpoint
   - Render to a canvas, export as PNG, embed in PDF

2. **Area Diagram**:
   - Same projection
   - Draw facet polygons with light fill colors
   - Label each facet centroid with `#N — XXXX sf`

3. **Pitch Diagram**:
   - Same projection
   - Color-code facets by pitch (gradient from green=low to red=steep)
   - Label each facet centroid with pitch (e.g., "7/12")

**Implementation**: Use an offscreen `<canvas>` element to render these diagrams:
- Transform lat/lng vertices to pixel coordinates on a fixed canvas size (800x600)
- Draw edges with proper colors and labels
- Export via `canvas.toDataURL('image/png')`
- Embed in PDF as new pages

**Files:**
- `src/utils/diagramRenderer.ts` (NEW) — Functions: `renderLengthDiagram()`, `renderAreaDiagram()`, `renderPitchDiagram()`
- `src/utils/reportGenerator.ts` (EDIT) — Add new pages after the wireframe overlay for each diagram type
- `src/components/panels/ReportPanel.tsx` (EDIT) — Add checkboxes for which diagrams to include

### Phase 3: Multi-Angle Oblique Imagery (MEDIUM IMPACT)
**Goal**: Include 4-direction oblique views like EagleView's pages 2-3

**Approach**: Google Maps Static API supports `heading` and `pitch` parameters for Street View, but for satellite views we can use:

1. **Option A — Google Maps Static with tilt** (preferred):
   - Use Google Maps Static API at zoom 20 with 4 different headings (0, 90, 180, 270)
   - `maptype=satellite` with appropriate center offset for each direction
   - This gives top-down views from 4 directions

2. **Option B — Google Street View Static API**:
   - Use nearby Street View imagery if available
   - Provides actual angled perspective views
   - May not be available for all properties

3. **Option C — Map canvas rotation** (fallback):
   - Capture 4 screenshots of the Google Maps view rotated to 0, 90, 180, 270 degrees
   - Google Maps JS API supports `heading` property on the map

**Files:**
- `src/services/imageryApi.ts` (NEW) — `captureObliqueViews(lat, lng, apiKey)` → returns 4 base64 images labeled N/S/E/W
- `src/utils/reportGenerator.ts` (EDIT) — Add "OBLIQUE VIEWS" page with 2x2 grid of images
- `src/components/panels/ReportPanel.tsx` (EDIT) — Add "Include oblique views" checkbox

### Phase 4: Report Polish & Branding (LOW-MEDIUM IMPACT)
**Goal**: Match the professional polish of EagleView's layout

**Changes to `src/utils/reportGenerator.ts`:**

1. **Confidence/Accuracy Badge**: Add a "SkyHawk Verified" badge or accuracy indicator:
   - Show detection confidence level (high/medium/low)
   - Show measurement source (Solar API + AI, AI-only, Manual)
   - Display as a badge graphic near the summary table

2. **Page Layout Reorder for Impact**:
   - Page 1: Header + wireframe hero image + summary table (compact) — this is the "money page"
   - Page 2: Facet details + waste table
   - Page 3: Length/Area/Pitch diagrams
   - Page 4: Material estimates
   - Page 5: Solar analysis (if enabled)
   - Page 6+: Damage/Claims (if data exists)

3. **Header Improvements**:
   - Add SkyHawk logo (embed as base64 PNG) instead of just text
   - Add report ID/reference number for tracking
   - Cleaner typography hierarchy

4. **Facet Details Enhancement**:
   - Add a column for "Squares" per facet (trueAreaSqFt / 100)
   - Add a totals row at the bottom
   - Add per-facet waste percentage (based on complexity — more hips/valleys = higher waste)

5. **Footer Enhancement**:
   - Add "Measurements powered by Google Solar API + AI Vision" attribution
   - Add disclaimer text similar to EagleView's
   - Add QR code linking to the live SkyHawk property view (future)

### Phase 5: Interactive Map Export (LOW IMPACT, HIGH DIFFERENTIATION)
**Goal**: Something EagleView doesn't offer — an interactive companion to the PDF

**Concept**: Generate a self-contained HTML file alongside the PDF that includes:
- An interactive Google Maps view with the wireframe overlay
- Click on facets to see details
- Toggle between different diagram views
- Shareable via URL or as a standalone file

**This is future/stretch — only plan if Phases 1-4 are complete.**

---

## Priority & Effort Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Phase 1: Wireframe Screenshot | HIGH | LOW (2-3 hrs) | **DO FIRST** |
| Phase 2: Labeled Diagrams | MEDIUM-HIGH | MEDIUM (4-6 hrs) | **DO SECOND** |
| Phase 3: Oblique Imagery | MEDIUM | MEDIUM (3-4 hrs) | **DO THIRD** |
| Phase 4: Report Polish | MEDIUM | LOW (2-3 hrs) | **DO FOURTH** |
| Phase 5: Interactive Export | LOW | HIGH (8+ hrs) | STRETCH |

## File Summary

| File | Action | Phase | Description |
|------|--------|-------|-------------|
| `src/components/panels/ReportPanel.tsx` | EDIT | 1,2,3 | Screenshot capture, diagram options |
| `src/utils/reportGenerator.ts` | EDIT | 1,2,3,4 | Hero image, new pages, layout reorder |
| `src/utils/diagramRenderer.ts` | NEW | 2 | Programmatic wireframe diagrams |
| `src/services/imageryApi.ts` | NEW | 3 | Oblique view image capture |
| `package.json` | EDIT | 1 | Add html2canvas if needed |

## Accuracy Comparison (701 Kingston Dr)

| Metric | EagleView | SkyHawk | Delta |
|--------|-----------|---------|-------|
| Total Area | 63.2 squares | 93.7 squares | +48% |
| Pitch | 7/12 (100%) | 7/12 predominant | Match |
| # Facets | 13 | 11 | -2 |
| Waste Factor | 9% | 20% | +11pp |

**Note on accuracy**: Our total area (9,373 sf / 93.7 sq) is significantly higher than EagleView's (63.2 sq / ~6,320 sf). This could mean:
1. Our AI is detecting too large a roof footprint (including garage, porch, etc. that EagleView excludes)
2. Our pitch adjustments are inflating area (facets #5 and #6 have 17/12 pitch which seems very steep — 55 degrees — and nearly doubles their projected area)
3. EagleView may be measuring only the main structure while we include detached structures

**Recommendation**: Investigate the area discrepancy separately. The 17/12 pitch facets (#5, #6) are suspicious — residential roofs rarely exceed 12/12. This may be a Solar API segment matching bug where steep segments are incorrectly assigned.

## Verification Criteria
1. Page 1 of PDF shows satellite imagery with clean yellow wireframe overlay and numbered facets
2. At least 2 diagram pages (length + area) are included when selected
3. Oblique views page shows 4 directional images (if imagery available)
4. Report looks professional enough to hand to a homeowner or insurance adjuster
5. Total PDF file size stays under 5MB
6. Report generation completes in under 10 seconds
