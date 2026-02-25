# SkyHawk Measurement Specification

## Version: 2.0

## Implementation Status
**Current Implementation Includes:**
- Area calculation using Shoelace formula on Haversine-projected coordinates
- Pitch adjustment with pitch factor multiplication
- Pitch capping at MAX_RESIDENTIAL_PITCH=24/12 (63.4°) to prevent extreme area inflation
- Waste factor calculation with multi-factor heuristic algorithm (5-25%)
- Material estimation (17 material types including waste factor)
- Edge measurements (ridge, hip, valley, rake, eave, flashing, step-flashing)
- Multi-facet support with independent pitch per facet
- Multi-structure detection via DBSCAN-like spatial clustering
- Data export formats (PDF reports, interactive HTML, JSON, GeoJSON, CSV, ESX)
- Drip edge calculation (rake + eave totals)
- LIDAR-first pipeline: Solar API data layers → DSM 3D pitch/area → AI Vision fallback
- Accuracy scoring: 0-100 weighted score with 5 factors and letter grades
- Building height and stories extraction from DSM elevation data

## 1. Coordinate System
- All geographic coordinates use WGS84 (latitude/longitude)
- Internal calculations convert to local Cartesian feet using Haversine-based projection
- Reference point for local coordinates is the centroid of the vertex set

## 2. Distance Calculation
### Haversine Formula
```
a = sin²(ΔLat/2) + cos(lat₁) × cos(lat₂) × sin²(ΔLng/2)
c = 2 × atan2(√a, √(1−a))
distance = R × c
```
Where R = 20,902,231 feet (Earth radius)

### Accuracy
- Haversine is accurate to ~0.3% for distances under 1 mile
- For typical roof dimensions (10-200 ft), error is negligible (<0.01 ft)

## 3. Area Calculation
### Shoelace Formula (on projected coordinates)
```
Area = |Σᵢ (xᵢ × yᵢ₊₁ - xᵢ₊₁ × yᵢ)| / 2
```
Where (x, y) are local Cartesian coordinates in feet.

### Projection
```
ftPerDegLat = R × π/180
ftPerDegLng = ftPerDegLat × cos(midLatitude)
x = (lng - refLng) × ftPerDegLng
y = (lat - refLat) × ftPerDegLat
```

### 3D Area from DSM (LIDAR pipeline)
When Solar API data layers are available, `analyzeFacetFromDSM()` computes true 3D area
from DSM elevation samples using plane fitting and triangle area calculations, providing
ground-truth verification independent of user-specified pitch.

## 4. Pitch/Slope
### Definition
Pitch is expressed as X/12 (rise over run in inches per foot).
- 0/12 = Flat (0°)
- 4/12 = Low slope (18.4°)
- 6/12 = Standard (26.6°)
- 8/12 = Moderate (33.7°)
- 12/12 = Steep (45°)
- 24/12 = Very steep (63.4°) — MAX_RESIDENTIAL_PITCH cap

### Pitch Factor (True Area Multiplier)
```
pitchFactor = √(1 + (pitch/12)²)
trueArea = flatArea × pitchFactor
```

### Pitch Cap
All pitch values are clamped via `clampPitch()` at 24/12 (63.4°) to prevent extreme
area inflation from steep or erroneous Solar API segments. Applied at all 5 pitch
assignment points in the pipeline.

### Pitch Factor Table
| Pitch | Factor | Degrees |
|-------|--------|---------|
| 0/12  | 1.000  | 0.0°    |
| 1/12  | 1.003  | 4.8°    |
| 2/12  | 1.014  | 9.5°    |
| 3/12  | 1.031  | 14.0°   |
| 4/12  | 1.054  | 18.4°   |
| 5/12  | 1.083  | 22.6°   |
| 6/12  | 1.118  | 26.6°   |
| 7/12  | 1.158  | 30.3°   |
| 8/12  | 1.202  | 33.7°   |
| 9/12  | 1.250  | 36.9°   |
| 10/12 | 1.302  | 39.8°   |
| 11/12 | 1.357  | 42.5°   |
| 12/12 | 1.414  | 45.0°   |

## 5. Edge Types
| Type | Description | Typical Location |
|------|-------------|-----------------|
| Ridge | Horizontal peak where two slopes meet | Top of roof |
| Hip | Angled external junction of two slopes | Corners of hip roof |
| Valley | Angled internal junction of two slopes | Interior corners |
| Rake | Sloped edge at gable end | Gable sides |
| Eave | Horizontal edge at bottom of roof | Bottom perimeter |
| Flashing | Roof-to-wall transition | Where roof meets wall |
| Step Flashing | Stepped flashing along wall | Along sloped wall junction |

