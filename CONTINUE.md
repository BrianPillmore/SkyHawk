# SkyHawk Continuation Prompt

## Purpose
This file is the continuation prompt for iterative development of SkyHawk.
Run this prompt at the start of each new Claude session to continue building.

---

## IMMEDIATE NEXT STEPS

### Priority 1: EagleView Report Parity (Visual Gap)
**Plan file**: `plans/active/eagleview-parity-improvements.md`

Our data richness (materials, solar, damage, claims) already exceeds EagleView Premium.
The gap is **visual presentation** — EagleView's PDF opens with a hero wireframe overlay
on satellite imagery. Our PDF is text-only on page 1. Closing this gap makes SkyHawk
reports immediately competitive for contractors and adjusters.

- [x] **Phase 1: Wireframe Screenshot in PDF** (COMPLETE)
  - Hero image moved to page 1 — satellite imagery with wireframe overlay is now the first visual element
  - Confidence badge ("SkyHawk Verified — High/Medium/Standard Confidence") with data source attribution
  - Page reorder: Header → Property Info → Confidence Badge → Hero Image → Overview → Summary → Details
  - Files modified: `reportGenerator.ts`, `ReportPanel.tsx`

- [x] **Phase 2: Labeled Wireframe Diagrams** (COMPLETE)
  - New `src/utils/diagramRenderer.ts` with three diagram renderers:
    - `renderLengthDiagram()` — edges colored by type with length labels at midpoints
    - `renderAreaDiagram()` — facets filled with distinct colors, labeled "#N — XXXX sf" at centroid
    - `renderPitchDiagram()` — facets color-coded green→red by pitch, labeled "X/12"
  - Each diagram: 800x600 canvas, dark background, compass rose, edge/pitch legend
  - Embedded as dedicated PDF pages with title and subtitle
  - Checkboxes in ReportPanel to include/exclude each diagram type
  - 24 unit tests in `tests/unit/diagramRenderer.test.ts`

- [x] **Phase 3: Oblique Imagery** (COMPLETE)
  - New `src/services/imageryApi.ts` — `captureObliqueViews(lat, lng, apiKey)`
  - Fetches 4-direction satellite views (N/S/E/W) via Google Maps Static API with heading offsets
  - Parallel fetch with Promise.allSettled, graceful failure handling
  - Embedded as 2x2 grid page in PDF with direction labels
  - Checkbox in ReportPanel to include/exclude oblique views
  - 18 unit tests in `tests/unit/imageryApi.test.ts`

- [x] **Phase 4: Report Polish & Branding** (COMPLETE)
  - Confidence badge: "SkyHawk Verified — [High/Medium/Standard] Confidence" + data source
  - Facet Details table: added "Squares" column (trueAreaSqFt / 100) per facet
  - Facet Details table: added totals row with blue highlight (flat area, true area, squares)
  - Attribution footer: "Measurements powered by Google Solar API + AI Vision | Imagery © Google"
  - Footer height increased to accommodate dual-line attribution
  - Files modified: `reportGenerator.ts`

- [ ] **Phase 5: Interactive HTML Export** (STRETCH — LOW impact, HIGH effort ~8+ hrs)
  - Self-contained HTML with embedded Google Maps + wireframe overlay
  - Click-to-inspect facets, toggle diagram views
  - Shareable companion to the PDF

### Priority 1b: Accuracy — Solar API Data Layers Integration (COMPLETE)
**LIDAR-first pipeline implemented.** Plan: `C:\Users\brian\.claude\plans\enchanted-humming-feather.md`
- [x] Phase 0: Pitch cap — `clampPitch()` at MAX_RESIDENTIAL_PITCH=24 on all 5 pitch assignment points
- [x] Phase 1: Types + DSM parser — `ParsedDSM`, `DsmFacetAnalysis`, `BuildingHeightAnalysis`; `parseDsmGeoTiff()`
- [x] Phase 2: DSM analysis module — `src/utils/dsmAnalysis.ts` (fitPlane, triangleArea3D, analyzeFacetFromDSM, computeBuildingHeight)
- [x] Phase 3: LIDAR-first pipeline — `useAutoMeasure.ts` rewired: `Promise.allSettled([buildingInsights, dataLayers])` → LIDAR mask outline → DSM 3D pitch/area → AI Vision fallback
- [x] Phase 4: Store integration — prefer `trueArea3DSqFt` when available, store `buildingHeightFt`, `stories`, `dataSource` on measurement
- [x] Phase 5: Tests — 29 new dsmAnalysis tests + 10 clampPitch tests = 39 new tests

### Priority 1c: Accuracy Investigation (COMPLETE)
- [x] Pitch cap at 24/12 (63.4°) prevents extreme area inflation from steep Solar API segments
- [x] Applied `clampPitch()` at all 5 pitch assignment points in `roofReconstruction.ts`
- [x] DSM elevation data now provides ground-truth 3D pitch verification

