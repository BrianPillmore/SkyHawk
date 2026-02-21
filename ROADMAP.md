# SkyHawk - Aerial Property Intelligence Platform

## Vision
SkyHawk is an open-source alternative to EagleView, providing aerial property measurement, analysis, and reporting for the roofing, insurance, and construction industries.

---

## Architecture Overview

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: Tailwind CSS + Headless UI
- **Maps**: Google Maps JavaScript API (satellite imagery, places autocomplete)
- **3D Rendering**: Three.js (3D roof visualization)
- **Canvas Drawing**: Custom polygon editor on Google Maps overlay
- **PDF Generation**: jsPDF + html2canvas
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (dev) → PostgreSQL (production)
- **Auth**: JWT + bcrypt
- **File Storage**: Local filesystem → S3-compatible (production)

### System Architecture
```
┌─────────────────────────────────────────────────┐
│                  SkyHawk Web App                 │
├─────────────┬───────────────┬───────────────────┤
│  Dashboard  │  Measurement  │  Report Generator │
│   Module    │    Engine     │      Module       │
├─────────────┴───────────────┴───────────────────┤
│              Google Maps Integration             │
│         (Satellite, Places, Geocoding)           │
├─────────────────────────────────────────────────┤
│                3D Rendering Engine               │
│              (Three.js Roof Models)              │
├─────────────────────────────────────────────────┤
│              REST API (Express.js)               │
├─────────────────────────────────────────────────┤
│           Database + File Storage                │
└─────────────────────────────────────────────────┘
```

---

## Feature Roadmap

### Phase 1: Core Measurement Engine (Current)
- [x] Interactive satellite map with address search
- [x] Roof outline drawing (polygon tool)
- [x] Roof facet area calculation (accounting for pitch)
- [x] Ridge, hip, valley, rake, and eave line drawing
- [x] Slope/pitch estimation and input
- [x] Measurement summary panel
- [x] Waste factor calculation
- [x] Basic PDF report generation

### Phase 2: Enhanced Measurement & 3D
- [ ] Multi-structure support (multiple buildings per property)
- [ ] 3D roof model visualization (rotate, zoom, inspect)
- [ ] Automatic pitch detection from oblique imagery
- [ ] Walls, windows, and doors measurement
- [ ] Full-house measurement reports
- [ ] Measurement accuracy validation tools
- [ ] Undo/redo for all drawing operations

### Phase 3: Insurance & Claims Workflow
- [ ] Claims management dashboard
- [ ] Before/after imagery comparison (dual-pane viewer)
- [ ] Damage assessment annotations
- [ ] Xactimate-compatible export (ESX format)
- [ ] Hail/wind damage markers
- [ ] Claim status tracking workflow
- [ ] Adjuster assignment and scheduling

### Phase 4: Advanced Analytics & AI
- [ ] AI-powered roof feature detection from satellite imagery
- [ ] Automatic roof outline extraction
- [ ] Damage severity classification
- [ ] Roof condition scoring
- [ ] Age estimation from imagery
- [ ] Material type detection (shingle, metal, tile, etc.)

### Phase 5: Solar Integration
- [ ] Solar panel placement optimizer
- [ ] Shading analysis
- [ ] Sun path simulation
- [ ] Energy production estimates
- [ ] Solar-ready reports

### Phase 6: Enterprise & Collaboration
- [ ] Multi-user organization accounts
- [ ] Role-based access control (admin, adjuster, roofer, viewer)
- [ ] Report sharing and collaboration
- [ ] API for third-party integrations
- [ ] Webhook notifications
- [ ] Audit trail and activity logging
- [ ] White-label support

### Phase 7: Drone Integration
- [ ] Drone flight path planning
- [ ] Drone imagery upload and processing
- [ ] Photogrammetry integration
- [ ] High-res orthomosaic generation
- [ ] Autonomous inspection workflows

### Phase 8: Commercial Properties
- [ ] Large commercial roof support
- [ ] Multi-section commercial reports
- [ ] Flat roof drainage analysis
- [ ] Commercial material estimation
- [ ] Parapet and coping measurements

---

## Measurement Specifications

### Roof Measurements
| Measurement | Unit | Description |
|-------------|------|-------------|
| Total Roof Area | sq ft | Sum of all facet areas (adjusted for pitch) |
| Facet Area | sq ft | Individual roof plane area |
| Pitch | x/12 | Slope in inches per foot |
| Ridges | linear ft | Top horizontal edge where two slopes meet |
| Hips | linear ft | Angled edge where two slopes meet (external) |
| Valleys | linear ft | Angled edge where two slopes meet (internal) |
| Rakes | linear ft | Sloped edge at gable end |
| Eaves | linear ft | Horizontal edge at roof bottom |
| Drip Edge | linear ft | Total perimeter length |
| Flashing | linear ft | Wall-to-roof transition lengths |
| Squares | squares | Area in roofing squares (1 square = 100 sq ft) |

### Waste Factor Table
| Roof Complexity | Suggested Waste % |
|----------------|-------------------|
| Simple (few facets) | 5-10% |
| Medium complexity | 10-15% |
| Complex (many facets) | 15-20% |
| Very complex | 20-25% |

---

## API Endpoints (Planned)

### Properties
- `POST /api/properties` - Create property
- `GET /api/properties` - List properties
- `GET /api/properties/:id` - Get property details
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

### Measurements
- `POST /api/properties/:id/measurements` - Save measurements
- `GET /api/properties/:id/measurements` - Get measurements
- `PUT /api/measurements/:id` - Update measurement

### Reports
- `POST /api/reports/generate` - Generate PDF report
- `GET /api/reports` - List reports
- `GET /api/reports/:id` - Get report
- `GET /api/reports/:id/download` - Download PDF

### Users & Auth
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
