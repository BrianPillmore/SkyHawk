# Google Solar API Deep Dive: SkyHawk Integration Analysis

## Executive Summary

SkyHawk currently uses approximately **30% of the Google Solar API's available data**. The `buildingInsights:findClosest` endpoint is well integrated for roof segment geometry (pitch, azimuth, area, center, bounding box), and the `dataLayers:get` endpoint is partially integrated for GeoTIFF mask/DSM processing. However, critical data fields -- individual panel placements, per-panel energy production, solar panel configurations, financial analyses with real utility data, sunshine quantiles, and the hourly shade GeoTIFF layers -- are fetched but never consumed by the application logic. Incorporating these unused fields could improve roof measurement accuracy by an estimated 15-25%, replace SkyHawk's simplified solar/financial calculators with Google's location-calibrated data, and unlock real shading analysis based on actual 3D obstruction data rather than generic models.

---

## 1. Current Usage Summary

### 1.1 Endpoints Called

| Endpoint | File | Status |
|----------|------|--------|
| `buildingInsights:findClosest` | `src/services/solarApi.ts:24-69` | **Active** -- called with HIGH/MEDIUM quality fallback |
| `dataLayers:get` | `src/services/solarApi.ts:75-122` | **Active** -- called with FULL_LAYERS view, 0.1m pixel resolution |
| GeoTIFF download | `src/services/solarApi.ts:128-145` | **Active** -- generic GeoTIFF downloader for mask/DSM |

### 1.2 Fields Currently Consumed from `buildingInsights`

**Used in `src/hooks/useAutoMeasure.ts` (lines 29-37):**
- `solarPotential.roofSegmentStats[]` -- iterated for segment data
  - `pitchDegrees` -- primary pitch source for auto-measurement
  - `azimuthDegrees` -- passed to AI edge detection as context hints
  - `stats.areaMeters2` -- used to sort segments by size (largest = primary pitch)
  - `center` (latitude, longitude) -- passed to AI as segment hints

**Used in `src/utils/roofReconstruction.ts`:**
- `pitchDegrees` -- drives roof type classification and facet pitch assignment
- `azimuthDegrees` -- determines ridge direction, hip/valley/ridge edge classification
- `stats.areaMeters2` -- filters dominant segments (>5% of total), sorts for reconstruction
- `center` -- used as interior vertices in complex roof reconstruction
- `planeHeightAtCenterMeters` -- present in type definition but NOT actively used in logic
- `boundingBox` -- present in type definition but NOT actively used in logic

**Used in `src/utils/planarFaceExtraction.ts` (lines 272-308):**
- `center` -- converted to local feet for nearest-segment matching to extracted facets
- `pitchDegrees` -- assigned to facets via nearest-segment matching
- `azimuthDegrees` -- used for compass direction naming

**Used in `src/utils/facetBuilder.ts`:**
- Delegates to `planarFaceExtraction.ts` -- same fields as above

### 1.3 Fields Currently Consumed from `dataLayers`

**Defined in `src/types/solar.ts` (SolarDataLayerUrls):**
- `maskUrl` -- downloaded and processed through full contour pipeline in `src/utils/contour.ts`
- `dsmUrl` -- URL stored but processing pipeline not fully wired in auto-measure flow
- `rgbUrl` -- URL stored but not actively used (satellite imagery comes from Maps Static API instead)
- `annualFluxUrl` -- URL stored but NOT processed
- `monthlyFluxUrl` -- URL stored but NOT processed
- `hourlyShadeUrls[]` -- URLs stored but NOT processed
- `imageryDate` -- stored but not displayed or used
- `imageryProcessedDate` -- stored but not used
- `imageryQuality` -- stored but not used for quality indicators

### 1.4 What is Entirely Absent from SkyHawk's Type Definitions

The following fields exist in the API response but are **not even present** in `src/types/solar.ts`:

| Field | Description |
|-------|-------------|
| `solarPotential.panelCapacityWatts` | Google's reference panel wattage (typically 400W) |
| `solarPotential.panelHeightMeters` | Reference panel height (~1.879m) |
| `solarPotential.panelWidthMeters` | Reference panel width (~1.045m) |
| `solarPotential.panelLifetimeYears` | Reference panel lifetime (typically 20 years) |
| `solarPotential.solarPanels[]` | **Individual panel placement array** with center, orientation, yearlyEnergyDcKwh, segmentIndex |
| `solarPotential.solarPanelConfigs[]` | **Panel configuration array** with panelsCount, yearlyEnergyDcKwh, roofSegmentSummaries |
| `solarPotential.financialAnalyses[]` | **Financial analysis array** with monthlyBill, cashPurchaseSavings, leasingSavings, financedPurchaseSavings, federal/state/utility incentives |

