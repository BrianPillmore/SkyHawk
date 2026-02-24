# Plan: PostgreSQL Database Persistence for Property Data

## Problem
All property data (measurements, facets, edges, vertices, damage annotations, claims, snapshots, condition assessments) is stored in browser localStorage via Zustand persist middleware. This means:
- Data is lost when the user clears their browser
- No cross-device access
- No multi-user collaboration
- localStorage has ~5-10MB size limit (image snapshots can exceed this)
- No server-side data integrity or backup
- No audit trail persistence

## Goal
Migrate all property-related data to a PostgreSQL database on the server, keeping the Zustand store as a client-side cache that syncs with the backend.

---

## Database Schema

### Core Tables

```sql
-- Users (replaces flat-file users.json)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(255) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) DEFAULT 'user',  -- 'admin', 'manager', 'adjuster', 'roofer', 'viewer'
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address       VARCHAR(500) NOT NULL,
  city          VARCHAR(255),
  state         VARCHAR(50),
  zip           VARCHAR(20),
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_properties_user ON properties(user_id);
CREATE INDEX idx_properties_location ON properties USING GIST (
  ST_SetSRID(ST_MakePoint(lng, lat), 4326)
);

-- Roof Measurements (one property can have multiple measurement versions)
CREATE TABLE roof_measurements (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  total_area_sqft         DOUBLE PRECISION DEFAULT 0,
  total_true_area_sqft    DOUBLE PRECISION DEFAULT 0,
  total_squares           DOUBLE PRECISION DEFAULT 0,
  predominant_pitch       DOUBLE PRECISION DEFAULT 0,  -- x/12 format
  total_ridge_lf          DOUBLE PRECISION DEFAULT 0,
  total_hip_lf            DOUBLE PRECISION DEFAULT 0,
  total_valley_lf         DOUBLE PRECISION DEFAULT 0,
  total_rake_lf           DOUBLE PRECISION DEFAULT 0,
  total_eave_lf           DOUBLE PRECISION DEFAULT 0,
  total_flashing_lf       DOUBLE PRECISION DEFAULT 0,
  total_drip_edge_lf      DOUBLE PRECISION DEFAULT 0,
  suggested_waste_percent DOUBLE PRECISION DEFAULT 15,
  source                  VARCHAR(50) DEFAULT 'manual', -- 'manual', 'solar-api', 'ai-vision'
  confidence              VARCHAR(20) DEFAULT 'medium', -- 'high', 'medium', 'low'
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_measurements_property ON roof_measurements(property_id);

-- Roof Vertices
CREATE TABLE roof_vertices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id  UUID NOT NULL REFERENCES roof_measurements(id) ON DELETE CASCADE,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  sort_order      INTEGER DEFAULT 0  -- preserve vertex ordering
);
CREATE INDEX idx_vertices_measurement ON roof_vertices(measurement_id);

-- Roof Edges
CREATE TABLE roof_edges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id    UUID NOT NULL REFERENCES roof_measurements(id) ON DELETE CASCADE,
  start_vertex_id   UUID NOT NULL REFERENCES roof_vertices(id) ON DELETE CASCADE,
  end_vertex_id     UUID NOT NULL REFERENCES roof_vertices(id) ON DELETE CASCADE,
  type              VARCHAR(20) NOT NULL DEFAULT 'eave',
  -- ENUM: 'ridge', 'hip', 'valley', 'rake', 'eave', 'flashing', 'step-flashing'
  length_ft         DOUBLE PRECISION DEFAULT 0
);
CREATE INDEX idx_edges_measurement ON roof_edges(measurement_id);

-- Roof Facets
CREATE TABLE roof_facets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id  UUID NOT NULL REFERENCES roof_measurements(id) ON DELETE CASCADE,
  name            VARCHAR(255) DEFAULT '',       -- e.g., "#1 NW Slope"
  pitch           DOUBLE PRECISION DEFAULT 0,    -- x/12 format
  area_sqft       DOUBLE PRECISION DEFAULT 0,    -- flat projected area
  true_area_sqft  DOUBLE PRECISION DEFAULT 0,    -- pitch-adjusted area
  azimuth_degrees DOUBLE PRECISION DEFAULT 0,    -- compass direction facet faces
  sort_order      INTEGER DEFAULT 0
);
CREATE INDEX idx_facets_measurement ON roof_facets(measurement_id);

-- Facet-Vertex junction (many-to-many, ordered)
CREATE TABLE facet_vertices (
  facet_id    UUID NOT NULL REFERENCES roof_facets(id) ON DELETE CASCADE,
  vertex_id   UUID NOT NULL REFERENCES roof_vertices(id) ON DELETE CASCADE,
  sort_order  INTEGER DEFAULT 0,
  PRIMARY KEY (facet_id, vertex_id)
);

-- Facet-Edge junction (many-to-many)
CREATE TABLE facet_edges (
  facet_id  UUID NOT NULL REFERENCES roof_facets(id) ON DELETE CASCADE,
  edge_id   UUID NOT NULL REFERENCES roof_edges(id) ON DELETE CASCADE,
  PRIMARY KEY (facet_id, edge_id)
);
```

