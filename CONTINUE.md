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

- [x] **Phase 5: Interactive HTML Export** (COMPLETE)
  - Self-contained HTML with embedded Google Maps + wireframe overlay
  - Click-to-inspect facets, toggle diagram views
  - Shareable companion to the PDF
  - Files: `src/utils/htmlReportExporter.ts`, `src/utils/htmlReportTemplate.ts`
  - "Export Interactive HTML" button added to ReportPanel
  - 39 tests in `tests/unit/htmlReportExporter.test.ts`

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

- [x] **Phase D: Data Migration & Cleanup** (COMPLETE)
  - One-time localStorage → server migration on first login via `src/utils/dataMigration.ts`
  - Sync status indicator in header (green/yellow/red dot) in `Header.tsx`
  - Property data removed from localStorage persist whitelist in `useStore.ts`
  - 11 tests in `tests/unit/dataMigration.test.ts`
  - **VPS setup required**: Install PostgreSQL 16, create database, set DATABASE_URL

### Priority 3: Phase 6 — Backend API (COMPLETE)
Express backend server is deployed (Hetzner VPS at 89.167.94.69) with auth + vision proxy.
Enterprise features implemented:
- [x] REST API endpoints: `server/routes/apiKeys.ts`, `server/routes/reports.ts`, `server/routes/audit.ts`
- [x] Server-side RBAC enforcement: `server/middleware/rbac.ts` with role hierarchy (admin > manager > adjuster > roofer > viewer)
- [x] Audit logging middleware: `server/middleware/auditLog.ts` (logs all mutating requests)
- [x] API key authentication: `server/middleware/apiKeyAuth.ts` (X-API-Key header support)
- [x] Tests: `tests/unit/rbac.test.ts`, `tests/unit/apiKeys.test.ts`, `tests/unit/auditLog.test.ts`

### Priority 4: Phase 6 — Enterprise Features (COMPLETE)
- [x] Multi-user organization accounts — `server/routes/organizations.ts`, `src/components/enterprise/OrganizationPanel.tsx`
- [x] Report sharing and collaboration — `server/routes/sharing.ts`, `src/components/enterprise/SharingPanel.tsx`
- [x] Webhook notifications — `server/routes/webhooks.ts`, `src/components/enterprise/WebhookPanel.tsx`
- [x] White-label branding support — `src/components/enterprise/WhiteLabelPanel.tsx`, `server/db/migrations/002_enterprise.sql`
- [x] Enterprise API client — `src/services/enterpriseApi.ts`
- [x] Tests: `tests/unit/organizations.test.ts`, `tests/unit/sharing.test.ts`

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

### Priority 6: Google Solar API Deep Integration (Phases 1-8 COMPLETE)
**Plan file**: `plans/completed/google-solar-api-deep-dive.md`

SkyHawk currently uses ~30% of the Solar API's available data. An 8-phase plan to leverage
the remaining 70% for significant accuracy and feature improvements:

- [x] **Phase 1**: Extend type definitions — `SolarPanel`, `SolarPanelConfig`, `SolarFinancialAnalysis`, `SolarMoney`, `SolarSavingsOverTime`, `SolarCashPurchaseSavings`, `SolarFinancedPurchaseSavings`, `SolarLeasingSavings`, `SolarFinancialDetails`, `SolarPanelConfigSegmentSummary` added to `src/types/solar.ts`; `SolarBuildingInsights.solarPotential` extended with optional `solarPanels[]`, `solarPanelConfigs[]`, `financialAnalyses[]`
- [x] **Phase 2**: Panel placement validation — `validatePanelPlacement()` in `shadingAnalysis.ts` uses `solarPanels[]` to count actual panels per segment, detect obstructions (where Google places fewer than area suggests), compute obstruction impact %. UI shows Google vs area-based panel counts and per-segment obstruction detection
- [x] **Phase 3**: API-driven solar calculator — `analyzeSolarPotentialFromApi()` in `solarCalculations.ts` uses Google's `yearlyEnergyDcKwh` (DC→AC with system losses), roof segment summaries for per-facet analysis, falls back to hand-rolled model when API data unavailable. `solarMoneyToNumber()` helper for Google's money format. Store gets `solarInsights` field cached from auto-measure. `SolarPanel.tsx` prefers API data with "Google Solar API" badge. `reportGenerator.ts` uses API data in PDF when available.
- [x] **Phase 4**: Financial analysis integration — Google's `cashPurchaseSavings` (upfront cost, out-of-pocket, rebate, payback years, lifetime savings) and `federalIncentive` from `financialDetails` used when available; falls back to our cost-per-watt model otherwise
- [x] **Phase 5**: Sunshine quantiles — `analyzeSunshineQuantiles()` + `analyzeSegmentShading()` in `shadingAnalysis.ts`. Computes per-segment shading quality (median/max), uniformity (IQR), rating (minimal/low/moderate/high). `ShadingPanel.tsx` shows measured data section, per-segment shading cards, and panel validation
- [x] **Phase 6**: GeoTIFF flux/shade processing (COMPLETE) — `src/utils/fluxAnalysis.ts` (parseFluxGeoTiff, analyzeFluxForFacets, analyzeShading), `src/components/solar/FluxMapPanel.tsx`, types added to `solar.ts`, 23 tests in `tests/unit/fluxAnalysis.test.ts`
- [x] **Phase 7**: DSM-based pitch verification and building height extraction (COMPLETE) — `src/utils/dsmPitchVerification.ts` (verifyPitchFromDSM, extractBuildingHeightFromDSM), wired into `useAutoMeasure.ts`, 18 tests in `tests/unit/dsmPitchVerification.test.ts`
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