---

## 2. Detailed Gap Analysis: Unused Endpoints and Fields

### 2.1 `solarPanels[]` -- Individual Panel Placements (HIGH VALUE)

**What it provides:** An array of every individual solar panel that Google's algorithm has placed on the roof. Each panel has:
- `center` (LatLng) -- exact geographic position of the panel
- `orientation` -- LANDSCAPE or PORTRAIT
- `yearlyEnergyDcKwh` -- per-panel annual energy production
- `segmentIndex` -- which roof segment the panel sits on

**Why it matters for SkyHawk:**
1. **Roof area validation**: The number and arrangement of panels Google can fit on each segment provides ground-truth validation of SkyHawk's calculated facet areas. If Google fits 15 panels on a segment and SkyHawk computes that segment at 200 sq ft, but 15 panels at 17.6 sq ft each = 264 sq ft, that flags a discrepancy.
2. **Obstruction detection**: Gaps in panel placement reveal obstructions (vents, skylights, chimneys, dormers) that SkyHawk currently does not detect. These gaps can be back-calculated to estimate the area of obstructions, improving the waste factor calculation.
3. **Usable area refinement**: Instead of SkyHawk's generic 20-40% setback reduction (see `solarCalculations.ts:237-241`), actual panel placement data shows the true usable area.
4. **Solar report upgrade**: The panel layout can be visualized as an overlay on the satellite image in reports.

**Estimated accuracy improvement**: 10-15% improvement in usable area calculations and waste factor estimates.

### 2.2 `solarPanelConfigs[]` -- Optimal Configurations (HIGH VALUE)

**What it provides:** An ordered array of configurations from 1 panel to max panels. Each config has:
- `panelsCount` -- total panels in this configuration
- `yearlyEnergyDcKwh` -- total system annual energy at this size
- `roofSegmentSummaries[]` -- per-segment breakdown with panelsCount, yearlyEnergyDcKwh, pitchDegrees, azimuthDegrees

**Why it matters for SkyHawk:**
1. **Replace hand-rolled solar calculator**: SkyHawk's `solarCalculations.ts` contains 380+ lines of custom solar estimation code with hardcoded assumptions (peak sun hours by latitude, cosine-based azimuth falloff, sine-curve monthly distribution). Google's `yearlyEnergyDcKwh` accounts for actual local weather data, real shading from the DSM, and validated irradiance models.
2. **System sizing optimization**: The configs array lets users explore different system sizes with accurate energy production per-size, rather than SkyHawk's linear scaling.
3. **Per-segment energy breakdown**: `roofSegmentSummaries` provides accurate per-facet energy data instead of SkyHawk's estimated `solarAccessFactor` calculation.

**Estimated accuracy improvement**: 20-40% improvement in energy production estimates (replacing generic latitude-based model with location-calibrated data).

### 2.3 `financialAnalyses[]` -- Real Financial Data (HIGH VALUE, US only)

**What it provides:** For various monthly bill amounts, the API returns:
- `financialDetails.initialAcKwhPerYear` -- validated AC production estimate
- `financialDetails.federalIncentive` -- actual federal tax credit amount
- `financialDetails.stateIncentive` -- state-specific incentive data
- `financialDetails.utilityIncentive` -- utility-specific rebates
- `financialDetails.lifetimeSrecTotal` -- Solar Renewable Energy Credits
- `financialDetails.netMeteringAllowed` -- whether net metering applies
- `financialDetails.solarPercentage` -- what % of energy is offset
- `financialDetails.percentageExportedToGrid` -- excess production
- `cashPurchaseSavings.paybackYears` -- Google's calculated payback period
- `cashPurchaseSavings.outOfPocketCost` -- real cost after incentives
- `leasingSavings` -- leasing scenario analysis
- `financedPurchaseSavings` -- loan scenario analysis

