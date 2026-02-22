# EagleView Patent Risk Assessment for SkyHawk

## Date: 2026-02-22

## Disclaimer
This is a technical analysis, not legal advice. A formal freedom-to-operate (FTO) analysis by a qualified patent attorney is essential before commercial deployment. Patent infringement depends on claim construction that often requires legal proceedings to resolve.

---

## Executive Summary

**Overall Risk Level: HIGH**

SkyHawk is a roof measurement and reporting platform built on aerial/satellite imagery, which falls squarely within EagleView's core patent portfolio of 35+ patents. Multiple areas of significant patent risk have been identified, ranging from features already built (Phase 1) to planned features (Phases 2-7) that would dramatically increase exposure.

EagleView has been extremely aggressive in enforcement:
- **EagleView v. Xactware/Verisk** - $125M patent infringement judgment (2019)
- **EagleView v. Nearmap** - Filed 2021
- **Pictometry v. Roofr** - Filed 2021, asserting patents against a roof measurement startup with a very similar business model to SkyHawk

---

## Risk Tier 1: CRITICAL (Features Already Implemented in Phase 1)

### 1. Roof Measurement Reports from Aerial Imagery
**Patents: US 8,145,578; 8,670,961; 9,514,568**

**Patent Claims (summarized):** A system that remotely determines measurements of a roof -- including size, dimensions, and pitch of distinct roof sections -- based on image files, and outputs a report containing those measurements. US 8,145,578 Claim 1 covers a system that "receives image files representing a plurality of distinct roof sections; determines measurements including size, dimensions, and pitch... based solely on the received image files; and outputs a report having the determined measurements."

**SkyHawk Implementation:**
- `src/utils/reportGenerator.ts` generates PDF reports with total roof area, per-facet pitch, per-facet area, edge lengths by type, roofing squares, and waste factors
- `src/utils/geometry.ts` performs Haversine distance, Shoelace area, and pitch-adjusted true area calculations
- All measurements are derived from satellite imagery displayed through Google Maps

**Risk Level: CRITICAL** - Even though SkyHawk uses manual tracing rather than automated detection, the patent claims cover the system as a whole (receiving images, determining measurements, outputting reports). The manual vs. automated distinction may not be a meaningful differentiator.

---

### 2. Predominant Pitch Calculation + Area + Report Workflow
**Patent: US 9,183,538 - "Method and System for Quick Square Roof Reporting"**

**Patent Claims (summarized):** A method that identifies a geographic location of a roof, determines the roof's footprint, determines the roof's predominant pitch, calculates estimated roofing area based on footprint and pitch, and generates a report.

**SkyHawk Implementation:**
- `src/utils/geometry.ts:185-203` - `getPredominantPitch()` calculates predominant pitch weighted by facet area
- Complete workflow: user provides address -> footprint determined -> pitch assigned -> area calculated -> report generated

**Risk Level: CRITICAL** - This patent directly covers SkyHawk's core workflow.

---

### 3. Multi-Type Edge Drawings with Overlapping Attributes on Imagery
**Patents: US 8,401,222; 8,542,880; 11,060,857**

**Patent Claims (summarized):** Creating multiple drawing layers on aerial imagery where line segments from different layers can substantially overlap, each representing a different "non-dimensional attribute." Also covers interactive files where users can override length values and areas auto-recalculate.

**SkyHawk Implementation:**
- 7 edge types (ridge, hip, valley, rake, eave, flashing, step-flashing) rendered as colored overlapping lines on satellite imagery
- Each type carries a non-dimensional attribute (its classification)
- Color coding in `src/utils/colors.ts`

**Risk Level: HIGH-CRITICAL** - The edge type system with overlapping color-coded lines representing different roof attributes closely matches the claimed "first layer drawing" and "second layer drawing" with different "non-dimensional attributes."

---

### 4. Address Search -> Satellite View -> Building Location -> Measurement -> Report
**Patents: US 8,542,880; 11,060,857**

**Patent Claims (summarized):** User inputs location data -> system displays nadir image -> provides moveable marker for precise building identification -> user confirms location -> system provides roof measurement reports.

**SkyHawk Implementation:**
- AddressSearch component with Google Places Autocomplete
- MapView centers on property with satellite imagery at zoom 20
- User identifies building and traces roof
- Report generated with measurements

**Risk Level: HIGH** - The overall workflow mirrors the claimed process closely.

---

## Risk Tier 2: HIGH (Planned Features)

### 5. Automatic Roof Detection (Phase 2 Auto-Measurement)
**Patents: US 8,078,436; 8,670,961; 9,514,568**

**Patent Claims:** Systems that correlate aerial images, generate 3D roof models with planar sections (slope, area, edges), and produce annotated reports.

