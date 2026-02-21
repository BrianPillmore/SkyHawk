# SkyHawk Continuation Prompt

## Purpose
This file is the continuation prompt for iterative development of SkyHawk.
Run this prompt at the start of each new Claude session to continue building.

---

## CONTINUATION PROTOCOL

You are continuing development on **SkyHawk**, an aerial property intelligence
platform that is an alternative to EagleView for the roofing and insurance
adjustment industry.

### Step 1: Assess Current State

Read and understand these files (in order):
1. `ROADMAP.md` — Current feature roadmap and phase status
2. `plans/` — Detailed phase plans (check which are COMPLETE vs PLANNED)
3. `specs/` — Technical specifications
4. `.claude/settings.json` — Project configuration
5. Run `npm run build` to verify current state compiles

### Step 2: Identify Next Work

Based on the roadmap, identify the **next uncompleted feature** in the
current phase. If the current phase is complete, move to the next phase.

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
- **Types first**: Add types to `src/types/index.ts`
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

### Tech Stack
- React 19 + TypeScript + Vite 7
- Tailwind CSS v4
- Zustand (state management)
- Google Maps JavaScript API
- jsPDF (PDF generation)
- React Router v7

### Key Files
| Purpose | File |
|---------|------|
| Entry point | src/main.tsx |
| App router | src/App.tsx |
| Types | src/types/index.ts |
| State store | src/store/useStore.ts |
| Geometry math | src/utils/geometry.ts |
| PDF generator | src/utils/reportGenerator.ts |
| Map component | src/components/map/MapView.tsx |
| Sidebar | src/components/layout/Sidebar.tsx |
| Tools panel | src/components/measurement/ToolsPanel.tsx |
| Measurements | src/components/measurement/MeasurementsPanel.tsx |
| Dashboard | src/components/dashboard/Dashboard.tsx |

### Next Up
- Phase 2: 3D Visualization, Multi-structure, Undo/Redo, Persistent Storage
- See `plans/PHASE2_3D_ENHANCED.md` for details

---

## AGENT TEAM

| Agent | Role | File |
|-------|------|------|
| KAREN | QA verification | .claude/agents/KAREN.md |
| ARCHITECT | System design | .claude/agents/ARCHITECT.md |
| BUILDER | Implementation | .claude/agents/BUILDER.md |
| TESTER | Test engineering | .claude/agents/TESTER.md |
| REVIEWER | Code review | .claude/agents/REVIEWER.md |

## GOOGLE MAPS API

The application requires these Google APIs:
- Maps JavaScript API
- Places API
- Geocoding API

Set in `.env`: `VITE_GOOGLE_MAPS_API_KEY=your_key`

When the user provides Google API keys, add them to the `.env` file.