Phase 2 — Partially Complete:
- [x] **Stripe Integration**: `server/routes/checkout.ts` (Stripe Checkout sessions + webhook handler), `src/services/stripeApi.ts`, CheckoutSuccess/CheckoutCancel pages, tests in `tests/unit/checkout.test.ts`
- [ ] **Domain Setup**: DNS, nginx, SSL, Google Maps API key for gotruf.com (requires server access)
- [ ] **Logo Design**: Professional logo (currently text-only)
- [x] **SEO/Social**: `src/utils/seo.ts` (meta tags, Open Graph, structured data), integrated in MarketingLayout, tests in `tests/unit/seo.test.ts`
- [x] **Analytics**: `src/utils/analytics.ts` (GA4 + Plausible support, GDPR consent), tests in `tests/unit/analytics.test.ts`

### Priority 8: Mobile-Friendly Responsive Design
Make all views responsive and mobile-friendly for field use:
- [x] **Phase A: Responsive Layout** (COMPLETE) — Sidebar renders as bottom sheet overlay on mobile (<md), fixed w-80 on desktop. Header with compact h-12 on mobile, address hidden/truncated. Tab bar scrollable with icon-only on small screens, auto-opens sidebar on tab click. MapView stats overlay hides Facets/Waste on mobile, compact map type selector. Drawing mode and edge start indicators positioned above bottom sheet on mobile with shorter text.
- [x] **Phase B: Touch-Optimized Controls** (COMPLETE) — All interactive elements have min-h-[44px] tap targets (Apple HIG minimum). ToolsPanel uses 2-column grid on mobile, list on desktop. Undo/redo/clear buttons with active states for touch feedback. MeasurementSelector with larger tap targets. Export dropdown with 40px minimum row height. Keyboard shortcuts section hidden on mobile (no keyboard). Active states (`active:bg-*`) added for touch feedback throughout.
- [x] **Phase C: Mobile Measurement UX** (COMPLETE) — `MobileToolbar.tsx` floating compact toolbar, MapView GPS locate button, long-press vertex placement, haptic feedback, crosshair drawing indicator, `useMediaQuery.ts` hook
- [x] **Phase D: Field-Ready PWA** (COMPLETE) — `public/sw.js` service worker (cache-first static, network-first API), `public/manifest.json`, `src/utils/serviceWorker.ts` registration, PWA meta tags in `index.html`, tests in `tests/unit/serviceWorker.test.ts`
- [x] **Phase E: Tablet Layout** (COMPLETE) — `src/layouts/TabletLayout.tsx` split-view (40/60 landscape, 60/40 portrait), resizable divider, `Workspace.tsx` tablet detection via `useIsTablet()`, tests in `tests/unit/useMediaQuery.test.ts`

### Priority 9: Phase 8 — Commercial Properties (COMPLETE)
- [x] Large commercial roof support — `src/types/commercial.ts` (15+ types), `src/utils/commercialRoof.ts`
- [x] Multi-section commercial reports — `src/components/commercial/CommercialPanel.tsx`, `CommercialReportSection.tsx`
- [x] Flat roof drainage analysis — `src/utils/drainageAnalysis.ts`, `src/components/commercial/DrainagePanel.tsx`
- [x] Commercial material estimation — `src/utils/commercialMaterials.ts` (TPO, EPDM, modified bitumen, BUR, SPF pricing)
- [x] Parapet and coping measurements — `src/components/commercial/ParapetPanel.tsx`
- [x] Tests: `tests/unit/commercialRoof.test.ts`, `tests/unit/drainageAnalysis.test.ts`, `tests/unit/commercialMaterials.test.ts`

