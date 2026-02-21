# SkyHawk Continuation Prompt

## Purpose
This file is the continuation prompt for iterative development of SkyHawk.
Run this prompt at the start of each new Claude session to continue building.

---

## IMMEDIATE NEXT STEPS

### Priority 1: Fix Manual Drawing Bug
The manual edge drawing mode (ridge, hip, valley, rake, eave, flashing) is broken.
Users click on vertices to create lines but nothing happens.

**Investigate in:** `src/components/map/MapView.tsx`
**Likely cause:** Click handler on vertex markers not detecting edge-drawing modes,
or `edgeStartVertexId` not being set/read correctly in the click flow.
**Store reference:** `src/store/useStore.ts` — `setEdgeStartVertex()`, `addEdge()`, `edgeStartVertexId`

### Priority 2: Implement Auto-Measurement Feature
**Full implementation plan:** `plans/AUTO_MEASUREMENT.md` (READ THIS FIRST)

Build automatic roof detection using the Google Solar API (LIDAR-based, ~10cm resolution)
with Claude AI Vision fallback for areas without Solar coverage.

#### Implementation Order
1. **Types** — `src/types/solar.ts` (Solar API response types, internal processing types)
2. **Solar API client** — `src/services/solarApi.ts` (buildingInsights, dataLayers, GeoTIFF fetch)
3. **Contour algorithms** — `src/utils/contour.ts` (GeoTIFF parsing, connected components, Moore boundary trace, Douglas-Peucker simplification)
4. **Geometry helpers** — Add to `src/utils/geometry.ts`: `localFtToLatLng()`, `bearing()`, `findLinePolygonIntersections()`
5. **Roof reconstruction** — `src/utils/roofReconstruction.ts` (classify roof type, reconstruct gable/hip/flat/shed/complex)
6. **AI Vision fallback** — `src/services/visionApi.ts` (Claude API for areas without Solar data)
7. **Store changes** — `src/store/useStore.ts`: add `applyAutoMeasurement()` batch action
8. **React hook** — `src/hooks/useAutoMeasure.ts` (orchestrates the pipeline with progress tracking)
9. **UI components** — `src/components/measurement/AutoMeasureButton.tsx` + modify `ToolsPanel.tsx`
10. **Map overlay** — Modify `src/components/map/MapView.tsx` for progress overlay during detection

#### New Dependency
```bash
npm install geotiff
```

### Priority 3: Continue Phase 2 Roadmap
After auto-measurement is working, continue with Phase 2 features:
- See `plans/PHASE2_3D_ENHANCED.md` for 3D visualization, undo/redo, persistent storage

---

## CONTINUATION PROTOCOL

You are continuing development on **SkyHawk**, an aerial property intelligence
platform that is an alternative to EagleView for the roofing and insurance
adjustment industry.

### Step 1: Assess Current State

Read and understand these files (in order):
1. `ROADMAP.md` — Current feature roadmap and phase status
2. `plans/AUTO_MEASUREMENT.md` — **ACTIVE** auto-measurement implementation plan
3. `plans/` — Other phase plans (check which are COMPLETE vs PLANNED)
4. `specs/` — Technical specifications
5. `.claude/settings.json` — Project configuration
6. Run `npm run build` to verify current state compiles

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

### Completed
- [x] Phase 1: Core Measurement Engine
  - Interactive satellite map (Google Maps)
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
  - Full Zustand state management
  - Add Property button (clickable empty state + button)

### Known Bugs
- **Manual edge drawing broken**: Clicking vertices to create ridge/hip/valley/rake/eave/flashing lines does not work. Needs fix in `src/components/map/MapView.tsx`.

### In Progress
- [ ] Auto-Measurement Feature (see `plans/AUTO_MEASUREMENT.md`)
  - Google Solar API integration (LIDAR-based building/roof detection)
  - GeoTIFF mask processing for building outline extraction
  - Algorithmic roof reconstruction (gable, hip, flat, shed, complex)
  - Claude AI Vision fallback for areas without Solar coverage
  - Auto Detect Roof button in ToolsPanel