### Priority 2: PostgreSQL Database & Property Persistence
**Plan file**: `plans/active/database-persistence.md`

All property data currently lives in browser localStorage (Zustand persist). This limits us to
single-device, single-browser, ~5MB max. Need PostgreSQL on the Hetzner VPS to persist all
property data server-side.

- [x] **Phase A: DB Setup & Migrations** (COMPLETE)
  - `server/db/index.ts` — Connection pool (`pg.Pool`) with query helper, transaction wrapper, slow query logging
  - `server/db/migrations/001_initial_schema.sql` — Full schema: 18 tables (users, properties, measurements, vertices, edges, facets, facet_vertices, facet_edges, damage_annotations, image_snapshots, claims, adjusters, inspections, roof_condition_assessments, solar_api_cache, organizations, organization_members, audit_log, api_keys, _migrations)
  - `server/db/migrate.ts` — Migration runner script (reads SQL files, tracks applied migrations)
  - `server/middleware/validate.ts` — Request validation (requireFields, requireUuidParam, parseNumericQuery)
  - Auth updated to support both PostgreSQL and flat-file fallback, with on-the-fly user migration
  - Registration endpoint added (`POST /api/auth/register`)
  - 10 tests in `tests/unit/dbIndex.test.ts`

- [x] **Phase B: Property CRUD API** (COMPLETE)
  - `server/routes/properties.ts` — Full CRUD + damage annotations (list, get, create, update, delete)
  - `server/routes/measurements.ts` — Full measurement graph save (transactional: measurement + vertices + edges + facets + junction tables) and load (assembled with vertex/edge ID mappings)
  - `server/routes/claims.ts` — Claims CRUD + inspection scheduling + inspection updates
  - All endpoints enforce user ownership via JOIN against users table
  - All params use Express 5 safe extraction (handles `string | string[]`)
  - Server entry point updated to mount all new routes with auth middleware
  - DB connection initialized on startup (graceful fallback if DATABASE_URL not set)
  - 11 tests in `tests/unit/serverRoutes.test.ts`, 16 tests in `tests/unit/validate.test.ts`

- [x] **Phase C: Client Sync Layer** (COMPLETE)
  - `src/services/propertyApi.ts` — Full typed API client (properties, measurements, claims, damage, health check)
  - `src/hooks/useSync.ts` — Sync orchestration with optimistic updates, offline queue, exponential backoff retry
  - `pullFromServer()` — Fetch server properties and merge into local Zustand store
  - `pushToServer()` — Push all localStorage properties to server (migration helper)
  - Health check on mount to detect online/offline status
  - 14 tests in `tests/unit/propertyApi.test.ts`

- [ ] **Phase D: Data Migration & Cleanup** (LOW effort ~2-3 hrs)
  - One-time localStorage → server migration on first login
  - Sync status indicator in header (green/yellow/red)
  - Remove property data from localStorage persist whitelist
  - **VPS setup required**: Install PostgreSQL 16, create database, set DATABASE_URL

### Priority 3: Phase 6 — Backend API (Remaining)
Express backend server is deployed (Hetzner VPS at 89.167.94.69) with auth + vision proxy.
Remaining enterprise features:
- REST API endpoints for third-party integration (spec exists in `specs/API_SPEC.md`)
- Server-side RBAC enforcement
- Persist audit logs to database

### Priority 4: Phase 6 — Remaining Enterprise Features
- Multi-user organization accounts
- Report sharing and collaboration
- Webhook notifications
- White-label branding support

### Priority 5: Phase 7 — Drone Integration
**Design document**: `plans/research/PHASE7_Thoughts_On_Drones-aerial-imagery-platform-design.md`

Comprehensive research doc covers hardware (DJI Mavic 3 Enterprise), photogrammetry pipeline
(OpenDroneMap/WebODM), tile serving (TiTiler + COGs), API design, AI analytics layer,
FAA Part 107 requirements, cost estimates, and 4-phase implementation roadmap.

- [ ] FAA Part 107 certification + airspace authorization for Yukon
- [ ] DJI Mavic 3 Enterprise hardware acquisition
- [ ] Drone flight path planning (DJI Pilot 2 / DroneDeploy)
- [ ] Photogrammetry processing pipeline (OpenDroneMap Docker on VPS or cloud compute)
- [ ] COG storage + TiTiler tile server deployment
- [ ] Drone imagery upload, processing, and catalog management
- [ ] High-res orthomosaic generation (sub-1-inch GSD)
- [ ] DSM/DTM elevation data integration
- [ ] AI feature detection on drone imagery (roof condition, vegetation, impervious surfaces)
- [ ] Change detection between captures
- [ ] Integration with SkyHawk measurement engine (replace Google satellite with drone orthomosaic)
- [ ] Autonomous inspection workflows

