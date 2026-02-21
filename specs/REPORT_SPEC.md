# SkyHawk Report Specification

## Version: 1.0

## Report Types

### 1. Roof Measurement Report (Phase 1)
Primary report for roofing contractors and insurance adjusters.

#### Sections
1. **Header** - SkyHawk branding, company name, report date
2. **Property Information** - Address, coordinates
3. **Roof Measurement Summary** - Total area, squares, pitch, facets, waste
4. **Line Measurements** - Ridge, hip, valley, rake, eave, flashing, drip edge
5. **Facet Details** - Per-facet pitch, flat area, true area, angle
6. **Waste Factor Table** - 5-25% waste calculations
7. **Notes** - User-entered notes
8. **Footer** - Page numbers, generation info, confidentiality notice

#### Format: PDF (Letter size, portrait)
#### Generation: Client-side via jsPDF

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