### Tech Stack
- React 19 + TypeScript + Vite 7
- Tailwind CSS v4
- Zustand (state management)
- Google Maps JavaScript API
- Google Solar API (building insights + data layers)
- Anthropic Claude API (AI Vision fallback)
- jsPDF (PDF generation)
- geotiff (GeoTIFF parsing) — to be installed
- React Router v7

---

## API KEYS & SERVICES

All keys are configured in `.env` (gitignored, not committed):

| Service | Env Variable | Status | Purpose |
|---------|-------------|--------|---------|
| Google Maps | `VITE_GOOGLE_MAPS_API_KEY` | CONFIGURED | Satellite imagery, Places autocomplete, Geocoding |
| Google Solar API | Same key as Maps | ENABLED | Building detection, roof segments, LIDAR data layers |
| Anthropic Claude | `VITE_ANTHROPIC_API_KEY` | CONFIGURED | AI Vision fallback for roof detection |

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
| Color mappings | `src/utils/colors.ts` |
| PDF generator | `src/utils/reportGenerator.ts` |
| Map component | `src/components/map/MapView.tsx` |
| Address search | `src/components/map/AddressSearch.tsx` |
| Placeholder map | `src/components/map/PlaceholderMap.tsx` |
| Tools panel | `src/components/measurement/ToolsPanel.tsx` |
| Measurements | `src/components/measurement/MeasurementsPanel.tsx` |
| Report panel | `src/components/reports/ReportPanel.tsx` |
| Dashboard | `src/components/dashboard/Dashboard.tsx` |
| Header | `src/components/layout/Header.tsx` |
| Sidebar | `src/components/layout/Sidebar.tsx` |
| Workspace page | `src/pages/Workspace.tsx` |
| Google Maps hook | `src/hooks/useGoogleMaps.ts` |
| Keyboard shortcuts | `src/hooks/useKeyboard.ts` |

### Auto-Measurement (to be created)
| Purpose | File |
|---------|------|
| Solar API types | `src/types/solar.ts` |
| Solar API client | `src/services/solarApi.ts` |
| Vision API fallback | `src/services/visionApi.ts` |
| Contour algorithms | `src/utils/contour.ts` |
| Roof reconstruction | `src/utils/roofReconstruction.ts` |
| Auto-measure hook | `src/hooks/useAutoMeasure.ts` |
| Auto-measure button | `src/components/measurement/AutoMeasureButton.tsx` |

### Plans & Specs
| Document | File |
|----------|------|
| Auto-Measurement Plan | `plans/AUTO_MEASUREMENT.md` |
| Phase 1 (COMPLETE) | `plans/PHASE1_CORE_MEASUREMENT.md` |
| Phase 2 (PLANNED) | `plans/PHASE2_3D_ENHANCED.md` |
| Phase 3 (PLANNED) | `plans/PHASE3_INSURANCE.md` |
| Phase 4 (PLANNED) | `plans/PHASE4_AI.md` |
| API Spec | `specs/API_SPEC.md` |
| Measurement Spec | `specs/MEASUREMENT_SPEC.md` |
| Report Spec | `specs/REPORT_SPEC.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Getting Started | `docs/GETTING_STARTED.md` |
| Contributing | `docs/CONTRIBUTING.md` |
| Feature Roadmap | `ROADMAP.md` |

### Tests
| Purpose | File |
|---------|------|
| Geometry unit tests | `tests/unit/geometry.test.ts` |
| Store unit tests | `tests/unit/store.test.ts` |

---

## AGENT TEAM

| Agent | Role | File |
|-------|------|------|
| KAREN | QA verification | `.claude/agents/KAREN.md` |
| ARCHITECT | System design | `.claude/agents/ARCHITECT.md` |
| BUILDER | Implementation | `.claude/agents/BUILDER.md` |
| TESTER | Test engineering | `.claude/agents/TESTER.md` |
| REVIEWER | Code review | `.claude/agents/REVIEWER.md` |