### Priority 6: Google Solar API Deep Integration (Phases 1-5, 8 COMPLETE)
**Plan file**: `plans/active/google-solar-api-deep-dive.md`

SkyHawk currently uses ~30% of the Solar API's available data. An 8-phase plan to leverage
the remaining 70% for significant accuracy and feature improvements:

- [x] **Phase 1**: Extend type definitions — `SolarPanel`, `SolarPanelConfig`, `SolarFinancialAnalysis`, `SolarMoney`, `SolarSavingsOverTime`, `SolarCashPurchaseSavings`, `SolarFinancedPurchaseSavings`, `SolarLeasingSavings`, `SolarFinancialDetails`, `SolarPanelConfigSegmentSummary` added to `src/types/solar.ts`; `SolarBuildingInsights.solarPotential` extended with optional `solarPanels[]`, `solarPanelConfigs[]`, `financialAnalyses[]`
- [x] **Phase 2**: Panel placement validation — `validatePanelPlacement()` in `shadingAnalysis.ts` uses `solarPanels[]` to count actual panels per segment, detect obstructions (where Google places fewer than area suggests), compute obstruction impact %. UI shows Google vs area-based panel counts and per-segment obstruction detection
- [x] **Phase 3**: API-driven solar calculator — `analyzeSolarPotentialFromApi()` in `solarCalculations.ts` uses Google's `yearlyEnergyDcKwh` (DC→AC with system losses), roof segment summaries for per-facet analysis, falls back to hand-rolled model when API data unavailable. `solarMoneyToNumber()` helper for Google's money format. Store gets `solarInsights` field cached from auto-measure. `SolarPanel.tsx` prefers API data with "Google Solar API" badge. `reportGenerator.ts` uses API data in PDF when available.
- [x] **Phase 4**: Financial analysis integration — Google's `cashPurchaseSavings` (upfront cost, out-of-pocket, rebate, payback years, lifetime savings) and `federalIncentive` from `financialDetails` used when available; falls back to our cost-per-watt model otherwise
- [x] **Phase 5**: Sunshine quantiles — `analyzeSunshineQuantiles()` + `analyzeSegmentShading()` in `shadingAnalysis.ts`. Computes per-segment shading quality (median/max), uniformity (IQR), rating (minimal/low/moderate/high). `ShadingPanel.tsx` shows measured data section, per-segment shading cards, and panel validation
- [ ] **Phase 6**: GeoTIFF flux/shade processing — pixel-accurate energy and shading (most complex)
- [ ] **Phase 7**: DSM-based pitch verification and building height extraction
- [x] **Phase 8**: Panel layout visualization — `solarPanelLayout.ts` computes panel rectangles from API lat/lng/orientation data, `MapView.tsx` renders color-coded panel polygons on satellite imagery (toggle via "Show Panel Layout" button), `reportGenerator.ts` embeds panel layout diagram in PDF. `getPanelColor()` color-codes by energy output (cyan→violet)

### Priority 7: GotRuf.com Marketing Site & Rebrand (PHASE 1 COMPLETE)
**Brand**: GotRuf.com (pronounced "Got Roof")
**Taglines**: "It sure ain't EagleView." / "Check your receipt." / "Home of the first one's free."
**Plan file**: `plans/active/gotruf-marketing-site.md`

Phase 1 — Marketing Pages (COMPLETE, deployed):
- [x] **Landing Page**: Hero, value prop comparison, audience cards, features grid, accuracy guarantee, CTA
- [x] **Persona Pages**: Dedicated pages for 4 personas:
  - Roofing contractors (pain points, ROI calculator, contractor features)
  - Insurance adjusters (accuracy, compliance, claims workflow scenario)
  - Insurance agents/reps (enterprise features, cost comparison table)
  - Homeowners (plain English explanations, trust section, free report)
- [x] **Pricing Page**: 3 tiers ($9.99 single, $99/mo Pro, Enterprise custom), FAQ, accuracy guarantee
- [x] **Signup Page**: Account creation with free first report incentive
- [x] **Branding**: GotRuf orange color scheme, responsive nav + footer, mobile hamburger menu
- [x] **Routes**: All pages under `/gotruf/*` (public, no auth required)
- [x] **Plan file**: `plans/active/gotruf-marketing-site.md`

Phase 2 — Remaining:
- [ ] **Stripe Integration**: Payment processing (Stripe Checkout + webhooks on backend)
- [ ] **Domain Setup**: DNS, nginx, SSL, Google Maps API key for gotruf.com
- [ ] **Logo Design**: Professional logo (currently text-only)
- [ ] **SEO/Social**: Meta tags, Open Graph, structured data
- [ ] **Analytics**: Google Analytics or Plausible integration