### Priority 10: User Profiles, Credits & EagleView Upload (COMPLETE)
User registration, credit system, and EagleView PDF upload/comparison flow.

- [x] **User Registration & Auth** — `server/routes/auth.ts` updated with `POST /api/auth/register` (PostgreSQL-backed), `POST /api/auth/login` (DB-first with flat-file fallback), `GET /api/auth/me` (profile with reportCredits), `POST /api/auth/use-credit` (atomic credit deduction)
- [x] **Credit System** — `reportCredits` field on user model, credit deduction on report generation, credit award on EagleView upload (2 credits per upload)
- [x] **EagleView PDF Upload** — `server/routes/uploads.ts` — multer-based PDF upload (10MB max), `pdf-parse` text extraction, regex-based EagleView field parser (address, total area, facet count, pitch, waste%), stores extracted data in `eagleview_uploads` table
- [x] **Account Page** — `src/components/account/AccountPage.tsx` — drag-and-drop PDF upload, upload history table, credit balance display, profile management
- [x] **Comparison View** — `src/components/account/ComparisonView.tsx` — side-by-side EagleView vs SkyHawk measurement comparison with color-coded diff percentages (green <5%, yellow <10%, red >10%)
- [x] **Database Migration** — `server/db/migrations/002_credits_and_uploads.sql` — adds `report_credits` column to users, creates `eagleview_uploads` table with extracted data fields
- [x] **Store Integration** — `useStore.ts` extended with `reportCredits`, `fetchProfile()`, `useCredit()` actions
- [x] **Route** — `/account` route added to `App.tsx` (protected, requires auth)
- [x] **Signup Page Updated** — `src/pages/marketing/SignupPage.tsx` wired to registration endpoint

### Priority 11: Accuracy Scoring & Multi-Structure Detection (COMPLETE)
Quantifiable accuracy metrics and automatic multi-building detection.

- [x] **Accuracy Scoring** — `src/utils/accuracyScore.ts`
  - `computeAccuracyScore()` — weighted 100-point scoring across 5 factors:
    - Data source (30%): LIDAR+Solar > hybrid > AI Vision > manual
    - Imagery quality (20%): HIGH > MEDIUM > LOW
    - Facet count vs Solar API segments (15%)
    - Area cross-validation vs Solar API (25%)
    - Pitch consistency across facets (10%)
  - Letter grades (A+ through D), display labels ("High Accuracy", etc.)
  - Integrated into `MeasurementsPanel.tsx` (score badge + factor breakdown)
  - Integrated into `reportGenerator.ts` (accuracy section in PDF)
  - 14 tests in `tests/unit/accuracyScore.test.ts`

- [x] **Multi-Structure Detection** — `src/utils/multiStructureDetection.ts`
  - `detectMultipleStructures()` — DBSCAN-like spatial clustering of Solar API segments
  - Groups segments by center proximity (configurable `maxGapFt`, default 25ft)
  - Returns per-structure breakdown: segment indices, total area, centroid, isPrimary flag
  - Integrated into `useAutoMeasure.ts` for automatic structure separation
  - 8 tests in `tests/unit/multiStructureDetection.test.ts`

- [x] **Roof Reconstruction Rewrite** — `src/utils/roofReconstruction.ts`
  - `reconstructComplexRoof` rewritten for one-facet-per-segment guarantee
  - Each Solar API segment now produces exactly one facet with correct area from `areaMeters2`
  - Eliminates previous Voronoi/azimuth partitioning failures that collapsed to 1 facet
  - 8 regression tests in `tests/unit/roofReconstructionRegression.test.ts` against EagleView calibration properties

- [x] **Enhanced Material Estimation** — `src/utils/materials.ts`
  - 5 new material items added to `MaterialEstimate` interface:
    - `hipRidgeBundles` — hip & ridge shingle bundles (1 bundle per ~35 linear feet)
    - `valleyMetalLf` — valley metal/ice & water shield (linear feet)
    - `sheathingSheets` — plywood/OSB sheathing (4×8 sheets, 32 sq ft each)
    - `coilNailBoxes` — coil nails for nail gun (7200 nails/box, ~320 per square)
    - `roofToWallFlashingPcs` — L-metal roof-to-wall flashing (10ft pieces)
  - All calculated with waste factor multiplier applied

