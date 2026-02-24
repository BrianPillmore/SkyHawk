-- Migration 002: Enterprise Features
-- Adds shared reports, webhooks, and white-label branding support

-- Shared reports
CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES users(id),
  shared_with_email VARCHAR(255),
  shared_with_user UUID REFERENCES users(id),
  share_token VARCHAR(255) UNIQUE,
  permissions VARCHAR(20) DEFAULT 'view', -- 'view', 'comment', 'edit'
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shared_reports_property ON shared_reports(property_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON shared_reports(share_token);
CREATE INDEX IF NOT EXISTS idx_shared_reports_shared_by ON shared_reports(shared_by);

-- Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url VARCHAR(2000) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  events JSONB DEFAULT '[]', -- ['property.created', 'measurement.completed', 'report.generated']
  active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id);

-- White-label branding
CREATE TABLE IF NOT EXISTS white_label_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  company_name VARCHAR(255),
  logo_url VARCHAR(2000),
  primary_color VARCHAR(7), -- hex color
  secondary_color VARCHAR(7),
  header_text VARCHAR(500),
  footer_text VARCHAR(500),
  custom_domain VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);
CREATE INDEX IF NOT EXISTS idx_white_label_org ON white_label_configs(organization_id);
