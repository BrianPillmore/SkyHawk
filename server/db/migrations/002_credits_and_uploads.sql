-- Migration 002: Add report credits and EagleView uploads

-- Add report_credits to users (starts at 0)
ALTER TABLE users ADD COLUMN IF NOT EXISTS report_credits INTEGER DEFAULT 0;

-- EagleView uploads table
CREATE TABLE IF NOT EXISTS eagleview_uploads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename      VARCHAR(500) NOT NULL,
  address       VARCHAR(500),
  total_area_sqft     DOUBLE PRECISION,
  facet_count         INTEGER,
  predominant_pitch   VARCHAR(20),
  pitch_breakdown     JSONB DEFAULT '[]',
  waste_percent       DOUBLE PRECISION,
  raw_extracted_data  JSONB DEFAULT '{}',
  credits_awarded     INTEGER DEFAULT 2,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ev_uploads_user ON eagleview_uploads(user_id);

-- Record this migration
INSERT INTO _migrations (name) VALUES ('002_credits_and_uploads')
ON CONFLICT DO NOTHING;