**Why it matters for SkyHawk:**
1. **Replace hardcoded financial model**: SkyHawk's financial calculator uses fixed assumptions: $2.77/W cost, 30% federal credit, 3% annual rate increase, $0.16/kWh. Google provides location-specific data including state incentives, utility incentives, SRECs, and net metering status that SkyHawk completely ignores.
2. **Multiple financing scenarios**: Cash purchase, lease, and financed options are pre-calculated by Google rather than SkyHawk's single cash-only model.
3. **Credibility**: Google-sourced financial data carries more authority in professional reports than hand-rolled estimates.

**Estimated accuracy improvement**: Financial projections could improve by 30-50% accuracy, especially for states with strong solar incentives.

### 2.4 `sunshineQuantiles[]` -- Sunshine Distribution (MEDIUM VALUE)

**What it provides:** An 11-element array for `wholeRoofStats`, `buildingStats`, and each `roofSegmentStats` element. Represents the distribution of sunshine hours across the surface -- effectively a histogram of solar access.

**Why it matters for SkyHawk:**
1. **Shading proxy**: The spread of sunshine quantiles reveals how much shading variation exists across a roof segment. A tight distribution = uniform exposure; a wide distribution = significant partial shading.
2. **Replace generic shading model**: SkyHawk's `shadingAnalysis.ts` uses a simplified model with a single configurable "obstruction angle" parameter. The sunshine quantiles from the API encode actual shading data derived from the DSM.
3. **Per-facet shading quality score**: Instead of one obstruction angle for the whole roof, each segment's quantiles reveal its specific shading characteristics.

**Estimated accuracy improvement**: 15-20% improvement in shading impact estimates.

### 2.5 `planeHeightAtCenterMeters` -- Segment Height (MEDIUM VALUE)

**What it provides:** The height of the roof plane at the segment center point, in meters above sea level (or ground level, depending on interpretation).

**Current status:** Defined in `SolarRoofSegment` type but never used in any calculation.

**Why it matters for SkyHawk:**
1. **3D reconstruction accuracy**: Height data can constrain the 3D roof model. Currently, SkyHawk reconstructs roofs as 2D polygons with pitch applied mathematically. Actual heights enable true 3D vertex positioning.
2. **Wall height estimation**: Differences in `planeHeightAtCenterMeters` between adjacent segments can estimate wall heights at transitions, improving the wall calculations in `wallCalculations.ts`.
3. **Multi-story detection**: Significant height differences between segments suggest a multi-story building, which affects material estimates and inspection complexity.

### 2.6 `boundingBox` per Segment (LOW-MEDIUM VALUE)

**Current status:** Defined in type but not used.

**Why it matters:**
- Can be used to validate and constrain facet boundaries during reconstruction
- Cross-reference with AI-detected edges to improve vertex placement accuracy

### 2.7 Hourly Shade GeoTIFFs (HIGH VALUE, complex)

**What it provides:** 24 GeoTIFF files, one per hour, showing shade patterns across the roof and surrounding area. Each pixel value represents the fraction of that hour that the location is in shade.

**Why it matters for SkyHawk:**
1. **Real shading analysis**: SkyHawk's `shadingAnalysis.ts` and `ShadingPanel.tsx` use a purely mathematical model based on sun altitude calculations with a user-configurable obstruction angle. The hourly shade GeoTIFFs encode real-world shading from trees, neighboring buildings, and the roof's own geometry -- derived from the actual DSM.
2. **Per-facet shade profiles**: By sampling shade values within each roof facet's boundary, SkyHawk could compute accurate per-facet shade profiles instead of generic whole-roof estimates.
3. **Optimal panel placement**: Shade data can identify the shadiest areas to avoid when recommending panel placement.

**Estimated accuracy improvement**: Could improve solar production estimates by 15-25% for buildings with significant nearby obstructions.

### 2.8 Annual Flux and Monthly Flux GeoTIFFs (HIGH VALUE, complex)

**What it provides:**
- `annualFluxUrl` -- a GeoTIFF where each pixel value represents annual solar energy in kWh/kW/year for that location
- `monthlyFluxUrl` -- a multi-band GeoTIFF with 12 bands, one per month, with the same per-pixel flux data

**Why it matters for SkyHawk:**
1. **Replace sine-curve monthly distribution**: SkyHawk's `calculateMonthlyProduction()` uses a simple sine curve centered on June/July. The monthly flux data provides actual month-by-month insolation based on real weather patterns and local conditions.
2. **Per-pixel energy map**: The annual flux can be visualized as a heat map overlay in SkyHawk's map view, showing users exactly where the best solar locations are on their roof.
3. **Facet-level flux averaging**: By averaging flux values within each facet boundary, SkyHawk can compute accurate per-facet annual production without the latitude/azimuth/tilt estimation model.