**SkyHawk Plan:** Google Solar API LIDAR -> GeoTIFF parsing -> boundary tracing -> roof type classification -> edge/facet creation (AUTO_MEASUREMENT.md)

**Risk Level: HIGH** - The output is functionally identical to what the patents claim, regardless of using LIDAR vs. multi-view photogrammetry.

---

### 6. AI Vision Fallback for Roof Detection (Phase 2)
**Patent: US 8,145,578 family**

**SkyHawk Plan:** Send satellite imagery to Claude AI to identify building outlines, roof type, ridge positions, facet counts.

**Risk Level: HIGH** - Automated extraction of roof geometry from imagery is core to these patents.

---

### 7. 3D Roof Model Visualization (Phase 2)
**Patents: US 8,078,436; 8,670,961**

**Patent Claims:** "Generating... a three-dimensional model of the roof that includes a plurality of planar roof sections each having a corresponding slope, area, and edges."

**SkyHawk Plan:** Three.js 3D mesh from 2D facet outlines + pitch data (PHASE2_3D_ENHANCED.md)

**Risk Level: HIGH**

---

### 8. Wall Area Estimation (Phase 2)
**Patents: US 9,599,466; 9,933,257**

**Patent Claims:** Receiving roof measurements + reference height -> generating 3D model -> calculating wall area by extending walls from roof edges to ground.

**SkyHawk Plan:** Wall area calculation from building footprint + height, window/door placement, net wall area.

**Risk Level: HIGH** - Direct implementation of patented method.

---

### 9. Automated Pitch Detection from Imagery (Phase 4)
**Patents: US 8,170,840; 8,818,770; 9,129,376; 10,685,149; 11,030,358**

**Patent Claims:** Interactive and automated systems for determining roof pitch from aerial images.

**SkyHawk Plan:** Shadow analysis, ML pitch classifier, oblique imagery correlation.

**Risk Level: HIGH** - EagleView has 5+ patents in this family specifically covering pitch determination.

---

### 10. Solar Access Analysis (Phase 5)
**Patent: US 11,551,413**

**Patent Claims:** System retrieves 3D geo-referenced model + point cloud data of shade-casting objects -> automatically determines solar access values per vertex.

**SkyHawk Plan:** Solar panel placement, shading analysis, sun path simulation, energy estimates.

**Risk Level: HIGH** - Dedicated patent with specific claims covering this exact workflow.

---

## Risk Tier 3: MODERATE

### 11. Interactive Pitch Slider
**Patents: US 8,170,840; 8,818,770**

SkyHawk's pitch slider in MeasurementsPanel adjusts a numeric value rather than a visual marker overlaid on the image, providing some differentiation. **MODERATE** risk.

### 12. Damage Assessment (Phase 3)
**Related pending patents (not in listed portfolio)**

Hail/wind damage detection, condition scoring. **MEDIUM-HIGH** risk given EagleView's pending patent applications.

### 13. Centralized Property Database (Phase 6+)
**Patent: US 11,468,104**

Current implementation is simple property list. Risk increases if expanded to aggregate multi-source data by geocoded location. **MODERATE** risk.

---

## Risk Tier 4: LOW (Less Applicable)

| Feature | Patents | Why Low Risk |
|---------|---------|-------------|
| Oblique image mosaics | 7,873,238 | SkyHawk uses nadir Google Maps imagery |
| Oblique image navigation | 8,593,518 | Not implemented, no oblique imagery |
| Aerial image QC during flight | 8,385,672 | SkyHawk doesn't capture aerial imagery |
| Edge detection snap-to | 8,823,732 | Not implemented |
| Concurrent multi-view display | 8,209,152; 8,825,454; 9,135,737; 11,030,355 | Single map view only |
| 3D models with facade textures | 8,531,472 | 3D planned as geometry-only |

---

## Summary Risk Matrix

| Risk Level | Feature | Key Patents | Status |
|-----------|---------|-------------|--------|
| CRITICAL | Roof measurement reports from imagery | 8,145,578; 8,670,961; 9,514,568 | **BUILT** |
| CRITICAL | Predominant pitch + area + report | 9,183,538 | **BUILT** |
| HIGH-CRITICAL | Multi-type edge drawings on imagery | 8,401,222; 8,542,880; 11,060,857 | **BUILT** |
| HIGH | Address -> satellite -> locate -> measure -> report | 8,542,880; 11,060,857 | **BUILT** |
| HIGH | Auto roof detection pipeline | 8,078,436; 8,670,961 | Planned (Phase 2) |
| HIGH | AI vision roof detection | 8,145,578 family | Planned (Phase 2) |
| HIGH | 3D roof model generation | 8,078,436; 8,670,961 | Planned (Phase 2) |
| HIGH | Wall area estimation | 9,599,466; 9,933,257 | Planned (Phase 2) |
| HIGH | Automated pitch from imagery | 8,170,840 family (5 patents) | Planned (Phase 4) |
| HIGH | Solar access analysis | 11,551,413 | Planned (Phase 5) |
| MODERATE | Interactive pitch slider | 8,170,840; 8,818,770 | **BUILT** |
| MODERATE | Damage assessment | Pending patents | Planned (Phase 3) |
| LOW | Oblique imagery features | 7,873,238; 8,593,518 | Not applicable |
| LOW | Aerial capture QC | 8,385,672 | Not applicable |