### Priority 12: Batch Property Processing (COMPLETE)
Process multiple properties at once — essential for enterprise users handling storm damage neighborhoods.

- [x] **Batch Types** — `src/types/batch.ts`
  - `BatchJob`, `BatchItem`, `BatchAddress`, `BatchStats` types
  - Status tracking: queued → geocoding → measuring → complete/error/skipped
  - Job-level status: idle → parsing → running → paused → complete → cancelled
  - Status label/color maps for UI rendering

- [x] **Batch Processing Utility** — `src/utils/batchProcessor.ts`
  - `parseAddressBlock()` — Parse multiline text (one address per line)
  - `parseCsvBlock()` — Parse CSV/TSV with flexible header column matching
  - `parseAddressLine()` — Single-line parser (handles "addr, city, state zip", TSV, partial formats)
  - `createBatchJob()` — Create job from addresses with configurable concurrency
  - `computeBatchStats()` — Aggregate stats: counts, area totals, time estimates
  - `deduplicateAddresses()` — Normalize and deduplicate by street+city+state
  - `exportBatchResultsCsv()` — Export results as downloadable CSV
  - `formatDuration()` — Human-readable time formatting for ETA display

- [x] **Batch UI Components**
  - `src/components/batch/BatchProcessor.tsx` — Full batch processing page (input → parse → process → results)
    - Paste addresses or CSV/TSV input modes
    - Configurable parallel processing (1-5 concurrent)
    - Start/Pause/Resume/Reset controls
    - CSV export of results
  - `src/components/batch/BatchQueue.tsx` — Property queue with per-item status, progress bars, results
  - `src/components/batch/BatchStatsPanel.tsx` — Aggregate stats (total, complete, errors, area, squares, ETA)

- [x] **Server Route** — `server/routes/batch.ts`
  - `POST /api/batch` — Bulk property creation (up to 500 addresses)
  - `GET /api/batch/history` — Batch history grouped by creation date

- [x] **Integration**
  - Route: `/batch` (protected, requires auth)
  - "Batch Process" button added to Dashboard
  - Navigation back to Dashboard from batch page

- [x] **Tests** — 43 tests in `tests/unit/batchProcessor.test.ts`, 24 tests in `tests/unit/propertySearch.test.ts`
  - Address parsing (single line, multiline, CSV, TSV, header detection)
  - Job creation and stats computation
  - Deduplication with normalization
  - Duration formatting and CSV export

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

### Completed

- [x] **Phase 6: Enterprise & Collaboration** (7/7 features COMPLETE)
  - ✅ Role-based access control frontend (EnterprisePanel.tsx, enterprise.ts)
  - ✅ Audit trail frontend (logs shown in UI)
  - ✅ Backend API (apiKeys.ts, reports.ts, audit.ts routes + RBAC + audit middleware)
  - ✅ Multi-user collaboration (organizations.ts route, OrganizationPanel.tsx)
  - ✅ Report sharing (sharing.ts route, SharingPanel.tsx)
  - ✅ Webhooks (webhooks.ts route, WebhookPanel.tsx)
  - ✅ White-label branding (WhiteLabelPanel.tsx, 002_enterprise.sql migration)

- [x] **Phase 8: Commercial Properties** (ALL features COMPLETE)
  - ✅ Large commercial roof support (types, calculations, UI)
  - ✅ Multi-section commercial reports
  - ✅ Flat roof drainage analysis
  - ✅ Commercial material estimation
  - ✅ Parapet and coping measurements

- [x] **User Profiles, Credits & EagleView Upload** (ALL features COMPLETE)
  - ✅ User registration with PostgreSQL persistence
  - ✅ Report credit system (earn on EagleView upload, spend on report generation)
  - ✅ EagleView PDF upload with text extraction and field parsing
  - ✅ Account page with upload history, credit balance, profile management
  - ✅ Side-by-side EagleView vs SkyHawk comparison view

- [x] **Accuracy Scoring & Multi-Structure Detection** (ALL features COMPLETE)
  - ✅ Weighted 100-point accuracy scoring (5 factors, letter grades A+ through D)
  - ✅ DBSCAN-like multi-structure detection from Solar API segments
  - ✅ Roof reconstruction rewrite — one facet per Solar API segment guarantee
  - ✅ Enhanced material estimation (5 new items: hip/ridge bundles, valley metal, sheathing, coil nails, roof-to-wall flashing)
  - ✅ Regression tests against 18 EagleView calibration properties

