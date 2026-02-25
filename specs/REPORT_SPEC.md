# SkyHawk Report Specification

## Version: 2.0

## Report Types

### 1. Roof Measurement Report — **IMPLEMENTED** (Primary)
Primary report for roofing contractors and insurance adjusters.

#### Sections (All Implemented)
1. **Header** — GotRuf branding, report date, confidence badge
2. **Property Information** — Address, coordinates, property details
3. **Table of Contents** — Auto-generated with page numbers and dotted leaders
4. **Key Metrics Summary** — Dedicated page 3 with summary grid
5. **Confidence Badge** — "SkyHawk Verified — [High/Medium/Standard] Confidence" + data source attribution
6. **Hero Image** — Satellite imagery with wireframe overlay (page 1)
7. **Roof Measurement Summary** — Total area, squares, pitch, facets, waste
8. **Line Measurements** — Ridge, hip, valley, rake, eave, flashing, step-flashing, drip edge
9. **Facet Details** — Per-facet pitch, flat area, true area, angle, squares (with totals row)
10. **Areas Per Pitch** — Breakdown of roof area by pitch value
11. **Material Estimates** — 17 material items including waste factor calculations (5-25%)
12. **Waste Factor Table** — Dynamic intervals showing squares needed at each waste level
13. **Edge Measurements** — Detailed breakdown by edge type with lengths
14. **Wireframe Diagrams** — Length diagram, area diagram, pitch diagram (optional, togglable)
15. **Oblique Views** — 4-direction satellite views in 2x2 grid (N/S/E/W, optional)
16. **Roof Condition Assessment** — AI-analyzed condition score, findings, remaining life
17. **Multi-Structure Support** — Separate sections per detected structure
18. **Map Screenshots** — Satellite imagery (via html2canvas)
19. **Solar Potential Analysis** — System summary, environmental impact, per-facet analysis, monthly production chart, panel layout diagram
20. **Claims Information** — If damage/claims data exists
21. **Notes** — User-entered notes and observations
22. **Appendix: Methodology** — Accuracy scoring breakdown, data sources, measurement methodology, disclaimer
23. **Footer** — Page numbers, generation timestamp, dual-line attribution

#### Report Options (ReportPanel checkboxes)
```typescript
interface ReportOptions {
  includeDamage?: boolean;
  includeClaims?: boolean;
  includeMultiStructure?: boolean;
  includeSolar?: boolean;
  includeLengthDiagram?: boolean;
  includeAreaDiagram?: boolean;
  includePitchDiagram?: boolean;
  includeObliqueViews?: boolean;
  includeSolarPanelLayout?: boolean;
  lengthDiagramImage?: string;
  areaDiagramImage?: string;
  pitchDiagramImage?: string;
  obliqueViews?: { north?: string; south?: string; east?: string; west?: string };
  roofCondition?: RoofConditionAssessment;
}
```

#### Format: PDF (Letter size, portrait)
#### Generation: Client-side via jsPDF + html2canvas

### 2. Interactive HTML Export — **IMPLEMENTED**
Self-contained HTML with embedded Google Maps + wireframe overlay.
- Click-to-inspect facets, toggle diagram views
- Shareable companion to the PDF
- Generated via `htmlReportExporter.ts` + `htmlReportTemplate.ts`

### 3. Full House Report (Phase 2) — **IMPLEMENTED**
Comprehensive report including roof + walls + windows + doors.

### 4. Insurance Claims Report (Phase 3) — **IMPLEMENTED**
Report with damage assessment, claim status, adjuster info, and Xactimate-compatible ESX export.

### 5. Solar Readiness Report (Phase 5) — **IMPLEMENTED**
Integrated into the main PDF report with system summary, per-facet analysis, monthly production, financial analysis, and panel layout visualization.

## PDF Specifications
- Page size: Letter (8.5" x 11")
- Margins: 15mm all sides
- Fonts: Helvetica (built-in to jsPDF)
- Colors: Primary blue (#2578eb / rgb 37,120,235), dark text (#1e1e1e / rgb 30,30,30), gray (#787878 / rgb 120,120,120)
- Tables: Alternating row backgrounds, blue headers
- Max facets per page: ~8 (with auto page breaks)
- TOC: Dotted leaders between title and page number
- Page templates: EagleView-style headers/footers/page numbers

## Material Estimates (17 items)
- Shingles (bundles)
- Felt/underlayment (rolls)
- Ice & water shield (rolls)
- Drip edge (10ft pieces)
- Starter strip (rolls)
- Ridge cap (bundles)
- Roofing nails (boxes)
- Pipe boots
- Step flashing
- Ridge vent (4ft pieces)
- Hip & ridge bundles
- Valley metal (linear feet)
- Sheathing sheets (4x8)
- Coil nail boxes
- Roof-to-wall flashing (10ft pieces)
- Squares at various waste levels
- Waste factor percentage

## Data Included
- All measurement values from RoofMeasurement data model
- Accuracy score with 5-factor breakdown and letter grade
- Calculated waste table (dynamic intervals)
- Edge counts by type
- Pitch in both X/12 and degrees format
- Pitch breakdown by area
- Building height and stories (when available from LIDAR)
- Solar potential data (when available from Google Solar API)
- Timestamps and report metadata