### Priority 8: Mobile-Friendly Responsive Design
Make all views responsive and mobile-friendly for field use:
- [x] **Phase A: Responsive Layout** (COMPLETE) — Sidebar renders as bottom sheet overlay on mobile (<md), fixed w-80 on desktop. Header with compact h-12 on mobile, address hidden/truncated. Tab bar scrollable with icon-only on small screens, auto-opens sidebar on tab click. MapView stats overlay hides Facets/Waste on mobile, compact map type selector. Drawing mode and edge start indicators positioned above bottom sheet on mobile with shorter text.
- [x] **Phase B: Touch-Optimized Controls** (COMPLETE) — All interactive elements have min-h-[44px] tap targets (Apple HIG minimum). ToolsPanel uses 2-column grid on mobile, list on desktop. Undo/redo/clear buttons with active states for touch feedback. MeasurementSelector with larger tap targets. Export dropdown with 40px minimum row height. Keyboard shortcuts section hidden on mobile (no keyboard). Active states (`active:bg-*`) added for touch feedback throughout.
- [ ] **Phase C: Mobile Measurement UX** — Simplified toolbar for mobile, pinch-to-zoom map
- [ ] **Phase D: Field-Ready PWA** — Service worker for offline, installable app, camera integration
- [ ] **Phase E: Tablet Layout** — Split-view optimized for iPad/Android tablet landscape mode

### Priority 9: Phase 8 — Commercial Properties
- Large commercial roof support
- Multi-section commercial reports
- Flat roof drainage analysis
- Commercial material estimation
- Parapet and coping measurements

---

## CONTINUATION PROTOCOL

You are continuing development on **SkyHawk**, an aerial property intelligence
platform that is an alternative to EagleView for the roofing and insurance
adjustment industry.

### Step 1: Assess Current State

Read and understand these files (in order):
1. `ROADMAP.md` — Current feature roadmap and phase status
2. `plans/` — Phase plans (check which are COMPLETE vs PLANNED)
3. `specs/` — Technical specifications
4. `.claude/settings.json` — Project configuration
5. Run `npm run build` to verify current state compiles

### Step 2: Identify Next Work

Check the **IMMEDIATE NEXT STEPS** section above first. If those are complete,
follow the roadmap for the next uncompleted feature.

Priority order within each phase:
1. Core functionality first
2. Integration with existing features
3. UI polish and edge cases
4. Tests
5. Documentation updates

### Step 3: Plan the Work

Before writing code:
1. Read the relevant phase plan in `plans/`
2. Read relevant specs in `specs/`
3. Identify which files need to be created or modified
4. Write a brief implementation plan
5. Get user confirmation if the change is significant

### Step 4: Implement

Follow these conventions:
- **Types first**: Add types to `src/types/index.ts` or `src/types/solar.ts`
- **Logic second**: Implement utilities/calculations
- **Store third**: Add state and actions to Zustand store
- **Components fourth**: Build React components
- **Wire last**: Connect to routes and existing UI

Code standards:
- TypeScript strict mode
- Functional React components
- Tailwind CSS for styling
- Pure functions for calculations
- One component per file

### Step 5: Test

1. Add unit tests to `tests/unit/`
2. Run `npx vitest run tests/unit/` to verify
3. Run `npm run build` to verify compilation

### Step 6: Verify (KAREN Protocol)

Run the KAREN verification checklist:
1. All claimed files exist with correct content
2. TypeScript compiles without errors
3. Tests pass
4. Specs are updated
5. Documentation is current

### Step 7: Update Documentation

1. Update phase plan status (COMPLETE when done)
2. Update ROADMAP.md checkboxes
3. Update any affected specs
4. Add to CHANGELOG if significant

### Step 8: Commit

Create a descriptive commit with format:
```
feat(scope): description of what was added
fix(scope): description of what was fixed
refactor(scope): description of restructuring
docs(scope): description of doc changes
test(scope): description of test additions
```

---

## CURRENT STATE SUMMARY

### Completed — Phases 1 through 5 (KAREN Verified)

- [x] **Phase 1: Core Measurement Engine** (ALL features COMPLETE)
  - Interactive satellite map (Google Maps JavaScript API)
  - Address search (Google Places autocomplete)
  - Roof outline polygon drawing
  - Multi-facet support with per-facet pitch
  - Ridge/hip/valley/rake/eave/flashing line drawing
  - Area calculation (Haversine + Shoelace formula)
  - Pitch-adjusted true area
  - Waste factor calculation
  - PDF report generation (jsPDF)
  - Dashboard with property management
  - Keyboard shortcuts
  - Full Zustand state management with localStorage persistence
  - Add Property button (clickable empty state + button)

