-- Migration 001: Initial Schema
-- Creates all core tables for SkyHawk property persistence

-- Users (replaces flat-file users.json)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(255) UNIQUE NOT NULL,
  email         VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(50) DEFAULT 'user',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Properties
CREATE TABLE IF NOT EXISTS properties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address       VARCHAR(500) NOT NULL,
  city          VARCHAR(255) DEFAULT '',
  state         VARCHAR(50) DEFAULT '',
  zip           VARCHAR(20) DEFAULT '',
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_properties_user ON properties(user_id);

-- Roof Measurements
CREATE TABLE IF NOT EXISTS roof_measurements (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id               UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  total_area_sqft           DOUBLE PRECISION DEFAULT 0,
  total_true_area_sqft      DOUBLE PRECISION DEFAULT 0,
  total_squares             DOUBLE PRECISION DEFAULT 0,
  predominant_pitch         DOUBLE PRECISION DEFAULT 0,
  total_ridge_lf            DOUBLE PRECISION DEFAULT 0,
  total_hip_lf              DOUBLE PRECISION DEFAULT 0,
  total_valley_lf           DOUBLE PRECISION DEFAULT 0,
  total_rake_lf             DOUBLE PRECISION DEFAULT 0,
  total_eave_lf             DOUBLE PRECISION DEFAULT 0,
  total_flashing_lf         DOUBLE PRECISION DEFAULT 0,
  total_step_flashing_lf    DOUBLE PRECISION DEFAULT 0,
  total_drip_edge_lf        DOUBLE PRECISION DEFAULT 0,
  suggested_waste_percent   DOUBLE PRECISION DEFAULT 15,
  ridge_count               INTEGER DEFAULT 0,
  hip_count                 INTEGER DEFAULT 0,
  valley_count              INTEGER DEFAULT 0,
  rake_count                INTEGER DEFAULT 0,
  eave_count                INTEGER DEFAULT 0,
  flashing_count            INTEGER DEFAULT 0,
  step_flashing_count       INTEGER DEFAULT 0,
  structure_complexity      VARCHAR(20) DEFAULT 'Simple',
  estimated_attic_sqft      DOUBLE PRECISION DEFAULT 0,
  pitch_breakdown           JSONB DEFAULT '[]',
  building_height_ft        DOUBLE PRECISION,
  stories                   INTEGER,
  data_source               VARCHAR(20),
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_measurements_property ON roof_measurements(property_id);

-- Roof Vertices
CREATE TABLE IF NOT EXISTS roof_vertices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id  UUID NOT NULL REFERENCES roof_measurements(id) ON DELETE CASCADE,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  sort_order      INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_vertices_measurement ON roof_vertices(measurement_id);

-- Roof Edges
CREATE TABLE IF NOT EXISTS roof_edges (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id    UUID NOT NULL REFERENCES roof_measurements(id) ON DELETE CASCADE,
  start_vertex_id   UUID NOT NULL REFERENCES roof_vertices(id) ON DELETE CASCADE,
  end_vertex_id     UUID NOT NULL REFERENCES roof_vertices(id) ON DELETE CASCADE,
  type              VARCHAR(20) NOT NULL DEFAULT 'eave',
  length_ft         DOUBLE PRECISION DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_edges_measurement ON roof_edges(measurement_id);

-- Roof Facets
CREATE TABLE IF NOT EXISTS roof_facets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id  UUID NOT NULL REFERENCES roof_measurements(id) ON DELETE CASCADE,
  name            VARCHAR(255) DEFAULT '',
  pitch           DOUBLE PRECISION DEFAULT 0,
  area_sqft       DOUBLE PRECISION DEFAULT 0,
  true_area_sqft  DOUBLE PRECISION DEFAULT 0,
  sort_order      INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_facets_measurement ON roof_facets(measurement_id);

-- Facet-Vertex junction (ordered, many-to-many)
CREATE TABLE IF NOT EXISTS facet_vertices (
  facet_id    UUID NOT NULL REFERENCES roof_facets(id) ON DELETE CASCADE,
  vertex_id   UUID NOT NULL REFERENCES roof_vertices(id) ON DELETE CASCADE,
  sort_order  INTEGER DEFAULT 0,
  PRIMARY KEY (facet_id, vertex_id)
);

-- Facet-Edge junction (many-to-many)
CREATE TABLE IF NOT EXISTS facet_edges (
  facet_id  UUID NOT NULL REFERENCES roof_facets(id) ON DELETE CASCADE,
  edge_id   UUID NOT NULL REFERENCES roof_edges(id) ON DELETE CASCADE,
  PRIMARY KEY (facet_id, edge_id)
);

-- Damage Annotations
CREATE TABLE IF NOT EXISTS damage_annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  type        VARCHAR(50) NOT NULL DEFAULT 'other',
  severity    VARCHAR(20) NOT NULL DEFAULT 'moderate',
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_damage_property ON damage_annotations(property_id);

-- Image Snapshots (actual images stored on filesystem, not in DB)
CREATE TABLE IF NOT EXISTS image_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  label         VARCHAR(255) DEFAULT '',
  storage_path  VARCHAR(1000) NOT NULL,
  mime_type     VARCHAR(100) DEFAULT 'image/png',
  size_bytes    BIGINT DEFAULT 0,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  zoom          INTEGER,
  captured_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_snapshots_property ON image_snapshots(property_id);

-- Claims
CREATE TABLE IF NOT EXISTS claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  claim_number  VARCHAR(100),
  insured_name  VARCHAR(255),
  date_of_loss  DATE,
  status        VARCHAR(20) DEFAULT 'new',
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_claims_property ON claims(property_id);

-- Adjusters
CREATE TABLE IF NOT EXISTS adjusters (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255),
  phone       VARCHAR(50),
  specialty   VARCHAR(50) DEFAULT 'general',
  status      VARCHAR(20) DEFAULT 'available',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Inspections
CREATE TABLE IF NOT EXISTS inspections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        UUID NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  adjuster_id     UUID REFERENCES adjusters(id),
  scheduled_date  DATE,
  scheduled_time  TIME,
  status          VARCHAR(20) DEFAULT 'scheduled',
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inspections_claim ON inspections(claim_id);

-- Roof Condition Assessments
CREATE TABLE IF NOT EXISTS roof_condition_assessments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id               UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  overall_score             INTEGER DEFAULT 50,
  category                  VARCHAR(20) DEFAULT 'fair',
  estimated_age_years       DOUBLE PRECISION,
  estimated_remaining_life  DOUBLE PRECISION,
  material_type             VARCHAR(50) DEFAULT 'unknown',
  material_confidence       DOUBLE PRECISION DEFAULT 0,
  findings                  JSONB DEFAULT '[]',
  recommendations           JSONB DEFAULT '[]',
  damages_detected          JSONB DEFAULT '[]',
  assessed_at               TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_condition_property ON roof_condition_assessments(property_id);

-- Solar API Cache
CREATE TABLE IF NOT EXISTS solar_api_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  quality         VARCHAR(10),
  response_json   JSONB NOT NULL,
  imagery_date    DATE,
  fetched_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
);
CREATE INDEX IF NOT EXISTS idx_solar_cache_property ON solar_api_cache(property_id);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  plan        VARCHAR(20) DEFAULT 'free',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Members
CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            VARCHAR(50) DEFAULT 'viewer',
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ,
  UNIQUE (organization_id, user_id)
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   UUID,
  details       TEXT,
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  key_hash        VARCHAR(255) NOT NULL,
  prefix          VARCHAR(8) NOT NULL,
  permissions     JSONB DEFAULT '[]',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS _migrations (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255) UNIQUE NOT NULL,
  applied_at  TIMESTAMPTZ DEFAULT NOW()
);