---

## Recommendations

### Immediate Actions
1. **Engage a patent attorney** for a formal FTO analysis before any commercial deployment
2. **Evaluate claim validity** - Several EagleView patents have been challenged at PTAB; some claims have been invalidated
3. **Monitor Pictometry v. Roofr litigation** - This case involves a very similar business model

### Design-Around Considerations
4. Assess whether using Google Maps satellite imagery (licensed via API) vs. proprietary aerial imagery provides any distinction
5. Evaluate whether the manual-only approach (Phase 1) differs sufficiently from automated measurement claims
6. Consider whether LIDAR-based detection (Google Solar API) is distinguishable from multi-view photogrammetry claims
7. Investigate whether report output format changes could reduce overlap with annotated report claims

### Strategic Options
8. **Licensing** - EagleView offers licensing; given portfolio breadth, this may be most practical
9. **Prior art search** - Many roof measurement techniques predate EagleView's patents; a thorough prior art search may identify invalidation opportunities
10. **Reconsider highest-risk planned features** - Wall estimation, solar access, and automated pitch detection each have dedicated patents that would be difficult to design around
11. **Open-source defense** - Consider how open-source status affects patent risk posture

---

## All Patents Reviewed

| Patent | Title | Core Technology |
|--------|-------|----------------|
| 7,873,238 | Mosaic Oblique Images | Oblique image mosaicking with virtual camera |
| 8,078,436 | Aerial Roof Estimation Systems | 3D roof models from multi-view aerial images |
| 8,145,578 | Aerial Roof Estimation System | Remote roof measurement from imagery + reports |
| 8,170,840 | Pitch Determination Systems | Interactive pitch UI from aerial images |
| 8,209,152 | Concurrent Display Systems | Multi-view synchronized roof feature display |
| 8,385,672 | System for Detecting Image Abnormalities | In-flight image QC and re-shooting |
| 8,401,222 | System and Process for Roof Measurement | Multi-layer drawings + interactive reports |
| 8,531,472 | Rapid 3D Modeling with Facade Textures | Photorealistic 3D from oblique images |
| 8,542,880 | System and Process for Roof Measurement | Location marker + oblique image retrieval |
| 8,593,518 | Continuous Oblique Panning | Seamless oblique image navigation |
| 8,670,961 | Aerial Roof Estimation Systems | 3D roof models + annotated reports |
| 8,818,770 | Pitch Determination Systems | Pitch markers on aerial imagery |
| 8,823,732 | Edge Detection and Snap-to Feature | Edge detection with cursor snap-to |
| 8,825,454 | Concurrent Display Systems | Multi-view roof feature projection |
| 9,129,376 | Pitch Determination Systems | Image registration + pitch tools |
| 9,135,737 | Concurrent Display Systems | Concurrent display for roof estimation |
| 9,183,538 | Quick Square Roof Reporting | Predominant pitch + area + report |
| 9,514,568 | Aerial Roof Estimation Systems | 3D models + annotated reports |
| 9,599,466 | Estimation of Building Wall Area | Wall area from roof + height |
| 9,881,163 | Aerial Roof Estimation Systems | Roof estimation family continuation |
| 9,933,257 | Estimation of Building Wall Area | 3D building model wall estimation |
| 10,346,935 | Roof Estimation System | Roof estimation continuation |
| 10,528,960 | Aerial Roof Estimation | Roof estimation continuation |
| 10,648,800 | Roof Measurement Using Imagery | Roof measurement continuation |
| 10,663,294 | Aerial Roof Estimation | Roof estimation continuation |
| 10,671,648 | Aerial Roof Estimation | Roof estimation continuation |
| 10,679,331 | Aerial Roof Estimation | Roof estimation continuation |
| 10,685,149 | Pitch Determination Systems | Pitch detection continuation |
| 10,909,482 | Aerial Roof Estimation | Roof estimation continuation |
| 10,930,063 | Aerial Roof Estimation | Roof estimation continuation |
| 11,030,355 | Concurrent Display Systems | Multi-view concurrent display |
| 11,030,358 | Pitch Determination Systems | Interactive pitch determination |
| 11,060,857 | Roof Measurement Using Imagery | Location designation + multi-layer drawings |
| 11,551,413 | Determining Solar Access | Solar access from 3D models + point clouds |
| 11,468,104 | Centralized Property Database | Geocoded property data aggregation |