- [x] **Phase 2: Enhanced Measurement & 3D** (ALL features COMPLETE)
  - Multi-facet 3D roof visualization (RoofViewer3D.tsx)
  - Real-time 3D preview during measurement
  - Roof pitch angle visualization (PitchDiagram.tsx)
  - Measurement mode selector (MeasurementSelector.tsx)
  - Undo/redo functionality
  - Local storage persistence
  - Material cost estimator (materials.ts)
  - Measurement import/export (exportData.ts)
  - Before/after comparison tool (ComparisonPanel.tsx)
  - Map capture utility (mapCapture.ts)
  - ESX format export (esxExport.ts)
  - Automatic pitch detection (pitchDetection.ts)
  - Walls, windows, and doors measurement (wallCalculations.ts, WallsPanel.tsx)
  - Full-house measurement reports

- [x] **Phase 3: Insurance & Claims Workflow** (ALL features COMPLETE)
  - Damage annotation system (DamagePanel.tsx)
  - Insurance estimator integration
  - Adjuster collaboration panel (AdjusterPanel.tsx)
  - Claims workflow panel (ClaimsPanel.tsx)
  - Photo documentation attachment
  - Timeline tracking
  - Multi-party comments
  - Xactimate-compatible ESX export

- [x] **Phase 4: Advanced Analytics & AI** (ALL features COMPLETE)
  - AI-powered roof detection (visionApi.ts)
  - Automatic roof outline extraction (contour.ts, roofReconstruction.ts)
  - Damage severity classification (visionApi.ts → analyzeRoofCondition)
  - Roof condition scoring 1-100 (roofCondition.ts, ConditionPanel.tsx)
  - Age estimation from imagery (AI-powered via Claude Vision)
  - Material type detection (10 types: asphalt-shingle, metal, tile, slate, wood-shake, tpo, epdm, built-up, concrete, unknown)
  - Condition analysis button in ToolsPanel (AnalyzeConditionButton.tsx)

- [x] **Phase 5: Solar Integration** (ALL features COMPLETE)
  - Solar panel placement UI (SolarPanel.tsx)
  - Production estimates (solarCalculations.ts)
  - Solar-ready reports with PDF export (reportGenerator.ts)
  - Shading analysis (shadingAnalysis.ts, ShadingPanel.tsx)
  - Sun path simulation (sunPath.ts)
  - Monthly production bar charts in PDF

- [x] **Auto-Measurement Feature** (ALL 10 steps COMPLETE)
  - Solar API types (solar.ts)
  - Solar API client (solarApi.ts)
  - GeoTIFF contour algorithms (contour.ts)
  - Geometry helpers (geometryHelpers.ts)
  - Roof reconstruction (roofReconstruction.ts)
  - AI Vision fallback (visionApi.ts)
  - Store batch actions (applyAutoMeasurement in useStore.ts)
  - React hook (useAutoMeasure.ts)
  - UI components (AutoMeasureButton.tsx in ToolsPanel.tsx)
  - Map overlay (progress tracking in MapView.tsx)

### Partially Complete

- [ ] **Phase 6: Enterprise & Collaboration** (2/7 features)
  - ✅ Role-based access control frontend (EnterprisePanel.tsx, enterprise.ts)
  - ✅ Audit trail frontend (logs shown in UI)
  - ⏸️ Backend API (NOT DONE — frontend-only, spec exists in API_SPEC.md)
  - ⏸️ Multi-user collaboration (NOT DONE — requires backend)
  - ⏸️ Report sharing (NOT DONE — requires backend)
  - ⏸️ Webhooks (NOT DONE — requires backend)
  - ⏸️ White-label branding (NOT DONE)

### Not Started
- [ ] **Phase 7: Drone Integration**
- [ ] **Phase 8: Commercial Properties**

### EagleView Calibration (COMPLETE — Phases 1-7)
Systematic calibration of SkyHawk against 18 EagleView Premium Reports:
- [x] Phase 1: Extracted all 18 EagleView ground truth records to `tests/fixtures/eagleview-calibration.json`
- [x] Phase 2-3: Analyzed pipeline deviations and built comparison matrix
- [x] Phase 4: Root cause analysis — identified waste algorithm, edge counting, structure complexity gaps
- [x] Phase 5-7: Implemented improvements:
  - Multi-factor waste algorithm (facet count + hip/valley + ridge + rake thresholds)
  - Dynamic waste table intervals: `[0, W-25, W-20, W-17, W-15, W-13, W-10, W-5, W]`
  - 1/3 square rounding convention: `Math.ceil(rawSquares * 3) / 3`
  - Structure complexity classification (Complex/Normal/Simple)
  - Edge counts tracked per type on RoofMeasurement
  - Pitch breakdown and estimated attic sqft fields
  - Flashing and step-flashing tracked separately
  - Multi-facet roof reconstruction via Voronoi partition of Solar API segments
  - Regression test suite: 17 tests across 18 EagleView properties
