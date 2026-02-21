# SkyHawk Measurement Specification

## Version: 1.0

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

## 4. Pitch/Slope
### Definition
Pitch is expressed as X/12 (rise over run in inches per foot).
- 0/12 = Flat (0°)
- 4/12 = Low slope (18.4°)
- 6/12 = Standard (26.6°)
- 8/12 = Moderate (33.7°)
- 12/12 = Steep (45°)
- 24/12 = Very steep (63.4°)

### Pitch Factor (True Area Multiplier)
```
pitchFactor = √(1 + (pitch/12)²)
trueArea = flatArea × pitchFactor
```

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
One roofing square = 100 square feet

## 7. Waste Factor
### Heuristic Algorithm
```
if facets ≤ 2 AND hipsValleys = 0: 5%
if facets ≤ 4 AND hipsValleys ≤ 2: 10%
if facets ≤ 8 AND hipsValleys ≤ 6: 15%
if facets ≤ 12: 20%
else: 25%
```

### Waste Table Calculation
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

## 10. Accuracy Expectations
| Measurement | Target Accuracy |
|------------|----------------|
| Linear dimensions | ±1-2 ft at 20in GSD imagery |
| Area | ±2-5% of actual |
| Pitch | User-specified (future: ±1/12 from AI) |
| Edge lengths | ±1-2 ft |
