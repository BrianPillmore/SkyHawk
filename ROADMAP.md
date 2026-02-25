# SkyHawk - Aerial Property Intelligence Platform

## Vision
SkyHawk is an open-source alternative to EagleView, providing aerial property measurement, analysis, and reporting for the roofing, insurance, and construction industries.

---

## Architecture Overview

### Technology Stack
- **Frontend**: React 19 + TypeScript 5.9 + Vite 7
- **UI Framework**: Tailwind CSS + Headless UI
- **Maps**: Google Maps JavaScript API (satellite imagery, places autocomplete)
- **3D Rendering**: Three.js + React Three Fiber (3D roof visualization)
- **Canvas Drawing**: Custom polygon editor on Google Maps overlay
- **PDF Generation**: jsPDF + html2canvas
- **GeoTIFF Parsing**: geotiff (for satellite imagery processing)
- **AI Integration**: Anthropic Claude API (vision analysis), Google Solar API
- **Solar Analysis**: Shading analysis + Sun path simulation
- **State Management**: Zustand 5 with localStorage persistence
- **Testing**: Vitest (2071 tests across 80 files)
- **Backend**: Express.js + TypeScript (deployed on Hetzner VPS at 89.167.94.69)
- **Database**: PostgreSQL 16 (schema: 18+ tables, migration runner)
- **Auth**: JWT + bcrypt (PostgreSQL-backed with flat-file fallback)

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

### Phase 1: Core Measurement Engine (COMPLETE)
- [x] Interactive satellite map with address search
- [x] Roof outline drawing (polygon tool)
- [x] Roof facet area calculation (accounting for pitch)
- [x] Ridge, hip, valley, rake, and eave line drawing
- [x] Slope/pitch estimation and input
- [x] Measurement summary panel
- [x] Waste factor calculation
- [x] Basic PDF report generation

### Phase 2: Enhanced Measurement & 3D
- [x] Undo/redo for all drawing operations
- [x] Multi-structure support (multiple buildings per property)
- [x] Material estimation calculator
- [x] localStorage persistence
- [x] Edge drawing preview line + vertex snapping
- [x] Map labels (edge lengths + facet areas on map)
- [x] Measurement data export (JSON, GeoJSON, CSV)
- [x] Map screenshot capture for PDF reports
- [x] Real-time measurement stats overlay
- [x] 3D roof model visualization (rotate, zoom, inspect)
- [x] Automatic pitch detection from oblique imagery
- [x] Walls, windows, and doors measurement
- [x] Full-house measurement reports

### Phase 3: Insurance & Claims Workflow
- [x] Claims management dashboard
- [x] Before/after imagery comparison (dual-pane viewer)
- [x] Damage assessment annotations
- [x] Xactimate-compatible export (ESX format)
- [x] Hail/wind damage markers
- [x] Claim status tracking workflow
- [x] Adjuster assignment and scheduling

### Phase 4: Advanced Analytics & AI
- [x] AI-powered roof feature detection from satellite imagery
- [x] Automatic roof outline extraction
- [x] Damage severity classification
- [x] Roof condition scoring
- [x] Age estimation from imagery
- [x] Material type detection (shingle, metal, tile, etc.)

### Phase 5: Solar Integration
- [x] Solar panel placement optimizer
- [x] Shading analysis
- [x] Sun path simulation
- [x] Energy production estimates
- [x] Solar-ready reports

### Phase 6: Enterprise & Collaboration (COMPLETE)
- [x] Multi-user organization accounts
- [x] Role-based access control (admin, adjuster, roofer, viewer)
- [x] Report sharing and collaboration
- [x] API for third-party integrations
- [x] Webhook notifications
- [x] Audit trail and activity logging
- [x] White-label support

### Phase 7: Drone Integration
- [ ] Drone flight path planning
- [ ] Drone imagery upload and processing
- [ ] Photogrammetry integration
- [ ] High-res orthomosaic generation
- [ ] Autonomous inspection workflows

### Phase 8: Commercial Properties (COMPLETE)
- [x] Large commercial roof support
- [x] Multi-section commercial reports
- [x] Flat roof drainage analysis
- [x] Commercial material estimation
- [x] Parapet and coping measurements