## 6. Roofing Squares
```
squares = trueArea / 100
```
One roofing square = 100 square feet.
Rounding convention: `Math.ceil(rawSquares * 3) / 3` (1/3 square increments).

## 7. Waste Factor
### Multi-Factor Algorithm
```
if facets ≤ 2 AND hipsValleys = 0: 5%
if facets ≤ 4 AND hipsValleys ≤ 2: 10%
if facets ≤ 8 AND hipsValleys ≤ 6: 15%
if facets ≤ 12: 20%
else: 25%
```
Enhanced with hip/valley ratio, ridge length, and rake thresholds for structure
complexity classification (Complex/Normal/Simple).

### Waste Table Calculation
Dynamic intervals: `[0, W-25, W-20, W-17, W-15, W-13, W-10, W-5, W]`
```
areaWithWaste = trueArea × (1 + wastePercent/100)
squaresWithWaste = ceil(areaWithWaste / 100, 1 decimal)
```

## 8. Drip Edge
```
dripEdge = totalRakeLength + totalEaveLength
```

## 9. Data Model

### Vertex
- id: UUID
- lat: float (WGS84 latitude)
- lng: float (WGS84 longitude)

### Edge
- id: UUID
- startVertexId: UUID reference
- endVertexId: UUID reference
- type: EdgeType enum
- lengthFt: float (calculated)

### Facet
- id: UUID
- name: string
- vertexIds: UUID[] (ordered polygon vertices)
- pitch: float (X/12)
- areaSqFt: float (flat projected area)
- trueAreaSqFt: float (pitch-adjusted area)
- edgeIds: UUID[] (associated edges)

### RoofMeasurement (Extended Fields)
- totalFlatAreaSqFt, totalTrueAreaSqFt, totalSquares
- totalRidgeLf, totalHipLf, totalValleyLf, totalRakeLf, totalEaveLf
- totalFlashingLf, totalStepFlashingLf, totalDripEdgeLf
- wasteFactor: number (percentage)
- buildingHeightFt: number (from DSM elevation data)
- stories: number (estimated from building height)
- dataSource: 'lidar-mask' | 'ai-vision' | 'hybrid' | 'manual'
- imageryQuality: 'HIGH' | 'MEDIUM' | 'LOW' (from Solar API)
- solarApiAreaSqFt: number (Google Solar API whole-roof area for cross-validation)
- pitchBreakdown: PitchBreakdown[] (area distribution per pitch)
- ridgeCount, hipCount, valleyCount, rakeCount, eaveCount (edge counts by type)
- structureComplexity: 'Complex' | 'Normal' | 'Simple'

### PitchBreakdown
- pitch: number (X/12)
- areaSqFt: number (total area at this pitch)
- percentage: number (% of total roof)

## 10. Accuracy Scoring
Computed via `computeAccuracyScore()` — 0-100 weighted score across 5 factors:

| Factor | Weight | Scoring |
|--------|--------|---------|
| Data source | 30% | LIDAR+Solar (30) > Hybrid (22) > AI Vision (15) > Manual (8) |
| Imagery quality | 20% | HIGH (20) > MEDIUM (10) > LOW (5) |
| Facet count match | 15% | Measured facets vs Solar API segment count |
| Area cross-validation | 25% | Measured area vs Solar API whole-roof area |
| Pitch consistency | 10% | Low coefficient of variation = more reliable |

Letter grades: A+ (≥95), A (≥90), A- (≥85), B+ (≥80), B (≥75), B- (≥70), C+ (≥65), C (≥60), C- (≥55), D+ (≥50), D (≥45), D (<45)

## 11. Multi-Structure Detection
`detectMultipleStructures()` uses DBSCAN-like spatial clustering of Solar API segments:
- Groups segments by center proximity (configurable `maxGapFt`, default 25ft)
- Returns per-structure breakdown: segment indices, total area, centroid, isPrimary flag
- Integrated into auto-measure pipeline for automatic structure separation

## 12. Accuracy Expectations
| Measurement | Target Accuracy |
|------------|----------------|
| Linear dimensions | ±1-2 ft at 20in GSD imagery |
| Area | ±2-5% of actual (±8.3% mean vs EagleView on 18 calibration properties) |
| Pitch | ±1/12 from LIDAR/DSM, ±2/12 from AI Vision |
| Edge lengths | ±1-2 ft |
| Building height | ±2 ft from DSM elevation data |