### Damage & Condition Tables

```sql
-- Damage Annotations (pin-drops on the map)
CREATE TABLE damage_annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  type        VARCHAR(50) NOT NULL DEFAULT 'other',
  -- ENUM: 'hail', 'wind', 'missing-shingle', 'crack', 'ponding', 'debris', 'other'
  severity    VARCHAR(20) NOT NULL DEFAULT 'moderate',
  -- ENUM: 'minor', 'moderate', 'severe'
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_damage_property ON damage_annotations(property_id);

-- Roof Condition Assessments (AI-generated)
CREATE TABLE roof_condition_assessments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                 UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  overall_score               INTEGER DEFAULT 50,          -- 1-100
  category                    VARCHAR(20) DEFAULT 'fair',   -- excellent/good/fair/poor/critical
  estimated_age_years         DOUBLE PRECISION,
  estimated_remaining_life    DOUBLE PRECISION,
  material_type               VARCHAR(50) DEFAULT 'unknown',
  material_confidence         DOUBLE PRECISION DEFAULT 0,   -- 0-1
  findings                    JSONB DEFAULT '[]',           -- string array
  recommendations             JSONB DEFAULT '[]',           -- string array
  damages_detected            JSONB DEFAULT '[]',           -- array of {type, severity, description, confidence}
  assessed_at                 TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_condition_property ON roof_condition_assessments(property_id);
```

### Claims & Insurance Tables

```sql
-- Claims
CREATE TABLE claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  claim_number  VARCHAR(100),
  insured_name  VARCHAR(255),
  date_of_loss  DATE,
  status        VARCHAR(20) DEFAULT 'new',
  -- ENUM: 'new', 'inspected', 'estimated', 'submitted', 'approved', 'denied', 'closed'
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_claims_property ON claims(property_id);

-- Adjusters (global resource, not per-property)
CREATE TABLE adjusters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),  -- nullable, may not be a system user
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(50),
  specialty   VARCHAR(50) DEFAULT 'general',
  -- ENUM: 'residential', 'commercial', 'catastrophe', 'general'
  status      VARCHAR(20) DEFAULT 'available',
  -- ENUM: 'available', 'assigned', 'on-site', 'unavailable'
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Inspections
CREATE TABLE inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  adjuster_id     UUID REFERENCES adjusters(id),
  scheduled_date  DATE,
  scheduled_time  TIME,
  status          VARCHAR(20) DEFAULT 'scheduled',
  -- ENUM: 'scheduled', 'in-progress', 'completed', 'cancelled'
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_inspections_claim ON inspections(claim_id);
```

### Image & File Storage

```sql
-- Image Snapshots (before/after photos, map captures)
-- Actual image bytes stored on filesystem or S3, not in DB
CREATE TABLE image_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  label         VARCHAR(255) DEFAULT '',
  storage_path  VARCHAR(1000) NOT NULL,   -- filesystem path or S3 key
  mime_type     VARCHAR(100) DEFAULT 'image/png',
  size_bytes    BIGINT DEFAULT 0,
  lat           DOUBLE PRECISION,          -- map center at capture
  lng           DOUBLE PRECISION,
  zoom          INTEGER,                   -- map zoom level
  captured_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_snapshots_property ON image_snapshots(property_id);
```

### Solar API Cache

```sql
-- Cache Google Solar API responses (expensive API, cache aggressively)
CREATE TABLE solar_api_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  quality         VARCHAR(10),  -- 'HIGH', 'MEDIUM', 'LOW'
  response_json   JSONB NOT NULL,           -- full API response
  imagery_date    DATE,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);
CREATE INDEX idx_solar_cache_property ON solar_api_cache(property_id);
CREATE INDEX idx_solar_cache_location ON solar_api_cache(lat, lng);
```

### Enterprise & Audit Tables