- [x] **Batch Property Processing** (COMPLETE)
  - ✅ Multi-address input with flexible parsing (paste, CSV, TSV)
  - ✅ Address deduplication and normalization
  - ✅ Configurable parallel processing with pause/resume
  - ✅ Real-time queue with progress tracking and batch stats
  - ✅ CSV export of results
  - ✅ Server-side bulk property creation API
  - ✅ 43 unit tests

- [x] **Dashboard Search, Sort & Filter + App Navigation** (COMPLETE)
  - ✅ Property search bar (matches address, city, state, ZIP — multi-term AND logic)
  - ✅ Filter by status (all, measured, unmeasured)
  - ✅ Sort by date, address (A-Z), area, or squares — toggle direction
  - ✅ "No results" state with clear filters button
  - ✅ Results count when filtered ("Showing X of Y")
  - ✅ AppNav component (Dashboard/Batch/Account links + username + logout)
  - ✅ Feature cards updated to reflect all active capabilities
  - ✅ `src/utils/propertySearch.ts` — search, filter, sort pipeline
  - ✅ `src/components/layout/AppNav.tsx` — shared navigation bar
  - ✅ 24 unit tests

### Not Started
- [ ] **Phase 7: Drone Integration** (requires hardware + FAA certification)

### EagleView Calibration (COMPLETE — Phases 1-9)
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
  - Roof reconstruction rewritten — one facet per Solar API segment (replaces Voronoi partition)
  - Regression test suite: 17 tests across 18 EagleView properties + 54 reconstruction regression tests
- [x] Phase 8: Report format parity (COMPLETE) — `src/utils/reportTableOfContents.ts` (TOC with dotted leaders), `src/utils/reportPageTemplates.ts` (EagleView-style pages with headers/footers/page numbers), `reportGenerator.ts` updated with TOC page, consistent pagination, professional summary grid
- [x] Phase 9: Mocked Solar API regression pipeline (COMPLETE) — `tests/fixtures/mock-solar-api-responses.json` (5 properties with mock buildingInsights), `tests/unit/solarApiRegression.test.ts` (per-property reconstruction tests + overall accuracy summary)

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
- [x] Data migration from localStorage — COMPLETE (dataMigration.ts, sync indicator, store whitelist updated)
- [x] User registration endpoint (`POST /api/auth/register`) with credit system
- [x] EagleView PDF upload endpoint (`POST /api/uploads/eagleview`) with text extraction
- [x] Credits migration (002_credits_and_uploads.sql)

### API Cost Per Property (~$0.05-0.06 beyond free tier)
| API | Cost/Call | Free/Month |
|-----|----------|------------|
| Solar Building Insights | $0.01 | 10,000 |
| Anthropic Claude (dominant) | ~$0.029 | None |
| Static Maps | $0.002 | 10,000 |
| Maps JS + Places | ~$0.01 | 10,000 each |
| Solar Data Layers | $0.075 | 1,000 (NOW USED — LIDAR pipeline) |

### Known Issues
- ~~**Enterprise features are frontend-only**~~: RESOLVED — RBAC middleware, audit logging, API key auth all implemented server-side.
- ~~**API integration is spec-only**~~: RESOLVED — API key management, reports, audit log query endpoints all implemented.
- ~~**reconstructComplexRoof creates 1 facet**~~: RESOLVED — Rewritten for one-facet-per-segment guarantee. Each Solar API segment produces exactly one facet with correct area from `areaMeters2`. Multi-structure detection separates distinct buildings before reconstruction.
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

**Recommended iterations (COMPLETED Feb 2026):**
1. ~~**Flag MEDIUM quality in the UI**~~ — DONE. Yellow warning badge in reports, quality badges in MeasurementsPanel
2. ~~**Fix `reconstructComplexRoof`**~~ — DONE. Hybrid partitioning: azimuth-based when clustered + Voronoi when spread. Falls back to `reconstructFromSolarApiAreas` when both strategies still produce ≤1 facet
3. ~~**Use Solar API area directly as fallback**~~ — DONE. `reconstructFromSolarApiAreas()` creates facets with `trueArea3DSqFt` from Google's `areaMeters2` when geometric partitioning fails

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
- pdf-parse (PDF text extraction for EagleView uploads)
- multer (multipart form handling for file uploads)
- Vitest (2028 tests across 79 test files)
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
| Login modal | `src/components/LoginModal.tsx` |
| Protected route | `src/components/ProtectedRoute.tsx` |
| Media query hook | `src/hooks/useMediaQuery.ts` |

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
| Facet builder | `src/utils/facetBuilder.ts` |
| Planar face extraction | `src/utils/planarFaceExtraction.ts` |
| Mobile toolbar | `src/components/measurement/MobileToolbar.tsx` |