- [ ] Phase 8: Report format parity (diagrams, TOC, oblique images) — NOT STARTED
- [ ] Phase 9: Mocked Solar API regression pipeline — PARTIAL (fixture-based regression exists)

### Backend Deployment (PARTIAL)
Express backend deployed to Hetzner VPS (89.167.94.69):
- [x] Auth middleware (JWT + bcrypt)
- [x] Vision API proxy (Claude edge detection)
- [x] Nginx reverse proxy with SSL
- [x] Trust proxy configuration
- [x] Property CRUD API (server/routes/properties.ts, measurements.ts, claims.ts)
- [x] Database schema + migration runner (server/db/)
- [x] Client-side API layer + sync hook (src/services/propertyApi.ts, src/hooks/useSync.ts)
- [ ] PostgreSQL installation on VPS — NOT DONE (requires SSH access)
- [ ] Data migration from localStorage — NOT DONE (Phase D)

### API Cost Per Property (~$0.05-0.06 beyond free tier)
| API | Cost/Call | Free/Month |
|-----|----------|------------|
| Solar Building Insights | $0.01 | 10,000 |
| Anthropic Claude (dominant) | ~$0.029 | None |
| Static Maps | $0.002 | 10,000 |
| Maps JS + Places | ~$0.01 | 10,000 each |
| Solar Data Layers | $0.075 | 1,000 (NOW USED — LIDAR pipeline) |

### Known Issues
- **Enterprise features are frontend-only**: RBAC and audit trail work in browser but have no backend enforcement. Server-side auth and database persistence needed.
- **API integration is spec-only**: API key management UI exists in `EnterprisePanel.tsx` but no actual backend API endpoints are implemented.
- **reconstructComplexRoof creates 1 facet**: When all Solar API segment centers are identical or very close, the Voronoi partition assigns all vertices to one segment — affects properties where Google reports overlapping segments.
- **Waste algorithm divergence**: Our waste calculation uses structural heuristics but differs from EagleView's proprietary algorithm. Mean error ~±10%, max ±15% on the 18 calibration properties.

### EagleView vs Solar API Regression Results (Feb 2026)
Ran all 18 EagleView calibration addresses through Google Solar API `buildingInsights`.
Script: `scripts/eagleview-regression.py` | Results: `tests/fixtures/solar-api-comparison.json`

**Area accuracy (raw Solar API vs EagleView ground truth):**
- Within 5%: 9/18 (50%) | Within 10%: 14/18 (78%) | Within 15%: 16/18 (89%)
- Mean absolute diff: 8.3% | Median: 5.1%
- Predominant pitch match: 16/18 (89%)
- Solar API consistently has fewer segments than EagleView facets (mean -8.3)

**FAIL cases (both MEDIUM quality imagery):**
- 702 S Williams Ave, El Reno (-43.9%) — tiny house, MEDIUM quality, pitch also wrong
- 112 Pickard Dr, Mcloud (-22.9%) — MEDIUM quality, mixed low-pitch sections unresolved

**Recommended iterations:**
1. **Flag MEDIUM quality in the UI** — warn users about reduced accuracy when Solar API returns MEDIUM quality imagery instead of HIGH
2. **Fix `reconstructComplexRoof`** — the critical bottleneck; Solar API area data is good but our reconstruction creates 1 facet instead of many for 16/18 properties, making edge lengths (ridge/hip/valley/rake/eave) completely wrong
3. **Use Solar API area directly as fallback** — when reconstruction fails or produces bad results, fall back to summing Solar API segment areas directly (already within 5% for half the properties)

---

## TECH STACK

- React 19 + TypeScript 5.9 + Vite 7
- Tailwind CSS v4
- Zustand 5 (state management with localStorage persistence)
- Google Maps JavaScript API (satellite imagery, Places, Geocoding)
- Google Solar API (building insights + LIDAR data layers)
- Anthropic Claude API (claude-sonnet-4-5-20250929 — AI Vision)
- Three.js + React Three Fiber + Drei (3D visualization)
- jsPDF + html2canvas (PDF generation)
- geotiff (GeoTIFF parsing for LIDAR data)
- React Router v7
- Vitest (1539 tests across 56 files)
- Express.js backend (deployed on Hetzner VPS at 89.167.94.69)

---

## API KEYS & SERVICES

All keys are configured in `.env` (gitignored, not committed):

| Service | Env Variable | Status | Purpose |
|---------|-------------|--------|---------|
| Google Maps | `VITE_GOOGLE_MAPS_API_KEY` | CONFIGURED | Satellite imagery, Places autocomplete, Geocoding |
| Google Solar API | Same key as Maps | ENABLED | Building detection, roof segments, LIDAR data layers |
| Anthropic Claude | `VITE_ANTHROPIC_API_KEY` | CONFIGURED | AI Vision fallback for roof detection + condition analysis |