```sql
-- Organizations
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  plan        VARCHAR(20) DEFAULT 'free',  -- 'free', 'pro', 'enterprise'
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Members
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(50) DEFAULT 'viewer',
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ,
  UNIQUE (organization_id, user_id)
);

-- Audit Log
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,     -- e.g., 'property.create'
  resource_type VARCHAR(50),               -- e.g., 'property', 'measurement'
  resource_id   UUID,
  details       TEXT,
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- API Keys (for third-party integrations)
CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  key_hash        VARCHAR(255) NOT NULL,   -- bcrypt hash of the full key
  prefix          VARCHAR(8) NOT NULL,     -- first 8 chars for display
  permissions     JSONB DEFAULT '[]',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);
```

---

## Implementation Plan (4 Phases)

### Phase A: Database Setup & Migration Infrastructure (MEDIUM effort ~3-4 hrs)
**Goal**: PostgreSQL running on the VPS, migration system in place, users table migrated

**New dependencies:**
- `pg` — PostgreSQL client for Node.js
- `@types/pg` — TypeScript types
- `node-pg-migrate` — Migration runner (lightweight, no ORM overhead)

**Files:**
- `server/db/index.ts` (NEW) — Connection pool setup, query helper
- `server/db/migrations/001_initial_schema.sql` (NEW) — All CREATE TABLE statements above
- `server/db/migrate.ts` (NEW) — Migration runner script
- `server/index.ts` (EDIT) — Initialize DB pool on startup
- `server/routes/auth.ts` (EDIT) — Replace flat-file users.json with users table
- `package.json` (EDIT) — Add pg, @types/pg, node-pg-migrate
- `tsconfig.server.json` (EDIT) — Include migration files if needed

**Steps:**
1. Install PostgreSQL on Hetzner VPS (`apt install postgresql`)
2. Create database and user: `CREATE DATABASE skyhawk; CREATE USER skyhawk_app WITH PASSWORD '...';`
3. Add `DATABASE_URL` to `.env` on server
4. Implement connection pool with `pg.Pool`
5. Run initial migration to create all tables
6. Migrate existing users from `users.json` to `users` table
7. Update auth routes to query PostgreSQL instead of JSON file

### Phase B: Property CRUD API (HIGH effort ~6-8 hrs)
**Goal**: Full REST API for properties and all nested data (measurements, vertices, edges, facets)

**New files:**
- `server/routes/properties.ts` (NEW) — CRUD endpoints for properties
- `server/routes/measurements.ts` (NEW) — CRUD for measurements + nested geometry
- `server/routes/claims.ts` (NEW) — CRUD for claims and inspections
- `server/routes/images.ts` (NEW) — Image upload/download with filesystem storage
- `server/middleware/validate.ts` (NEW) — Request validation middleware

**API Endpoints:**
```
GET    /api/properties              — List user's properties
POST   /api/properties              — Create property
GET    /api/properties/:id          — Get property with latest measurement
PUT    /api/properties/:id          — Update property
DELETE /api/properties/:id          — Delete property + cascade

GET    /api/properties/:id/measurements          — List measurements
POST   /api/properties/:id/measurements          — Save measurement (full graph: vertices + edges + facets)
GET    /api/properties/:id/measurements/:mid      — Get measurement with geometry
DELETE /api/properties/:id/measurements/:mid      — Delete measurement

POST   /api/properties/:id/damage-annotations     — Add damage annotation
DELETE /api/properties/:id/damage-annotations/:did — Remove annotation

POST   /api/properties/:id/snapshots              — Upload image snapshot
GET    /api/properties/:id/snapshots/:sid/image    — Download image file
DELETE /api/properties/:id/snapshots/:sid          — Delete snapshot

POST   /api/properties/:id/condition               — Save condition assessment

GET    /api/properties/:id/claims                  — List claims
POST   /api/properties/:id/claims                  — Create claim
PUT    /api/claims/:id                             — Update claim
POST   /api/claims/:id/inspections                 — Schedule inspection
```

**Key design decisions:**
- Measurement save is a single POST with the full graph (vertices, edges, facets) — server handles the inserts in a transaction
- Image snapshots are uploaded as multipart/form-data, stored on filesystem at `/var/www/skyhawk-data/snapshots/`, only the path is stored in DB
- All endpoints enforce `user_id` ownership (users can only see their own properties)

### Phase C: Client-Side Sync Layer (HIGH effort ~6-8 hrs)
**Goal**: Zustand store syncs with backend API, works offline with optimistic updates

**Files to modify:**
- `src/store/useStore.ts` (EDIT) — Add API sync actions alongside existing state mutations
- `src/services/propertyApi.ts` (NEW) — API client for property CRUD
- `src/hooks/useSync.ts` (NEW) — Sync orchestration hook

