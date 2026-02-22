# SkyHawk Continuation Prompt

## Purpose
This file is the continuation prompt for iterative development of SkyHawk.
Run this prompt at the start of each new Claude session to continue building.

---

## IMMEDIATE NEXT STEPS

### Priority 1: Deployment Setup
SkyHawk is currently a frontend-only React SPA with no deployment configuration.
- Set up static hosting (Vercel, Netlify, Hetzner VPS, or similar)
- Configure environment variables for API keys (Google Maps, Anthropic)
- Add build-and-deploy CI/CD pipeline
- Consider server-side proxy for API keys (currently client-side VITE_ env vars)

### Priority 2: Phase 6 — Backend API
The enterprise RBAC/audit UI exists but is frontend-only. Need actual backend:
- Implement Express/Fastify backend server
- Server-side API key management with authentication
- REST API endpoints for third-party integration (spec exists in `specs/API_SPEC.md`)
- Database persistence (SQLite dev → PostgreSQL production)
- Server-side RBAC enforcement
- Persist audit logs to database (currently in-memory only)

### Priority 3: Phase 6 — Remaining Enterprise Features
- Multi-user organization accounts
- Report sharing and collaboration
- Webhook notifications
- White-label branding support

### Priority 4: Phase 7 — Drone Integration
- Drone flight path planning
- Drone imagery upload and processing
- Photogrammetry integration
- High-res orthomosaic generation
- Autonomous inspection workflows

### Priority 5: Phase 8 — Commercial Properties
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

### Known Issues
- **API keys are client-side**: All API keys (Google Maps, Anthropic Claude) are exposed via `VITE_` environment variables. For production, these should be proxied through a backend server.
- **Enterprise features are frontend-only**: RBAC and audit trail work in browser but have no backend enforcement. Server-side auth and database persistence needed.
- **API integration is spec-only**: API key management UI exists in `EnterprisePanel.tsx` but no actual backend API endpoints are implemented.
- **No deployment configuration**: No CI/CD, no Docker, no hosting setup.

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
- Vitest (892 tests across 24 files)

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
| Export data utility | `src/utils/exportData.ts` |
| ESX format export | `src/utils/esxExport.ts` |

### AI & Automation
| Purpose | File |
|---------|------|
| Solar API types | `src/types/solar.ts` |
| Solar API client | `src/services/solarApi.ts` |
| Vision API (Claude) | `src/services/visionApi.ts` |
| Contour algorithms | `src/utils/contour.ts` |
| Roof reconstruction | `src/utils/roofReconstruction.ts` |
| Solar calculations | `src/utils/solarCalculations.ts` |
| Shading analysis | `src/utils/shadingAnalysis.ts` |
| Sun path simulation | `src/utils/sunPath.ts` |

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
| Document | File |
|----------|------|
| Auto-Measurement Plan | `plans/AUTO_MEASUREMENT.md` |
| Phase 1 (COMPLETE) | `plans/PHASE1_CORE_MEASUREMENT.md` |
| Phase 2 (COMPLETE) | `plans/PHASE2_3D_ENHANCED.md` |
| Phase 3 (COMPLETE) | `plans/PHASE3_INSURANCE.md` |
| Phase 4 (COMPLETE) | `plans/PHASE4_AI.md` |
| API Spec | `specs/API_SPEC.md` |
| Measurement Spec | `specs/MEASUREMENT_SPEC.md` |
| Report Spec | `specs/REPORT_SPEC.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Getting Started | `docs/GETTING_STARTED.md` |
| Contributing | `docs/CONTRIBUTING.md` |
| Feature Roadmap | `ROADMAP.md` |

### Tests (892 passing tests across 24 files)
| Purpose | File |
|---------|------|
| Geometry calculations | `tests/unit/geometry.test.ts` |
| Geometry extended | `tests/unit/geometry-extended.test.ts` |
| Geometry helpers | `tests/unit/geometryHelpers.test.ts` |
| State store | `tests/unit/store.test.ts` |
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