### Google Cloud APIs Required (all enabled)
- Maps JavaScript API
- Places API
- Geocoding API
- Solar API

---

## KEY FILES REFERENCE

### Core Application
| Purpose | File |
|---------|------|
| Entry point | `src/main.tsx` |
| App router | `src/App.tsx` |
| Types | `src/types/index.ts` |
| State store | `src/store/useStore.ts` |
| Geometry math | `src/utils/geometry.ts` |
| Geometry helpers | `src/utils/geometryHelpers.ts` |
| Color mappings | `src/utils/colors.ts` |
| PDF generator | `src/utils/reportGenerator.ts` |
| Map component | `src/components/map/MapView.tsx` |
| Address search | `src/components/map/AddressSearch.tsx` |
| Placeholder map | `src/components/map/PlaceholderMap.tsx` |
| Tools panel | `src/components/measurement/ToolsPanel.tsx` |
| Measurements | `src/components/measurement/MeasurementsPanel.tsx` |
| Measurement selector | `src/components/measurement/MeasurementSelector.tsx` |
| Report panel | `src/components/reports/ReportPanel.tsx` |
| Dashboard | `src/components/dashboard/Dashboard.tsx` |
| Header | `src/components/layout/Header.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Workspace page | `src/pages/Workspace.tsx` |
| Google Maps hook | `src/hooks/useGoogleMaps.ts` |
| Keyboard shortcuts | `src/hooks/useKeyboard.ts` |

### Measurement & Visualization
| Purpose | File |
|---------|------|
| 3D roof viewer | `src/components/measurement/RoofViewer3D.tsx` |
| Pitch diagram | `src/components/measurement/PitchDiagram.tsx` |
| Damage annotations | `src/components/measurement/DamagePanel.tsx` |
| Auto-measure button | `src/components/measurement/AutoMeasureButton.tsx` |
| Condition panel | `src/components/measurement/ConditionPanel.tsx` |
| Analyze condition | `src/components/measurement/AnalyzeConditionButton.tsx` |
| Walls panel | `src/components/measurement/WallsPanel.tsx` |
| Auto-measure hook | `src/hooks/useAutoMeasure.ts` |
| Material calculations | `src/utils/materials.ts` |
| Wall calculations | `src/utils/wallCalculations.ts` |
| Pitch detection | `src/utils/pitchDetection.ts` |
| Roof condition | `src/utils/roofCondition.ts` |
| Map capture utility | `src/utils/mapCapture.ts` |
| Diagram renderer | `src/utils/diagramRenderer.ts` |
| Export data utility | `src/utils/exportData.ts` |
| ESX format export | `src/utils/esxExport.ts` |

### AI & Automation
| Purpose | File |
|---------|------|
| Solar API types | `src/types/solar.ts` |
| Solar API client | `src/services/solarApi.ts` |
| Vision API (Claude) | `src/services/visionApi.ts` |
| Oblique imagery | `src/services/imageryApi.ts` |
| Contour algorithms | `src/utils/contour.ts` |
| Roof reconstruction | `src/utils/roofReconstruction.ts` |
| Solar calculations | `src/utils/solarCalculations.ts` |
| Shading analysis | `src/utils/shadingAnalysis.ts` |
| Sun path simulation | `src/utils/sunPath.ts` |
| DSM analysis | `src/utils/dsmAnalysis.ts` |

### Database & API
| Purpose | File |
|---------|------|
| DB connection pool | `server/db/index.ts` |
| Schema migration SQL | `server/db/migrations/001_initial_schema.sql` |
| Migration runner | `server/db/migrate.ts` |
| Validation middleware | `server/middleware/validate.ts` |
| Property CRUD routes | `server/routes/properties.ts` |
| Measurement CRUD routes | `server/routes/measurements.ts` |
| Claims CRUD routes | `server/routes/claims.ts` |
| Client API service | `src/services/propertyApi.ts` |
| Sync orchestration | `src/hooks/useSync.ts` |

### Claims & Enterprise
| Purpose | File |
|---------|------|
| Claims panel | `src/components/claims/ClaimsPanel.tsx` |
| Adjuster panel | `src/components/claims/AdjusterPanel.tsx` |
| Comparison tool | `src/components/comparison/ComparisonPanel.tsx` |
| Enterprise panel | `src/components/enterprise/EnterprisePanel.tsx` |
| Solar analysis | `src/components/solar/SolarPanel.tsx` |
| Shading analysis | `src/components/solar/ShadingPanel.tsx` |
| Enterprise types | `src/types/enterprise.ts` |
| Enterprise utilities | `src/utils/enterprise.ts` |

### Plans & Specs
| Document | File | Status |
|----------|------|--------|
| Auto-Measurement Plan | `plans/completed/AUTO_MEASUREMENT.md` | COMPLETE |
| Phase 1 (Core) | `plans/completed/PHASE1_CORE_MEASUREMENT.md` | COMPLETE |
| Phase 2 (3D) | `plans/completed/PHASE2_3D_ENHANCED.md` | COMPLETE |
| Phase 3 (Insurance) | `plans/completed/PHASE3_INSURANCE.md` | COMPLETE |
| Phase 4 (AI) | `plans/completed/PHASE4_AI.md` | COMPLETE |
| EagleView Calibration | `plans/completed/EAGLEVIEW_CALIBRATION_PROMPT.md` | Phases 1-7 COMPLETE |
| GotRuf Marketing Site | `plans/active/gotruf-marketing-site.md` | Phase 1 COMPLETE |
| EagleView Parity Plan | `plans/active/eagleview-parity-improvements.md` | Phases 1-4 COMPLETE |
| Database Persistence | `plans/active/database-persistence.md` | Phases A-C COMPLETE |
| Google Solar API Deep Dive | `plans/active/google-solar-api-deep-dive.md` | NEW |
| Drone Integration | `plans/research/PHASE7_Thoughts_On_Drones-aerial-imagery-platform-design.md` | RESEARCH ONLY |
| API Spec | `specs/API_SPEC.md` | |
| Measurement Spec | `specs/MEASUREMENT_SPEC.md` | |
| Report Spec | `specs/REPORT_SPEC.md` | |
| Feature Roadmap | `ROADMAP.md` | |

### Tests (1539 passing tests across 56 files)
| Purpose | File |
|---------|------|
| Geometry calculations | `tests/unit/geometry.test.ts` |
| Geometry extended | `tests/unit/geometry-extended.test.ts` |
| Geometry helpers | `tests/unit/geometryHelpers.test.ts` |
| State store | `tests/unit/store.test.ts` |
| State store extended | `tests/unit/store-extended.test.ts` |
| State auth | `tests/unit/storeAuth.test.ts` |
| State roof condition | `tests/unit/storeRoofCondition.test.ts` |
| Contour algorithms | `tests/unit/contour.test.ts` |
| Roof reconstruction | `tests/unit/roofReconstruction.test.ts` |
| Solar calculations | `tests/unit/solarCalculations.test.ts` |
| Materials calculations | `tests/unit/materials.test.ts` |
| Materials extended | `tests/unit/materials-extended.test.ts` |
| Export data utility | `tests/unit/exportData.test.ts` |
| ESX export format | `tests/unit/esxExport.test.ts` |
| Map capture | `tests/unit/mapCapture.test.ts` |
| Enterprise utilities | `tests/unit/enterprise.test.ts` |
| Report generator | `tests/unit/reportGenerator.test.ts` |
| Claims management | `tests/unit/claims.test.ts` |
| Adjuster scheduling | `tests/unit/adjuster.test.ts` |
| Vision API | `tests/unit/visionApi.test.ts` |
| Solar API | `tests/unit/solarApi.test.ts` |
| Roof condition | `tests/unit/roofCondition.test.ts` |
| Pitch detection | `tests/unit/pitchDetection.test.ts` |
| Wall calculations | `tests/unit/wallCalculations.test.ts` |
| Shading analysis | `tests/unit/shadingAnalysis.test.ts` |
| Sun path | `tests/unit/sunPath.test.ts` |
| Edge detection | `tests/unit/detectRoofEdges.test.ts` |
| Facet building | `tests/unit/buildFacetsFromEdges.test.ts` |
| Edge type updates | `tests/unit/updateEdgeType.test.ts` |
| Analyze condition | `tests/unit/analyzeRoofCondition.test.ts` |
| Color utilities | `tests/unit/colors.test.ts` |
| EagleView regression | `tests/unit/eagleviewRegression.test.ts` |
| DSM analysis | `tests/unit/dsmAnalysis.test.ts` |
| Diagram renderer | `tests/unit/diagramRenderer.test.ts` |
| Imagery API | `tests/unit/imageryApi.test.ts` |
| DB connection pool | `tests/unit/dbIndex.test.ts` |
| Validation middleware | `tests/unit/validate.test.ts` |
| Property API client | `tests/unit/propertyApi.test.ts` |
| Server route patterns | `tests/unit/serverRoutes.test.ts` |
| Dashboard component | `tests/unit/Dashboard.test.tsx` |

Run tests with: `npx vitest run`

---

## AGENT TEAM

| Agent | Role | File |
|-------|------|------|
| KAREN | QA verification | `.claude/agents/KAREN.md` |
| ARCHITECT | System design | `.claude/agents/ARCHITECT.md` |
| BUILDER | Implementation | `.claude/agents/BUILDER.md` |
| TESTER | Test engineering | `.claude/agents/TESTER.md` |
| REVIEWER | Code review | `.claude/agents/REVIEWER.md` |