### User Profiles, Credits & EagleView Upload (COMPLETE)
- [x] User registration and authentication (PostgreSQL-backed)
- [x] Report credit system (earn on EagleView upload, spend on report generation)
- [x] EagleView PDF upload with text extraction and field parsing
- [x] Account page with upload history and credit balance
- [x] Side-by-side EagleView vs SkyHawk measurement comparison

### Accuracy Scoring & Multi-Structure Detection (COMPLETE)
- [x] Weighted 100-point accuracy scoring (5 factors, letter grades A+ through D)
- [x] DBSCAN-like multi-structure detection from Solar API segments
- [x] Roof reconstruction rewrite — one facet per Solar API segment
- [x] Enhanced material estimation (5 new items)
- [x] 20 new tests (12 accuracy + 8 multi-structure)

### Google Solar API Deep Integration (COMPLETE — Phases 1-8)
- [x] Extended Solar API type definitions
- [x] Panel placement validation and obstruction detection
- [x] API-driven solar energy calculator
- [x] Financial analysis integration (Google cash/financed/lease savings)
- [x] Sunshine quantiles and shading analysis
- [x] GeoTIFF flux/shade processing
- [x] DSM-based pitch verification and building height extraction
- [x] Panel layout visualization on map and in PDF

### EagleView Report Parity (COMPLETE — Phases 1-5)
- [x] Wireframe screenshot as hero image on PDF page 1
- [x] Labeled wireframe diagrams (length, area, pitch)
- [x] Oblique imagery (N/S/E/W satellite views)
- [x] Report polish and branding (confidence badge, facet totals, attribution)
- [x] Interactive HTML export with embedded Google Maps

### GotRuf.com Marketing Site (Phase 1 COMPLETE, Phase 2 PARTIAL)
- [x] Landing page, persona pages, pricing page, signup page
- [x] Stripe integration and SEO/analytics
- [ ] Domain setup (DNS, nginx, SSL)
- [ ] Professional logo design

### Mobile-Friendly Responsive Design (COMPLETE)
- [x] Responsive layout (sidebar → bottom sheet on mobile)
- [x] Touch-optimized controls (44px tap targets)
- [x] Mobile measurement UX (floating toolbar, GPS locate, haptic feedback)
- [x] Field-ready PWA (service worker, manifest, offline support)
- [x] Tablet layout (split-view with resizable divider)

### Batch Property Processing (COMPLETE)
- [x] Multi-address input (paste or CSV/TSV with flexible column matching)
- [x] Address deduplication with normalization
- [x] Configurable parallel processing (1-5 concurrent)
- [x] Real-time progress tracking with per-item status
- [x] Batch stats (total area, squares, completion time estimates)
- [x] CSV export of batch results
- [x] Server-side bulk property creation API (POST /api/batch)
- [x] 43 unit tests

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

## API Endpoints (Implemented)

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
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user profile (includes reportCredits)
- `POST /api/auth/use-credit` - Deduct 1 report credit

### Claims
- `POST /api/claims` - Create claim
- `GET /api/claims` - List claims
- `GET /api/claims/:id` - Get claim details
- `PUT /api/claims/:id` - Update claim
- `POST /api/claims/:id/inspections` - Schedule inspection
- `PUT /api/claims/:claimId/inspections/:inspectionId` - Update inspection

### EagleView Uploads
- `POST /api/uploads/eagleview` - Upload EagleView PDF (extracts data, awards credits)
- `GET /api/uploads/eagleview` - List user's uploads
- `GET /api/uploads/eagleview/:id` - Get single upload details

### Enterprise
- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id` - Get organization
- `POST /api/organizations/:id/members` - Add member
- `POST /api/sharing/links` - Create sharing link
- `POST /api/webhooks` - Register webhook
- `GET /api/audit` - Query audit log
- `POST /api/api-keys` - Create API key
- `GET /api/api-keys` - List API keys

### Batch Processing
- `POST /api/batch` - Submit batch of addresses (up to 500)
- `GET /api/batch/history` - Batch history grouped by date

### Payments
- `POST /api/checkout/session` - Create Stripe checkout session
- `POST /api/checkout/webhook` - Stripe webhook handler
