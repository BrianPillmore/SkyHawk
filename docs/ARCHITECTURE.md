# SkyHawk Architecture

## System Overview

```
┌──────────────────────────────────────────────────────┐
│                    Browser Client                     │
├──────────────┬────────────────┬───────────────────────┤
│   React UI   │  State (Zustand)│  Google Maps API     │
│   Router     │  Store          │  Places, Geocoding   │
│   Tailwind   │  Actions        │  Satellite Imagery   │
├──────────────┴────────────────┴───────────────────────┤
│            Measurement Engine (TypeScript)             │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐│
│  │Geometry │ │ Polygon  │ │   Pitch    │ │  Waste  ││
│  │  Calc   │ │  Area    │ │ Adjustment │ │  Factor ││
│  └─────────┘ └──────────┘ └────────────┘ └─────────┘│
├──────────────────────────────────────────────────────┤
│               Report Generator (jsPDF)                │
├──────────────────────────────────────────────────────┤
│              REST API (Express) [Planned]             │
├──────────────────────────────────────────────────────┤
│           Database (SQLite/Postgres) [Planned]        │
└──────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Component Hierarchy
```
App
├── DashboardPage
│   ├── Header (with AddressSearch)
│   └── Dashboard
│       ├── StatCards
│       ├── PropertyList
│       └── FeatureCards
└── Workspace
    ├── Header
    ├── AddressSearch
    ├── Sidebar
    │   ├── ToolsPanel
    │   ├── MeasurementsPanel
    │   └── ReportPanel
    └── MapView (or PlaceholderMap)
```

### State Management (Zustand)
Single store with clearly separated concerns:
- **Properties**: CRUD for property records
- **Measurement**: Active measurement session state
- **Drawing**: Current tool, vertex/edge/facet selection
- **Map**: Center, zoom, type
- **UI**: Sidebar state, active panel

### Key Design Decisions
1. **Client-side first**: All calculations run in browser for instant feedback
2. **Google Maps overlay**: Drawing happens as Google Maps overlays (Markers, Polylines, Polygons)
3. **Separation of concerns**: Geometry calculations isolated in `utils/geometry.ts`
4. **Type safety**: Full TypeScript with strict types for all domain models
5. **No CSS-in-JS**: Tailwind utility classes for consistent, performant styling

## File Structure
```
src/
├── App.tsx                 # Router setup
├── main.tsx                # Entry point
├── index.css               # Tailwind imports + theme
├── types/
│   └── index.ts            # All TypeScript interfaces/types
├── store/
│   └── useStore.ts         # Zustand store
├── utils/
│   ├── geometry.ts         # Math: area, distance, pitch
│   ├── colors.ts           # Edge/facet color mappings
│   └── reportGenerator.ts  # PDF report generation
├── hooks/
│   ├── useGoogleMaps.ts    # Google Maps loader + autocomplete
│   └── useKeyboard.ts      # Keyboard shortcut handler
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── map/
│   │   ├── MapView.tsx         # Main Google Maps component
│   │   ├── PlaceholderMap.tsx   # Fallback when no API key
│   │   └── AddressSearch.tsx    # Address input + autocomplete
│   ├── measurement/
│   │   ├── ToolsPanel.tsx       # Drawing tool selector
│   │   └── MeasurementsPanel.tsx # Measurement data display
│   ├── reports/
│   │   └── ReportPanel.tsx      # Report config + generation
│   └── dashboard/
│       └── Dashboard.tsx        # Property listing + stats
└── pages/
    └── Workspace.tsx            # Main measurement workspace
```

## Data Flow

### Measurement Workflow
1. User searches address → Google Places autocomplete → Property created
2. Map centers on property → Satellite imagery loads
3. User selects Outline tool → Clicks vertices on map
4. Vertices stored in Zustand → Polygon rendered on map
5. User finishes outline → Facet created with default pitch
6. User adjusts pitch → True area recalculated
7. User draws ridge/hip/valley lines → Edge lengths calculated
8. All measurements summarized in panel
9. User generates PDF → jsPDF creates downloadable report

### State Update Pattern
```
User Action → Store Action → State Update → React Re-render → Map Re-render
                                   ↓
                          Recalculate Measurements
                          (areas, lengths, totals)
```