### 2.9 DSM GeoTIFF (MEDIUM VALUE, partially used)

**What it provides:** Digital Surface Model -- elevation of every pixel including buildings, trees, and terrain.

**Current status:** URL is fetched via `dataLayers:get` but the DSM is not processed in the auto-measure pipeline. Only the mask GeoTIFF is fully processed through the contour extraction pipeline.

**Why it matters for SkyHawk:**
1. **Pitch verification**: By sampling DSM elevation values across a roof facet, the actual slope can be computed and compared against the Solar API's `pitchDegrees`. This provides a second pitch measurement source beyond the API's pre-computed value.
2. **Ridge/valley detection**: Local maxima in the DSM along the roof surface correspond to ridges; local minima correspond to valleys. This can validate AI-detected edge types.
3. **Height-above-ground**: The DSM minus the local terrain elevation gives the building height, useful for wall calculations and 3D visualization.

### 2.10 Imagery Date and Quality Metadata (LOW VALUE)

**Current status:** Stored in types but never displayed.

**Why it matters:**
- `imageryDate` can be shown in reports to indicate data freshness
- `imageryQuality` can drive UI warnings when only MEDIUM quality data is available
- Quality level affects the reliability of all derived measurements

### 2.11 `groundAreaMeters2` (LOW-MEDIUM VALUE)

**What it provides:** The area of the building footprint projected onto the ground, separate from `areaMeters2` which is the actual surface area accounting for roof slope.

**Why it matters:**
- Directly provides the flat/projected area that SkyHawk computes from polygons
- Can be used as a cross-validation check: SkyHawk's polygon-based `areaSqFt` should approximately match `groundAreaMeters2 * 10.764`

---

## 3. Implementation Plan

### Phase 1: Type Definitions and Data Capture (1-2 days)

**Goal:** Extend the SolarBuildingInsights type to include all available fields so the full API response is stored.

**Files to modify:**
- `src/types/solar.ts` -- add missing interfaces:
  - `SolarPanel` with center, orientation, yearlyEnergyDcKwh, segmentIndex
  - `SolarPanelConfig` with panelsCount, yearlyEnergyDcKwh, roofSegmentSummaries
  - `FinancialAnalysis` with monthlyBill, financialDetails, leasingSavings, cashPurchaseSavings, financedPurchaseSavings
  - All nested types (Money, SavingsOverTime, FinancialDetails, etc.)
  - Add `panelCapacityWatts`, `panelHeightMeters`, `panelWidthMeters`, `panelLifetimeYears` to SolarBuildingInsights.solarPotential
- `src/services/solarApi.ts` -- no changes needed (already returns full JSON response)
- `src/store/useStore.ts` -- add solar API response caching to property state

**Risk:** None. Purely additive type changes. The service already fetches the complete response; we just need to type it properly and store it.

### Phase 2: Solar Panel Placement Validation (3-5 days)

**Goal:** Use `solarPanels[]` to validate and improve facet area measurements.

**New files:**
- `src/utils/solarPanelValidation.ts` -- compare Google panel placement count per segment against SkyHawk's computed facet areas. Flag discrepancies.

**Files to modify:**
- `src/hooks/useAutoMeasure.ts` -- after facet extraction, run panel placement validation
- `src/components/measurement/MeasurementsPanel.tsx` -- display validation confidence indicator

**Key logic:**
1. For each roof segment, count panels from `solarPanels[]` where `segmentIndex` matches
2. Compute implied usable area: `panelCount * panelHeightMeters * panelWidthMeters`
3. Compare against SkyHawk's facet `trueAreaSqFt` (converted to m2)
4. If discrepancy > 15%, flag for user review and offer area adjustment
5. Use panel gaps to estimate obstruction area, feeding into a more accurate waste factor

### Phase 3: Replace Solar Calculator with API Data (3-5 days)

**Goal:** Use `solarPanelConfigs[]` and `yearlyEnergyDcKwh` for energy production instead of the hand-rolled latitude/tilt/azimuth model.

**Files to modify:**
- `src/utils/solarCalculations.ts` -- add a new `analyzeSolarPotentialFromApi()` function that uses Google data when available, falling back to the existing model when the API has no coverage
- `src/components/solar/SolarPanel.tsx` -- prefer API-sourced data; show data source indicator
- `src/utils/reportGenerator.ts` -- use API-sourced solar data in PDF reports when available

