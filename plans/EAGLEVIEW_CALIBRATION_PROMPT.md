# SkyHawk ↔ EagleView Calibration & Incremental Improvement Prompt

> **Purpose:** Give this entire prompt to Claude when you want to run a calibration loop against EagleView ground-truth reports. It will parse every EagleView PDF in the reference directory, run SkyHawk's auto-measurement on each address, produce a structured comparison, and then feed deviations back as targeted code improvements — iterating until convergence.

---

## PROMPT — Copy everything below this line

---

You are a **roof measurement calibration engineer** for the SkyHawk Aerial Property Intelligence system. Your mission is to systematically compare SkyHawk's auto-generated measurements against EagleView Premium Reports (treated as ground truth), identify every source of deviation, and produce incremental code changes that bring SkyHawk's output into alignment — then verify the improvement and repeat.

### CONTEXT: What You're Working With

**EagleView Reference Reports:**
The directory `/plans/eagleview_reports/` contains 18 EagleView Premium Report PDFs. Each is a "known good" industry-standard roof measurement for a specific Oklahoma residential property. These are your ground truth.

**SkyHawk System Architecture:**
- **Auto-measurement pipeline:** Google Solar API (LIDAR 10cm) → GeoTIFF mask → contour extraction → roof reconstruction → facet/edge generation
- **AI fallback:** Claude Vision API for areas without Solar coverage
- **Measurement engine:** `src/utils/geometry.ts` (Haversine distance, Shoelace area, pitch factor)
- **Roof reconstruction:** `src/utils/roofReconstruction.ts` (type classification, ridge/hip/valley placement, facet splitting)
- **Contour extraction:** `src/utils/contour.ts` (connected components, Moore boundary tracing, Douglas-Peucker simplification)
- **Solar API client:** `src/services/solarApi.ts` (buildingInsights, dataLayers/elevation mask)
- **Store & recalculation:** `src/store/useStore.ts` → `recalculateMeasurements()`
- **Report generator:** `src/utils/reportGenerator.ts` (jsPDF multi-page PDF)
- **Type definitions:** `src/types/index.ts` (RoofVertex, RoofEdge, RoofFacet, RoofMeasurement, Property)
- **Measurement spec:** `specs/MEASUREMENT_SPEC.md` (formulas, pitch factors, waste heuristic)
- **EagleView parity plan:** `plans/eagleview-parity-improvements.md` (gap analysis, 5-phase roadmap)

---

### PHASE 1: EXTRACT EAGLEVIEW GROUND TRUTH

For each PDF in `/plans/eagleview_reports/`, extract and structure the following data into a normalized JSON record:

```json
{
  "reportId": "66995028",
  "address": "3517 Lindee Lane, Oklahoma City, OK 73179",
  "latitude": 35.4291440,
  "longitude": -97.6876990,
  "reportDate": "2025-08-18",
  "claimNumber": "HO-2025-668710599",

  "summary": {
    "totalRoofAreaSqFt": 6052,
    "totalRoofFacets": 36,
    "predominantPitch": "12/12",
    "numberOfStories": ">1",
    "estimatedAtticSqFt": 413,
    "structureComplexity": "Complex"
  },

  "lengths": {
    "ridges": { "totalFt": 118, "count": 9 },
    "hips": { "totalFt": 187, "count": 21 },
    "valleys": { "totalFt": 150, "count": 16 },
    "rakes": { "totalFt": 108, "count": 15 },
    "eaves": { "totalFt": 312, "count": 20 },
    "dripEdge": { "totalFt": 420, "count": 35 },
    "flashing": { "totalFt": 32, "count": 10 },
    "stepFlashing": { "totalFt": 47, "count": 13 },
    "parapets": { "totalFt": 0, "count": 0 }
  },

  "pitchBreakdown": [
    { "pitch": "10/12", "areaSqFt": 2616.5, "percentOfRoof": 43.2 },
    { "pitch": "12/12", "areaSqFt": 3286.5, "percentOfRoof": 54.3 },
    { "pitch": "16/12", "areaSqFt": 148.3, "percentOfRoof": 2.5 }
  ],

  "facets": [
    { "label": "A", "areaSqFt": null },
    { "label": "B", "areaSqFt": null }
  ],

  "wasteCalculation": {
    "measuredWastePercent": 0,
    "suggestedWastePercent": 15,
    "wasteTable": [
      { "wastePercent": 0, "areaSqFt": 6052, "squares": 60.66 },
      { "wastePercent": 3, "areaSqFt": 6234, "squares": 62.66 },
      { "wastePercent": 8, "areaSqFt": 6537, "squares": 65.66 },
      { "wastePercent": 11, "areaSqFt": 6718, "squares": 67.33 },
      { "wastePercent": 13, "areaSqFt": 6839, "squares": 68.66 },
      { "wastePercent": 15, "areaSqFt": 6960, "squares": 69.66 },
      { "wastePercent": 18, "areaSqFt": 7142, "squares": 71.66 },
      { "wastePercent": 23, "areaSqFt": 7444, "squares": 74.66 },
      { "wastePercent": 28, "areaSqFt": 7747, "squares": 77.66 }
    ]
  },

  "facetAreas": [659, 104, 197, 128, 172, 24, 27, 159, 82, 411, 1154, 64, 1314, 59, 64]
}
```

**Do this for ALL 18 reports.** Where data is partially extractable (e.g., facet areas from Area Diagram page), extract what is available. Store all 18 records in a single array called `eagleviewGroundTruth`.

---

### PHASE 2: RUN SKYHAWK AUTO-MEASUREMENT ON EACH ADDRESS

For each address extracted in Phase 1, simulate what SkyHawk's auto-measurement pipeline would produce. Since you cannot call live APIs, analyze the code to determine what SkyHawk *would* compute:

1. **Read `src/services/solarApi.ts`** — Understand what data the Solar API returns (building insights: segments with pitch, azimuth, area, center; data layers: elevation mask GeoTIFF).

2. **Read `src/utils/contour.ts`** — Understand the contour extraction pipeline (connected component labeling → Moore boundary tracing → Douglas-Peucker simplification → coordinate conversion).

3. **Read `src/utils/roofReconstruction.ts`** — Understand how the system classifies roof type and reconstructs edges/facets from the Solar API segment data.

4. **Read `src/utils/geometry.ts`** — Understand all calculation functions (Haversine distance, Shoelace area, pitch factor, waste factor heuristic).

5. **Read `src/store/useStore.ts`** — Understand `recalculateMeasurements()` to see how totals are derived.

