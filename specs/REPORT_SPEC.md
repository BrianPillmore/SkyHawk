# SkyHawk Report Specification

## Version: 1.0

## Report Types

### 1. Roof Measurement Report (Phase 1) - **IMPLEMENTED**
Primary report for roofing contractors and insurance adjusters.

#### Sections (Currently Implemented)
1. **Header** - SkyHawk branding, company name, report date
2. **Property Information** - Address, coordinates, property details
3. **Roof Measurement Summary** - Total area, squares, pitch, facets, waste
4. **Line Measurements** - Ridge, hip, valley, rake, eave, flashing, step-flashing, drip edge
5. **Facet Details** - Per-facet pitch, flat area, true area, angle
6. **Material Estimates** - Includes waste factor calculations (5-25%)
7. **Waste Factor Table** - 5-25% waste calculations showing squares needed at each waste level
8. **Edge Measurements** - Detailed breakdown by edge type with lengths
9. **Multi-Structure Support** - Can include measurements from multiple structures on the same property
10. **Map Screenshots** - Satellite imagery of the property (via html2canvas integration)
11. **Claims Information** - If damage/claims data exists for the property
12. **Notes** - User-entered notes and observations
13. **Footer** - Page numbers, generation timestamp, confidentiality notice

#### Format: PDF (Letter size, portrait)
#### Generation: Client-side via jsPDF + html2canvas

#### Not Yet Included
- **Solar Analysis**: Solar panel potential data from Google Solar API is NOT yet integrated into PDF reports (pending integration)

### 2. Full House Report (Phase 2 - Planned)
Comprehensive report including roof + walls + windows + doors.

### 3. Insurance Claims Report (Phase 3 - Planned)
Report tailored for insurance adjusters with damage assessment.

### 4. Solar Readiness Report (Phase 5 - Planned)
Report for solar installers with roof analysis and shading data.

## PDF Specifications
- Page size: Letter (8.5" x 11")
- Margins: 15mm all sides
- Fonts: Helvetica (built-in to jsPDF)
- Colors: Primary blue (#2578eb), dark text (#1e1e1e), gray (#787878)
- Tables: Alternating row backgrounds, blue headers
- Max facets per page: ~8 (with auto page breaks)

## Data Included
- All measurement values from RoofMeasurement data model
- Calculated waste table (7 rows)
- Edge counts by type
- Pitch in both X/12 and degrees format
- Timestamps and report metadata