**Key logic:**
1. Match SkyHawk facets to API segments by nearest-center distance
2. Pull `yearlyEnergyDcKwh` from matched segment summaries in the optimal config
3. For per-facet analysis, use `roofSegmentSummaries` from the config matching the user's selected panel count
4. Keep existing calculator as fallback for locations without Solar API coverage

### Phase 4: Financial Analysis Integration (2-3 days)

**Goal:** Use `financialAnalyses[]` for location-accurate financial projections.

**Files to modify:**
- `src/utils/solarCalculations.ts` -- add `parseFinancialAnalysis()` to extract Google's financial data
- `src/components/solar/SolarPanel.tsx` -- add new "Financial" tab sections for cash/lease/finance scenarios, show state-specific incentives
- `src/utils/reportGenerator.ts` -- include Google's financial projections in the Solar Analysis section

**Key logic:**
1. Find the `financialAnalysis` entry matching the user's monthly bill (or closest match)
2. Extract `cashPurchaseSavings.paybackYears`, `outOfPocketCost`, savings timeline
3. Show federal, state, and utility incentives separately (currently only federal is modeled)
4. Add leasing and financing scenarios to the report

### Phase 5: Sunshine Quantiles for Shading (2-3 days)

**Goal:** Replace the generic obstruction-angle shading model with data derived from sunshine quantiles.

**Files to modify:**
- `src/utils/shadingAnalysis.ts` -- add `analyzeFromSunshineQuantiles()` that interprets the 11-quantile distribution
- `src/components/solar/ShadingPanel.tsx` -- display per-segment shading quality scores derived from quantile spread
- `src/utils/solarCalculations.ts` -- factor quantile-derived shading into solar access calculations

**Key logic:**
1. For each segment, compute the interquartile range (Q75 - Q25) of sunshine quantiles
2. A narrow IQR indicates uniform sunshine (low shading); a wide IQR indicates high shading variation
3. The lowest quantile (Q0) represents the most-shaded portion; use this to flag severely shaded areas
4. Replace or augment the generic `obstructionAngle` model with quantile-derived shade factors

### Phase 6: GeoTIFF Flux and Shade Processing (5-8 days)

**Goal:** Process the monthly flux and hourly shade GeoTIFFs for pixel-accurate energy and shading data.

**New files:**
- `src/utils/fluxProcessor.ts` -- parse annual/monthly flux GeoTIFFs, average values within facet boundaries
- `src/utils/shadeProcessor.ts` -- parse hourly shade GeoTIFFs, compute per-facet hourly shade profiles

**Files to modify:**
- `src/hooks/useAutoMeasure.ts` -- optionally download and process flux/shade layers
- `src/components/solar/ShadingPanel.tsx` -- display real hourly shade data instead of mathematical approximation
- `src/utils/reportGenerator.ts` -- include flux-based production data and shade maps in reports

**Key logic:**
1. Download monthly flux GeoTIFF (12-band raster)
2. For each facet, identify which pixels fall within the facet boundary (using the mask + facet polygons)
3. Average flux values within each facet for each month -> accurate monthly production curve
4. Similarly process hourly shade GeoTIFFs for real shading profiles
5. This fully replaces the sine-curve monthly model and the generic shading model

**Note:** This phase has the highest complexity due to GeoTIFF multi-band processing and spatial intersection operations. Consider using web workers for performance.

### Phase 7: DSM-Based Pitch Verification and Height Analysis (3-5 days)

**Goal:** Use the DSM GeoTIFF to verify roof pitch and extract building height data.

**New files:**
- `src/utils/dsmAnalysis.ts` -- sample DSM elevations within facets, compute gradient/slope

**Files to modify:**
- `src/hooks/useAutoMeasure.ts` -- add DSM pitch verification step
- `src/utils/wallCalculations.ts` -- use DSM-derived heights for wall height estimation
- `src/components/measurement/RoofViewer3D.tsx` -- use DSM heights for true 3D vertex placement

**Key logic:**
1. Download DSM GeoTIFF
2. For each facet, sample elevation values at multiple points
3. Fit a plane to the elevation samples -> compute pitch and azimuth
4. Compare against Solar API's `pitchDegrees` and AI-estimated pitch
5. Use the median of all three sources (API, AI, DSM) for the final pitch value
6. Extract eave-line elevations for wall height calculations