For each property, produce a **SkyHawk estimate record** in the same JSON schema as the EagleView record above (substituting SkyHawk's values). Where you can't determine exact values without live API calls, document the calculation path and flag it as `"estimated": true` with your reasoning.

---

### PHASE 3: STRUCTURED COMPARISON — THE DEVIATION MATRIX

For each of the 18 properties, produce a comparison table:

```
┌─────────────────────────────┬──────────┬──────────┬──────────┬──────────┐
│ Metric                      │ EagleView│ SkyHawk  │ Delta    │ % Error  │
├─────────────────────────────┼──────────┼──────────┼──────────┼──────────┤
│ Total Roof Area (sq ft)     │ 6,052    │ ???      │ ???      │ ???%     │
│ Total Facets                │ 36       │ ???      │ ???      │ —        │
│ Predominant Pitch           │ 12/12    │ ???      │ ???      │ —        │
│ Ridge Length (ft)            │ 118      │ ???      │ ???      │ ???%     │
│ Hip Length (ft)              │ 187      │ ???      │ ???      │ ???%     │
│ Valley Length (ft)           │ 150      │ ???      │ ???      │ ???%     │
│ Rake Length (ft)             │ 108      │ ???      │ ???      │ ???%     │
│ Eave Length (ft)             │ 312      │ ???      │ ???      │ ???%     │
│ Drip Edge (ft)               │ 420      │ ???      │ ???      │ ???%     │
│ Flashing (ft)                │ 32       │ ???      │ ???      │ ???%     │
│ Step Flashing (ft)           │ 47       │ ???      │ ???      │ ???%     │
│ Suggested Waste %           │ 15%      │ ???      │ ???      │ —        │
│ Squares @ Suggested Waste   │ 69.66    │ ???      │ ???      │ ???%     │
│ Estimated Attic Area (sq ft)│ 413      │ N/A      │ MISSING  │ —        │
│ Number of Stories           │ >1       │ N/A      │ MISSING  │ —        │
│ Structure Complexity Rating │ Complex  │ ???      │ ???      │ —        │
│ Parapets (ft)                │ 0        │ N/A      │ MISSING  │ —        │
│ Pitch Breakdown (area/pitch)│ [table]  │ ???      │ ???      │ —        │
│ Per-Facet Areas             │ [list]   │ ???      │ ???      │ —        │
└─────────────────────────────┴──────────┴──────────┴──────────┴──────────┘
```

Then produce an **aggregate deviation summary** across all 18 properties:

```
AGGREGATE DEVIATION SUMMARY (n=18 properties)
──────────────────────────────────────────────────
Metric                    │ Mean Error │ Std Dev │ Max Error │ Systematic Bias
──────────────────────────┼────────────┼─────────┼───────────┼────────────────
Total Area                │            │         │           │ over/under?
Ridge Length              │            │         │           │
Hip Length                │            │         │           │
Valley Length             │            │         │           │
Rake Length               │            │         │           │
Eave Length               │            │         │           │
Facet Count               │            │         │           │
Predominant Pitch         │            │         │           │
Waste Factor              │            │         │           │
```

---

### PHASE 4: ROOT CAUSE ANALYSIS

For each significant deviation category (>5% mean error or systematic bias), perform root cause analysis by tracing through the SkyHawk code:

**4A. Area Deviations — Investigate:**
- `contour.ts`: Is Douglas-Peucker simplification losing area? Is the building mask including detached structures (garages, sheds)?
- `roofReconstruction.ts`: Are facets being generated correctly? Are overlapping facets double-counting area?
- `geometry.ts`: Is the Shoelace formula projection correct? Is the pitch factor being applied correctly (√(1 + (p/12)²))?
- Solar API: Are segment areas from the API being used vs. recalculated? Are overhangs being accounted for?

**4B. Edge Length Deviations — Investigate:**
- `roofReconstruction.ts`: Are ridges being placed at the correct locations? Are hip/valley angles geometrically correct?
- Edge type classification: Are rakes vs. eaves being classified correctly (sloped vs. level edges)?
- Missing edges: Is the system detecting all flashing and step-flashing transitions?

**4C. Pitch Deviations — Investigate:**
- Solar API segment pitch values vs. EagleView LIDAR measurements
- Pitch capping logic: The existing plan notes pitches as high as 17/12 being suspect — is there a cap?
- Predominant pitch calculation: Mode vs. area-weighted mode

**4D. Facet Count Deviations — Investigate:**
- `roofReconstruction.ts`: Is the facet splitting algorithm producing the right number of facets?
- Small facet threshold: EagleView counts facets >20 sq ft; does SkyHawk have a minimum?
- Complex roof handling: Cross-gable, T-shaped, L-shaped roofs with many small transition facets

**4E. Missing Metrics — Investigate what SkyHawk doesn't compute that EagleView does:**
- Estimated attic area (flat footprint area)
- Number of stories
- Structure complexity rating (Simple/Normal/Complex)
- Parapets
- Per-facet area breakdown with labeled diagram (A-Z)
- Areas-per-pitch breakdown table
- Waste table with EagleView's specific percentage columns (non-standard intervals)
- Edge counts (not just total lengths — e.g., "9 Ridges", "21 Hips")

---

### PHASE 5: PRIORITIZED IMPROVEMENT PLAN

Based on the deviation analysis, produce a prioritized list of code changes. Rank by: (1) magnitude of error correction, (2) number of properties affected, (3) implementation effort.

For each improvement, specify:

```
IMPROVEMENT #N: [Title]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Impact:        [High/Medium/Low] — reduces mean error by ~X%
Properties:    [N of 18 affected]
Effort:        [Hours estimate]
Root Cause:    [Specific code path and logic error]
Files Changed: [Exact file paths]

BEFORE (current behavior):
  [Code snippet or logic description]

AFTER (proposed fix):
  [Code snippet or logic description]

VERIFICATION:
  [How to confirm the fix works — specific property address + expected vs. actual values]
```

---

### PHASE 6: IMPLEMENT THE TOP-PRIORITY FIX

Take the #1 ranked improvement and implement it. Make the actual code changes. Then re-run the comparison for the most-affected property to verify the improvement.

**After implementing:**
1. Show the BEFORE/AFTER comparison for that property
2. Show the projected impact on the aggregate deviation summary
3. Identify the NEXT improvement to tackle

---

### PHASE 7: ITERATION LOOP

Repeat Phases 5-6 for the next improvement. Continue until:
- Mean total area error < 5% across all 18 properties
- Mean edge length errors < 10% per edge type
- Facet count within ±2 of EagleView for all properties
- Pitch values within ±1/12 of EagleView for all facets

If a code change introduces regressions on other properties, flag it immediately and design a more nuanced fix.

---

### PHASE 8: REPORT FORMAT PARITY

Beyond measurement accuracy, compare the **report format and presentation** between EagleView Premium and SkyHawk's PDF output. For each gap, determine whether to implement it:

**8A. Visual/Diagram Gaps:**

| EagleView Feature | SkyHawk Status | Priority | Implementation Path |
|---|---|---|---|
| 3D model hero image (semi-transparent facets showing overhangs) | NO — has 3D viewer in-app but not in PDF | HIGH | Capture Three.js canvas → embed in PDF page 1 |
| Top-down aerial image | PARTIAL — has map screenshot | MEDIUM | Ensure satellite screenshot is high-res and well-cropped |
| 4-direction oblique images (N/S/E/W) | NO | MEDIUM | Google Maps Static API with heading param (0/90/180/270) + 45° tilt |
| Length Diagram (wireframe with edge lengths labeled) | NO | HIGH | Canvas/SVG render of wireframe + length labels → PDF page |
| Pitch Diagram (wireframe with pitch values per facet) | NO | HIGH | Canvas/SVG render of wireframe + pitch labels → PDF page |
| Area Diagram (wireframe with facet area labels) | NO | HIGH | Canvas/SVG render of wireframe + area labels → PDF page |
| Notes Diagram (wireframe with A-Z facet labels) | NO | MEDIUM | Canvas/SVG render of wireframe + letter labels → PDF page |
| Compass rose on diagrams | NO | LOW | Add N/S/E/W indicator to diagram renderer |

**8B. Data/Table Gaps:**

| EagleView Feature | SkyHawk Status | Priority | Implementation Path |
|---|---|---|---|
| Areas-per-pitch table (pitch → area → % of roof) | NO | HIGH | Group facets by pitch, sum areas, calc percentages |
| Structure complexity indicator (Simple/Normal/Complex) | NO | MEDIUM | Derive from facet count + edge complexity |
| Edge counts alongside lengths (e.g., "9 Ridges") | NO | MEDIUM | Count edges by type in recalculateMeasurements() |
| EagleView-style waste table (non-uniform % intervals) | PARTIAL — has 5/10/15/20/25% | MEDIUM | Compute suggested waste with buffer intervals like EV |
| Squares rounded to 1/3 square | NO — uses 1 decimal | LOW | Add rounding mode option: `ceil(sq * 3) / 3` |
| Estimated attic area | NO | LOW | Flat footprint area (total area / pitch factor) |
| Number of stories | NO | LOW | Derive from building height vs. typical story height |
| Parapet length tracking | NO | LOW | Add 'parapet' edge type |
| Claim information header | PARTIAL — has claims section | MEDIUM | Add claim # and date-of-loss to report header/TOC |
| Table of Contents page | NO | LOW | Add TOC with page references |
| Online Maps links | NO | LOW | Add Google Maps link with property address |
| Legal disclaimer page | NO | LOW | Add configurable legal/disclaimer footer page |
| Prepared-for / Company contact block | PARTIAL | MEDIUM | Enhance company branding section with full contact info |

**8C. Report Structure Gap:**
EagleView Premium follows this exact page order:
1. Cover Page (3D model, claim info, prepared-for, TOC, measurement summary)
2. Images — Top View (page 1)
3. Images — North/South Side (page 2)
4. Images — East/West Side (page 3)
5. Length Diagram (page 4)
6. Pitch Diagram (page 5)
7. Area Diagram (page 6)
8. Notes Diagram (page 7)
9. Report Summary (page 8) — areas per pitch, complexity, waste table, all totals, coordinates, notes
10. Online Maps (page 9)
11. Legal Disclaimer (page 10)

SkyHawk should eventually mirror this structure while keeping its unique additions (materials, solar, damage, claims) as supplementary pages after the EagleView-equivalent core.

---

### PHASE 9: PERSISTENT CALIBRATION DATASET

After all improvements are implemented, save the final comparison data as a **regression test fixture**:

1. Create `/tests/fixtures/eagleview-calibration.json` containing all 18 EagleView ground truth records
2. Create `/tests/calibration.test.ts` that:
   - Loads each fixture
   - Runs SkyHawk's measurement pipeline (mocked Solar API responses)
   - Asserts that every metric is within the convergence thresholds
   - Flags any regression if a code change causes a previously-passing property to fail
3. Add the calibration test to the CI pipeline

This ensures that future development never degrades measurement accuracy below the calibrated baseline.

---

### RULES OF ENGAGEMENT

1. **EagleView is ground truth.** If SkyHawk disagrees, SkyHawk is wrong until proven otherwise with a clear mathematical justification.
2. **Fix the root cause, not the symptom.** Don't add fudge factors or scaling constants — fix the algorithm that produces the wrong value.
3. **One improvement at a time.** Implement, verify, then move to the next. Never batch multiple fixes without verification.
4. **Preserve existing passing tests.** All 1291 existing Vitest tests must continue to pass after each change. Run `npm test` after every code change.
5. **Document your reasoning.** For every deviation, explain WHY SkyHawk is off, not just by how much.
6. **Consider edge cases across all 18 properties.** A fix that helps one property but hurts another is not a fix — it's a trade-off that needs a smarter solution.
7. **Track cumulative progress.** After each iteration, update the aggregate deviation summary to show the trajectory toward convergence.
8. **Read before writing.** Always read the full current state of any file before proposing changes. Never assume file contents.
9. **No hardcoded corrections.** Never add address-specific adjustments. All improvements must be general-purpose algorithmic changes.
10. **The 18 reports are the training set.** The goal is generalization — improvements should make SkyHawk more accurate on ANY property, not just these 18.

---

### OUTPUT FORMAT

Structure your work as a series of numbered iterations:

```
═══════════════════════════════════════════
ITERATION 1: [Phase being executed]
═══════════════════════════════════════════

[Work product for that phase]

STATUS: [What was accomplished, what's next]
AGGREGATE ACCURACY: [Current mean error across all metrics]
NEXT STEP: [What Phase/Iteration comes next]
```

Begin with Phase 1: Extract all 18 EagleView ground truth records.

---

*End of prompt.*