### Report Generation & Export
| Purpose | File |
|---------|------|
| HTML report exporter | `src/utils/htmlReportExporter.ts` |
| HTML report template | `src/utils/htmlReportTemplate.ts` |
| Report table of contents | `src/utils/reportTableOfContents.ts` |
| Report page templates | `src/utils/reportPageTemplates.ts` |

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
| DSM pitch verification | `src/utils/dsmPitchVerification.ts` |
| Flux analysis | `src/utils/fluxAnalysis.ts` |
| Solar panel layout | `src/utils/solarPanelLayout.ts` |

### Database & API
| Purpose | File |
|---------|------|
| DB connection pool | `server/db/index.ts` |
| Schema migration SQL | `server/db/migrations/001_initial_schema.sql` |
| Migration runner | `server/db/migrate.ts` |
| Validation middleware | `server/middleware/validate.ts` |
| Rate limiter | `server/middleware/rateLimit.ts` |
| Auth middleware | `server/middleware/auth.ts` |
| RBAC middleware | `server/middleware/rbac.ts` |
| Audit logging | `server/middleware/auditLog.ts` |
| API key auth | `server/middleware/apiKeyAuth.ts` |
| Property CRUD routes | `server/routes/properties.ts` |
| Measurement CRUD routes | `server/routes/measurements.ts` |
| Claims CRUD routes | `server/routes/claims.ts` |
| API key routes | `server/routes/apiKeys.ts` |
| Report routes | `server/routes/reports.ts` |
| Audit routes | `server/routes/audit.ts` |
| Checkout routes | `server/routes/checkout.ts` |
| Client API service | `src/services/propertyApi.ts` |
| Sync orchestration | `src/hooks/useSync.ts` |
| Data migration | `src/utils/dataMigration.ts` |
| Server entry point | `server/index.ts` |
| Auth routes | `server/routes/auth.ts` |
| Enterprise migrations | `server/db/migrations/002_enterprise.sql` |
| Organization routes | `server/routes/organizations.ts` |
| Sharing routes | `server/routes/sharing.ts` |
| Webhook routes | `server/routes/webhooks.ts` |

### User Account & Credits
| Purpose | File |
|---------|------|
| Account page | `src/components/account/AccountPage.tsx` |
| EagleView comparison | `src/components/account/ComparisonView.tsx` |
| Upload routes | `server/routes/uploads.ts` |
| Credits migration | `server/db/migrations/002_credits_and_uploads.sql` |

### Accuracy & Multi-Structure
| Purpose | File |
|---------|------|
| Accuracy scoring | `src/utils/accuracyScore.ts` |
| Multi-structure detection | `src/utils/multiStructureDetection.ts` |

### Claims & Enterprise
| Purpose | File |
|---------|------|
| Claims panel | `src/components/claims/ClaimsPanel.tsx` |
| Adjuster panel | `src/components/claims/AdjusterPanel.tsx` |
| Comparison tool | `src/components/comparison/ComparisonPanel.tsx` |
| Enterprise panel | `src/components/enterprise/EnterprisePanel.tsx` |
| Solar analysis | `src/components/solar/SolarPanel.tsx` |
| Shading analysis | `src/components/solar/ShadingPanel.tsx` |
| Flux map panel | `src/components/solar/FluxMapPanel.tsx` |
| Enterprise types | `src/types/enterprise.ts` |
| Enterprise utilities | `src/utils/enterprise.ts` |
| Enterprise API client | `src/services/enterpriseApi.ts` |
| Stripe API client | `src/services/stripeApi.ts` |
| Organization panel | `src/components/enterprise/OrganizationPanel.tsx` |
| Sharing panel | `src/components/enterprise/SharingPanel.tsx` |
| Webhook panel | `src/components/enterprise/WebhookPanel.tsx` |
| White-label panel | `src/components/enterprise/WhiteLabelPanel.tsx` |

### Mobile & Responsive
| Purpose | File |
|---------|------|
| Tablet layout | `src/layouts/TabletLayout.tsx` |
| Service worker registration | `src/utils/serviceWorker.ts` |
| SEO utilities | `src/utils/seo.ts` |
| Analytics integration | `src/utils/analytics.ts` |

