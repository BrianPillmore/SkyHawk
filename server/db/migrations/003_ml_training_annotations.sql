-- Migration 003: ML Training Annotations
-- Stores training data for the roof edge detection ML model.
-- Images stored on filesystem, metadata + geometry in PostgreSQL.

-- Training annotations (image + mask pairs for model training)
CREATE TABLE IF NOT EXISTS ml_annotations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  property_id     UUID REFERENCES properties(id) ON DELETE SET NULL,
  address         VARCHAR(500) DEFAULT '',
  source          VARCHAR(50) NOT NULL DEFAULT 'manual',
    -- 'manual' = annotation tool, 'user-drawing' = auto-saved from edge drawing,
    -- 'correction' = corrected model output, 'cv-auto' = cv_annotate.py
  status          VARCHAR(20) DEFAULT 'pending',
    -- 'pending' = awaiting review, 'approved' = ready for training, 'rejected' = bad quality
  image_path      VARCHAR(1000) NOT NULL,
  mask_path       VARCHAR(1000),
  image_width     INTEGER DEFAULT 640,
  image_height    INTEGER DEFAULT 640,
  -- Geographic bounds of the satellite image
  bounds_north    DOUBLE PRECISION,
  bounds_south    DOUBLE PRECISION,
  bounds_east     DOUBLE PRECISION,
  bounds_west     DOUBLE PRECISION,
  -- Quality metadata
  roof_type       VARCHAR(50),  -- gable, hip, cross, flat, complex
  edge_count      INTEGER DEFAULT 0,
  vertex_count    INTEGER DEFAULT 0,
  edge_pixel_pct  REAL DEFAULT 0,
  -- Class pixel counts for distribution tracking
  px_background   INTEGER DEFAULT 0,
  px_roof         INTEGER DEFAULT 0,
  px_ridge        INTEGER DEFAULT 0,
  px_hip          INTEGER DEFAULT 0,
  px_valley       INTEGER DEFAULT 0,
  px_eave         INTEGER DEFAULT 0,
  px_flashing     INTEGER DEFAULT 0,
  -- Training metadata
  used_in_training BOOLEAN DEFAULT false,
  training_weight  REAL DEFAULT 1.0,  -- corrections weighted 3x
  parent_id       UUID REFERENCES ml_annotations(id) ON DELETE SET NULL,
    -- Links corrections to their original annotation
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ml_annotations_user ON ml_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_annotations_source ON ml_annotations(source);
CREATE INDEX IF NOT EXISTS idx_ml_annotations_status ON ml_annotations(status);
CREATE INDEX IF NOT EXISTS idx_ml_annotations_property ON ml_annotations(property_id);

-- Edge geometry stored per annotation (for re-rendering masks / retraining)
CREATE TABLE IF NOT EXISTS ml_annotation_vertices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id   UUID NOT NULL REFERENCES ml_annotations(id) ON DELETE CASCADE,
  vertex_index    INTEGER NOT NULL,  -- order within the annotation
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  pixel_x         INTEGER,  -- pixel coords in 640x640 image
  pixel_y         INTEGER
);
CREATE INDEX IF NOT EXISTS idx_ml_ann_vertices_ann ON ml_annotation_vertices(annotation_id);

CREATE TABLE IF NOT EXISTS ml_annotation_edges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id   UUID NOT NULL REFERENCES ml_annotations(id) ON DELETE CASCADE,
  start_vertex_idx INTEGER NOT NULL,
  end_vertex_idx   INTEGER NOT NULL,
  edge_type       VARCHAR(20) NOT NULL,  -- ridge, hip, valley, eave, rake, flashing
  length_ft       REAL DEFAULT 0,
  confidence      REAL DEFAULT 1.0  -- 1.0 for manual, 0-1 for model predictions
);
CREATE INDEX IF NOT EXISTS idx_ml_ann_edges_ann ON ml_annotation_edges(annotation_id);

-- Training runs (track model versions and their training data)
CREATE TABLE IF NOT EXISTS ml_training_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version   VARCHAR(50) NOT NULL,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  status          VARCHAR(20) DEFAULT 'running',  -- running, completed, failed
  annotation_count INTEGER DEFAULT 0,
  epochs_completed INTEGER DEFAULT 0,
  best_edge_iou   REAL,
  best_mean_iou   REAL,
  config_snapshot  JSONB,
  notes           TEXT DEFAULT ''
);