**Approach:**
1. **Dual-write pattern**: Every store mutation that changes property data also fires an API call
2. **Optimistic updates**: UI updates immediately from Zustand, API call runs in background
3. **Conflict resolution**: Server timestamp wins (last-write-wins for MVP)
4. **Offline support**: If API call fails, queue for retry; localStorage remains as local cache
5. **Initial load**: On login, fetch all user properties from server, merge into Zustand store

**Sync flow:**
```
User action → Zustand mutation (instant) → API call (background)
                                          ↓ success: update server timestamp
                                          ↓ failure: queue for retry, show warning badge
```

### Phase D: Data Migration & Cleanup (LOW effort ~2-3 hrs)
**Goal**: Migrate existing localStorage data to server, remove localStorage dependency for property data

**Files:**
- `src/utils/dataMigration.ts` (NEW) — One-time migration from localStorage to server
- `src/store/useStore.ts` (EDIT) — Remove property data from persist whitelist
- `src/components/layout/Header.tsx` (EDIT) — Show sync status indicator

**Steps:**
1. On first login after upgrade, detect existing localStorage property data
2. POST each property + measurement to the server API
3. On success, remove property data from localStorage (keep only auth token, UI preferences)
4. Show migration progress to user
5. Add sync status indicator in header (green=synced, yellow=syncing, red=offline)

---

## VPS Setup Requirements

```bash
# Install PostgreSQL 16 on Hetzner VPS
apt update && apt install -y postgresql-16

# Create database
sudo -u postgres psql <<EOF
CREATE USER skyhawk_app WITH PASSWORD 'SECURE_PASSWORD_HERE';
CREATE DATABASE skyhawk OWNER skyhawk_app;
GRANT ALL PRIVILEGES ON DATABASE skyhawk TO skyhawk_app;
EOF

# Create data directory for image snapshots
mkdir -p /var/www/skyhawk-data/snapshots
chown www-data:www-data /var/www/skyhawk-data/snapshots

# Add to server .env
echo 'DATABASE_URL=postgresql://skyhawk_app:SECURE_PASSWORD_HERE@localhost:5432/skyhawk' >> /var/www/skyhawk-server/.env
```

---

## Priority & Effort Matrix

| Phase | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Phase A: DB Setup & Migrations | HIGH | MEDIUM (3-4 hrs) | **DO FIRST** |
| Phase B: Property CRUD API | HIGH | HIGH (6-8 hrs) | **DO SECOND** |
| Phase C: Client Sync Layer | HIGH | HIGH (6-8 hrs) | **DO THIRD** |
| Phase D: Data Migration | MEDIUM | LOW (2-3 hrs) | **DO FOURTH** |

**Total estimated effort: 17-23 hours**

## File Summary

| File | Action | Phase | Description |
|------|--------|-------|-------------|
| `server/db/index.ts` | NEW | A | PostgreSQL connection pool + query helper |
| `server/db/migrations/001_initial_schema.sql` | NEW | A | Full schema DDL |
| `server/db/migrate.ts` | NEW | A | Migration runner |
| `server/routes/auth.ts` | EDIT | A | Switch from users.json to PostgreSQL |
| `server/routes/properties.ts` | NEW | B | Property CRUD endpoints |
| `server/routes/measurements.ts` | NEW | B | Measurement + geometry CRUD |
| `server/routes/claims.ts` | NEW | B | Claims + inspections CRUD |
| `server/routes/images.ts` | NEW | B | Image upload/download |
| `server/middleware/validate.ts` | NEW | B | Request validation |
| `server/index.ts` | EDIT | A,B | DB init, mount new routes |
| `src/services/propertyApi.ts` | NEW | C | Client-side API calls |
| `src/hooks/useSync.ts` | NEW | C | Sync orchestration |
| `src/store/useStore.ts` | EDIT | C,D | Add sync actions, remove persist for properties |
| `src/utils/dataMigration.ts` | NEW | D | localStorage → server migration |
| `src/components/layout/Header.tsx` | EDIT | D | Sync status indicator |
| `package.json` | EDIT | A | Add pg, @types/pg |

## Verification Criteria

1. `psql -U skyhawk_app -d skyhawk -c '\dt'` lists all tables
2. Creating a property in the UI persists it to PostgreSQL (verify with SQL query)
3. Logging in on a different browser shows the same properties
4. Image snapshots are stored on filesystem, not in database
5. Deleting a property cascades to all child records
6. API responses complete in <200ms for typical operations
7. Existing localStorage data is migrated on first login after upgrade
8. App works offline (graceful degradation, syncs when reconnected)