### Batch Processing
| Purpose | File |
|---------|------|
| Batch types | `src/types/batch.ts` |
| Batch processing utility | `src/utils/batchProcessor.ts` |
| Batch processor page | `src/components/batch/BatchProcessor.tsx` |
| Batch queue display | `src/components/batch/BatchQueue.tsx` |
| Batch stats panel | `src/components/batch/BatchStatsPanel.tsx` |
| Batch API route | `server/routes/batch.ts` |

### Dashboard & Navigation
| Purpose | File |
|---------|------|
| Property search/filter/sort | `src/utils/propertySearch.ts` |
| App navigation bar | `src/components/layout/AppNav.tsx` |
| Dashboard component | `src/components/dashboard/Dashboard.tsx` |

### Marketing & Commerce
| Purpose | File |
|---------|------|
| Marketing layout | `src/pages/marketing/MarketingLayout.tsx` |
| Landing page | `src/pages/marketing/LandingPage.tsx` |
| Contractors persona | `src/pages/marketing/ContractorsPage.tsx` |
| Adjusters persona | `src/pages/marketing/AdjustersPage.tsx` |
| Agents persona | `src/pages/marketing/AgentsPage.tsx` |
| Homeowners persona | `src/pages/marketing/HomeownersPage.tsx` |
| Pricing page | `src/pages/marketing/PricingPage.tsx` |
| Signup page | `src/pages/marketing/SignupPage.tsx` |
| Checkout success | `src/pages/marketing/CheckoutSuccess.tsx` |
| Checkout cancel | `src/pages/marketing/CheckoutCancel.tsx` |

### Commercial Properties
| Purpose | File |
|---------|------|
| Commercial types | `src/types/commercial.ts` |
| Commercial roof utils | `src/utils/commercialRoof.ts` |
| Commercial materials | `src/utils/commercialMaterials.ts` |
| Drainage analysis | `src/utils/drainageAnalysis.ts` |
| Commercial panel | `src/components/commercial/CommercialPanel.tsx` |
| Commercial report section | `src/components/commercial/CommercialReportSection.tsx` |
| Drainage panel | `src/components/commercial/DrainagePanel.tsx` |
| Parapet panel | `src/components/commercial/ParapetPanel.tsx` |

### PWA & Public Assets
| Purpose | File |
|---------|------|
| Service worker | `public/sw.js` |
| PWA manifest | `public/manifest.json` |
| HTML entry point | `index.html` |

### Build & Configuration
| Purpose | File |
|---------|------|
| Vite config | `vite.config.ts` |
| Vitest config | `vitest.config.ts` |
| TypeScript config | `tsconfig.json` |
| TypeScript (app) | `tsconfig.app.json` |
| TypeScript (server) | `tsconfig.server.json` |
| ESLint config | `eslint.config.js` |
| Claude Code settings | `.claude/settings.json` |

### Scripts
| Purpose | File |
|---------|------|
| VPS deployment | `scripts/deploy.sh` |
| Agent team QA | `scripts/test-agent-team.sh` |
| EagleView PDF extractor | `scripts/extract_eagleview.py` |
| EagleView regression | `scripts/eagleview-regression.py` |

### Plans & Specs
| Document | File | Status |
|----------|------|--------|
| Auto-Measurement Plan | `plans/completed/AUTO_MEASUREMENT.md` | COMPLETE |
| Phase 1 (Core) | `plans/completed/PHASE1_CORE_MEASUREMENT.md` | COMPLETE |
| Phase 2 (3D) | `plans/completed/PHASE2_3D_ENHANCED.md` | COMPLETE |
| Phase 3 (Insurance) | `plans/completed/PHASE3_INSURANCE.md` | COMPLETE |
| Phase 4 (AI) | `plans/completed/PHASE4_AI.md` | COMPLETE |
| EagleView Calibration | `plans/completed/EAGLEVIEW_CALIBRATION_PROMPT.md` | Phases 1-9 COMPLETE |
| GotRuf Marketing Site | `plans/active/gotruf-marketing-site.md` | Phase 1 COMPLETE |
| EagleView Parity Plan | `plans/completed/eagleview-parity-improvements.md` | Phases 1-5 COMPLETE |
| Database Persistence | `plans/completed/database-persistence.md` | Phases A-D COMPLETE |
| Google Solar API Deep Dive | `plans/completed/google-solar-api-deep-dive.md` | Phases 1-8 COMPLETE |
| Drone Integration | `plans/research/PHASE7_Thoughts_On_Drones-aerial-imagery-platform-design.md` | RESEARCH ONLY |
| API Spec | `specs/API_SPEC.md` | |
| Measurement Spec | `specs/MEASUREMENT_SPEC.md` | |
| Report Spec | `specs/REPORT_SPEC.md` | |
| Feature Roadmap | `ROADMAP.md` | |