### Phase 8: Panel Layout Visualization and Report Enhancement (2-3 days)

**Goal:** Visualize individual panel placements on the map and in PDF reports.

**Files to modify:**
- `src/components/map/MapView.tsx` -- render panel rectangles on the map using `solarPanels[]` positions and orientations
- `src/components/solar/SolarPanel.tsx` -- add "Panel Layout" view showing individual panels colored by energy production
- `src/utils/reportGenerator.ts` -- add panel layout diagram to PDF reports

**Key logic:**
1. For each panel in `solarPanels[]`, compute corner coordinates from center, orientation, and panel dimensions
2. Color-code panels by `yearlyEnergyDcKwh` (high = green, low = red)
3. Show segment boundaries and panel counts
4. In reports, embed the panel layout as an overlay on the aerial image

---

## 4. Expected Accuracy Improvements by Area

### Roof Area Measurements
| Metric | Current Approach | With Solar API Enhancement | Estimated Improvement |
|--------|-----------------|---------------------------|----------------------|
| Facet area | AI-detected polygons + polygon area calculation | Cross-validated against panel placement implied areas | +10-15% |
| Pitch | Solar API single value per segment | Median of API + AI + DSM-derived pitch | +5-10% |
| Obstruction area | Not measured | Inferred from panel placement gaps | NEW capability |
| Building height | Not measured | DSM elevation extraction | NEW capability |

### Solar Energy Estimates
| Metric | Current Approach | With Solar API Enhancement | Estimated Improvement |
|--------|-----------------|---------------------------|----------------------|
| Annual production | Latitude-based peak sun hours model | Google's `yearlyEnergyDcKwh` with real weather data | +20-40% |
| Monthly distribution | Sine curve centered on June | Monthly flux GeoTIFF data | +25-35% |
| Shading impact | User-configurable obstruction angle | Hourly shade GeoTIFFs + sunshine quantiles | +15-25% |
| Solar access factor | Cosine-based azimuth/tilt model | Per-panel actual energy data | +20-30% |