### Tests (2028 passing tests across 79 files)
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
| Data migration | `tests/unit/dataMigration.test.ts` |
| RBAC middleware | `tests/unit/rbac.test.ts` |
| API key management | `tests/unit/apiKeys.test.ts` |
| Audit logging | `tests/unit/auditLog.test.ts` |
| Organizations | `tests/unit/organizations.test.ts` |
| Report sharing | `tests/unit/sharing.test.ts` |
| Flux analysis | `tests/unit/fluxAnalysis.test.ts` |
| DSM pitch verification | `tests/unit/dsmPitchVerification.test.ts` |
| Service worker | `tests/unit/serviceWorker.test.ts` |
| Media query hook | `tests/unit/useMediaQuery.test.ts` |
| Stripe checkout | `tests/unit/checkout.test.ts` |
| SEO utilities | `tests/unit/seo.test.ts` |
| Analytics | `tests/unit/analytics.test.ts` |
| Commercial roof | `tests/unit/commercialRoof.test.ts` |
| Drainage analysis | `tests/unit/drainageAnalysis.test.ts` |
| Commercial materials | `tests/unit/commercialMaterials.test.ts` |
| HTML report export | `tests/unit/htmlReportExporter.test.ts` |
| Report TOC | `tests/unit/reportTableOfContents.test.ts` |
| Report page templates | `tests/unit/reportPageTemplates.test.ts` |
| Solar API regression | `tests/unit/solarApiRegression.test.ts` |
| Accuracy scoring | `tests/unit/accuracyScore.test.ts` |
| Multi-structure detect | `tests/unit/multiStructureDetection.test.ts` |
| Reconstruction regress | `tests/unit/roofReconstructionRegression.test.ts` |
| Solar panel layout | `tests/unit/solarPanelLayout.test.ts` |
| Batch processor | `tests/unit/batchProcessor.test.ts` |
| Property search | `tests/unit/propertySearch.test.ts` |

#### Integration Tests
| Purpose | File |
|---------|------|
| Auto-measure pipeline | `tests/integration/autoMeasurePipeline.test.ts` |
| Edge drawing workflow | `tests/integration/edgeDrawingWorkflow.test.ts` |
| LIDAR pipeline | `tests/integration/lidarPipeline.test.ts` |
| Save/load cycle | `tests/integration/measurementSaveLoadCycle.test.ts` |
| Store + geometry | `tests/integration/storeGeometry.test.ts` |
| Vision + store | `tests/integration/visionStorePipeline.test.ts` |

#### Server Tests
| Purpose | File |
|---------|------|
| Auth endpoints | `tests/server/auth.test.ts` |
| Vision proxy | `tests/server/vision.test.ts` |

#### Acceptance Tests
| Purpose | File |
|---------|------|
| Auto-detect workflow | `tests/acceptance/autoDetectWorkflow.test.ts` |
| Claims workflow | `tests/acceptance/claimsWorkflow.test.ts` |
| Damage and export | `tests/acceptance/damageAndExport.test.ts` |
| LIDAR auto-measure | `tests/acceptance/lidarAutoMeasure.test.ts` |
| Manual measurement | `tests/acceptance/manualMeasurement.test.ts` |

#### Regression Tests
| Purpose | File |
|---------|------|
| Bug fixes | `tests/regression/bugfixes.test.ts` |
| Pitch cap | `tests/regression/pitchCap.test.ts` |

#### Smoke Tests
| Purpose | File |
|---------|------|
| Core systems | `tests/smoke/coreSystems.test.ts` |
| LIDAR systems | `tests/smoke/lidarSystems.test.ts` |

#### Test Helpers & Fixtures
| Purpose | File |
|---------|------|
| Test fixtures | `tests/helpers/fixtures.ts` |
| Mock utilities | `tests/helpers/mocks.ts` |
| Store helpers | `tests/helpers/store.ts` |
| EagleView calibration data | `tests/fixtures/eagleview-calibration.json` |
| Mock Solar API responses | `tests/fixtures/mock-solar-api-responses.json` |
| Solar API comparison | `tests/fixtures/solar-api-comparison.json` |

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