### Financial Projections
| Metric | Current Approach | With Solar API Enhancement | Estimated Improvement |
|--------|-----------------|---------------------------|----------------------|
| System cost | Fixed $/W assumption | Still user-configurable (API doesn't provide local pricing) | No change |
| Incentives | Federal 30% tax credit only | Federal + state + utility + SRECs | +30-50% |
| Payback period | Custom iterative calculation | Google's validated payback model | +20-30% |
| Financing options | Cash only | Cash + lease + financed scenarios | NEW capability |
| Net metering | Not modeled | Google's net metering data | NEW capability |

### Report Quality
| Feature | Current | Enhanced |
|---------|---------|----------|
| Solar production data | Estimated from latitude/pitch model | Google-validated production numbers |
| Financial analysis | Single cash purchase scenario | Cash, lease, and financed scenarios with real incentives |
| Panel layout | Not shown | Visual panel placement overlay |
| Shading analysis | Mathematical approximation | Real shading data from DSM |
| Data freshness indicator | Not shown | Imagery date and quality level displayed |
| Monthly production chart | Sine curve estimate | Actual monthly flux data |

---

## 5. Priority Ranking

| Priority | Phase | Effort | Value | Reasoning |
|----------|-------|--------|-------|-----------|
| 1 | Phase 1: Type Definitions | 1-2 days | Foundation | Required for everything else |
| 2 | Phase 3: Replace Solar Calculator | 3-5 days | Very High | Biggest accuracy jump for least effort |
| 3 | Phase 4: Financial Analysis | 2-3 days | High | Immediately visible to users in reports |
| 4 | Phase 2: Panel Placement Validation | 3-5 days | High | Validates area measurements, detects obstructions |
| 5 | Phase 5: Sunshine Quantiles | 2-3 days | Medium-High | Better shading data with minimal complexity |
| 6 | Phase 8: Panel Layout Visualization | 2-3 days | Medium | User-facing feature, high polish value |
| 7 | Phase 7: DSM Pitch Verification | 3-5 days | Medium | Multi-source pitch improves confidence |
| 8 | Phase 6: GeoTIFF Flux/Shade Processing | 5-8 days | Very High but Complex | Highest accuracy gain but significant engineering effort |

**Total estimated effort: 22-34 days**

---

## 6. Risk Considerations

### API Coverage Gaps
The Solar API does not have data for every building. Coverage varies by region and is best in the US, parts of Europe, and Japan. SkyHawk must always maintain its current AI-based fallback pipeline for locations without Solar API data.

### API Cost
Solar API billing:
- `buildingInsights:findClosest` -- billed per request
- `dataLayers:get` -- billed per request (more expensive)
- GeoTIFF downloads -- billed per download

Processing hourly shade (24 downloads) and monthly flux (1 multi-band download) for every property could increase API costs significantly. Consider:
- Making GeoTIFF processing optional / user-initiated ("Detailed Analysis" button)
- Caching responses per property to avoid re-fetching
- Only downloading the layers actually needed for the current analysis

### `solarPanelConfigs` and `financialAnalyses` Availability
These fields are only populated when at least 4 panels can fit on the roof and financial data is available (US locations primarily). Always check for their presence before using them.

### GeoTIFF Processing Performance
GeoTIFF parsing and spatial intersection operations are CPU-intensive. The `geotiff` library is already used for mask processing, but processing 24 hourly shade files plus monthly flux in the browser could cause UI freezes. Use web workers for all GeoTIFF processing in Phase 6.

---

## 7. Source Files Reference

All file paths are relative to `C:\Users\brian\GitHub\SkyHawk\`:

| File | Role | Solar API Relevance |
|------|------|-------------------|
| `src/services/solarApi.ts` | API client for Solar API | All 3 endpoints called here |
| `src/types/solar.ts` | Type definitions for Solar API responses | Incomplete -- missing ~60% of response fields |
| `src/hooks/useAutoMeasure.ts` | Orchestrates auto-measurement pipeline | Consumes buildingInsights for pitch/segments |
| `src/utils/roofReconstruction.ts` | Reconstructs roof geometry from segments | Heavy consumer of roofSegmentStats |
| `src/utils/planarFaceExtraction.ts` | Extracts individual facets from edge graph | Matches facets to Solar segments |
| `src/utils/facetBuilder.ts` | Facet building with fallback logic | Delegates to planarFaceExtraction |
| `src/utils/solarCalculations.ts` | Solar energy/financial calculator | Could be largely replaced by API data |
| `src/utils/shadingAnalysis.ts` | Generic shading model | Could be replaced by API shade/quantile data |
| `src/utils/sunPath.ts` | Sun position calculations | Supplementary to API shade data |
| `src/utils/contour.ts` | GeoTIFF mask processing pipeline | Processes mask; could be extended for flux/shade |
| `src/utils/pitchDetection.ts` | Pitch estimation utilities | Could incorporate DSM-derived pitch |
| `src/utils/reportGenerator.ts` | PDF report generation | Should surface API-sourced data |
| `src/utils/wallCalculations.ts` | Wall height/area estimation | Could use DSM heights |
| `src/components/solar/SolarPanel.tsx` | Solar analysis UI panel | Displays calculator output; should show API data |
| `src/components/solar/ShadingPanel.tsx` | Shading analysis UI | Uses generic model; should use API data |
| `src/components/measurement/RoofViewer3D.tsx` | 3D roof visualization | Could use DSM heights for true 3D |
| `src/services/visionApi.ts` | AI vision service for edge detection | Receives Solar segment hints |
| `src/store/useStore.ts` | Application state management | Needs Solar API response caching |

---

## 8. Conclusion

SkyHawk has built an impressive roof measurement and solar analysis pipeline, but it is currently leaving significant value on the table by only consuming approximately 30% of the Google Solar API's available data. The most impactful quick wins are:

1. **Replacing the hand-rolled solar calculator** with Google's pre-computed `yearlyEnergyDcKwh` values (Phase 3) -- this alone could improve energy production estimates by 20-40% because Google's model incorporates actual weather data, real shading from the DSM, and validated irradiance models that SkyHawk's latitude-based model cannot match.

2. **Integrating financial analyses** (Phase 4) -- adding state and utility incentives, net metering data, and multiple financing scenarios would make SkyHawk's financial projections dramatically more useful and accurate for US locations.

3. **Using panel placements for area validation** (Phase 2) -- cross-referencing Google's panel count per segment against SkyHawk's computed areas provides an independent accuracy check and reveals obstructions that affect waste calculations.

The longer-term investment in GeoTIFF flux and shade processing (Phase 6) would yield the highest accuracy gains but requires the most engineering effort. It should be pursued after the quicker wins are delivered and validated.
