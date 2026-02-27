import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();

// Annotation storage directory
const ANNOTATIONS_DIR = path.resolve(__dirname, '../../ml/data/annotated');

// Ensure directory exists
if (!fs.existsSync(ANNOTATIONS_DIR)) {
  fs.mkdirSync(ANNOTATIONS_DIR, { recursive: true });
}

interface AnnotationMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

function getMetadataPath(): string {
  return path.join(ANNOTATIONS_DIR, '_annotations.json');
}

function loadMetadata(): AnnotationMetadata[] {
  const metaPath = getMetadataPath();
  if (!fs.existsSync(metaPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch {
    return [];
  }
}

function saveMetadata(metadata: AnnotationMetadata[]): void {
  fs.writeFileSync(getMetadataPath(), JSON.stringify(metadata, null, 2));
}

/**
 * GET /api/ml/annotations
 * List all saved annotations.
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const metadata = loadMetadata();
    res.json(metadata.map((m) => ({ id: m.id, name: m.name, createdAt: m.createdAt, source: m.source })));
  } catch (err) {
    console.error('Failed to list annotations:', err);
    res.status(500).json({ error: 'Failed to list annotations' });
  }
});

/**
 * POST /api/ml/annotations
 * Save image + mask + metadata.
 * Body: { name, imageBase64, maskBase64, actions?, metadata? }
 */
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, imageBase64, maskBase64, actions, metadata: extraMeta } = req.body;

    if (!name || !imageBase64 || !maskBase64) {
      res.status(400).json({ error: 'name, imageBase64, and maskBase64 are required' });
      return;
    }

    const id = randomUUID();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);

    // Save image
    const imagePath = path.join(ANNOTATIONS_DIR, `${slug}.png`);
    fs.writeFileSync(imagePath, Buffer.from(imageBase64, 'base64'));

    // Save mask
    const maskPath = path.join(ANNOTATIONS_DIR, `${slug}_mask.png`);
    fs.writeFileSync(maskPath, Buffer.from(maskBase64, 'base64'));

    // Save actions (for re-editing)
    if (actions) {
      const actionsPath = path.join(ANNOTATIONS_DIR, `${slug}_actions.json`);
      fs.writeFileSync(actionsPath, JSON.stringify(actions, null, 2));
    }

    // Update metadata index
    const allMeta = loadMetadata();
    const entry: AnnotationMetadata = {
      id,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: extraMeta,
    };
    allMeta.push(entry);
    saveMetadata(allMeta);

    res.json({ id, name, createdAt: entry.createdAt });
  } catch (err) {
    console.error('Failed to save annotation:', err);
    res.status(500).json({ error: 'Failed to save annotation' });
  }
});

/**
 * GET /api/ml/annotations/:id
 * Retrieve a single annotation with image + mask + actions.
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allMeta = loadMetadata();
    const entry = allMeta.find((m) => m.id === id);

    if (!entry) {
      res.status(404).json({ error: 'Annotation not found' });
      return;
    }

    const slug = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);

    const imagePath = path.join(ANNOTATIONS_DIR, `${slug}.png`);
    const maskPath = path.join(ANNOTATIONS_DIR, `${slug}_mask.png`);
    const actionsPath = path.join(ANNOTATIONS_DIR, `${slug}_actions.json`);

    const imageBase64 = fs.existsSync(imagePath)
      ? fs.readFileSync(imagePath).toString('base64')
      : null;

    const maskBase64 = fs.existsSync(maskPath)
      ? fs.readFileSync(maskPath).toString('base64')
      : null;

    let actions = null;
    if (fs.existsSync(actionsPath)) {
      try {
        actions = JSON.parse(fs.readFileSync(actionsPath, 'utf-8'));
      } catch {}
    }

    res.json({
      ...entry,
      imageBase64,
      maskBase64,
      actions,
    });
  } catch (err) {
    console.error('Failed to retrieve annotation:', err);
    res.status(500).json({ error: 'Failed to retrieve annotation' });
  }
});

/**
 * DELETE /api/ml/annotations/:id
 * Remove an annotation.
 */
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const allMeta = loadMetadata();
    const idx = allMeta.findIndex((m) => m.id === id);

    if (idx === -1) {
      res.status(404).json({ error: 'Annotation not found' });
      return;
    }

    const entry = allMeta[idx];
    const slug = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);

    // Remove files
    const filesToRemove = [
      path.join(ANNOTATIONS_DIR, `${slug}.png`),
      path.join(ANNOTATIONS_DIR, `${slug}_mask.png`),
      path.join(ANNOTATIONS_DIR, `${slug}_actions.json`),
    ];
    for (const f of filesToRemove) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }

    // Remove from metadata
    allMeta.splice(idx, 1);
    saveMetadata(allMeta);

    res.json({ deleted: true });
  } catch (err) {
    console.error('Failed to delete annotation:', err);
    res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

/**
 * POST /api/ml/annotations/:id/corrections
 * Save corrected annotation (from active learning feedback loop).
 * Body: { maskBase64, actions?, source: 'correction' }
 */
router.post('/:id/corrections', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { maskBase64, actions, imageBase64 } = req.body;

    if (!maskBase64) {
      res.status(400).json({ error: 'maskBase64 is required' });
      return;
    }

    const allMeta = loadMetadata();
    const entry = allMeta.find((m) => m.id === id);

    // Create as a new correction entry
    const corrId = randomUUID();
    const corrName = entry ? `${entry.name}-corrected` : `correction-${corrId.slice(0, 8)}`;
    const slug = corrName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);

    // Save corrected image (use original if not provided)
    if (imageBase64) {
      fs.writeFileSync(
        path.join(ANNOTATIONS_DIR, `${slug}.png`),
        Buffer.from(imageBase64, 'base64')
      );
    } else if (entry) {
      // Copy original image
      const origSlug = entry.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80);
      const origPath = path.join(ANNOTATIONS_DIR, `${origSlug}.png`);
      if (fs.existsSync(origPath)) {
        fs.copyFileSync(origPath, path.join(ANNOTATIONS_DIR, `${slug}.png`));
      }
    }

    // Save corrected mask
    fs.writeFileSync(
      path.join(ANNOTATIONS_DIR, `${slug}_mask.png`),
      Buffer.from(maskBase64, 'base64')
    );

    if (actions) {
      fs.writeFileSync(
        path.join(ANNOTATIONS_DIR, `${slug}_actions.json`),
        JSON.stringify(actions, null, 2)
      );
    }

    const corrEntry: AnnotationMetadata = {
      id: corrId,
      name: corrName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'correction',
      metadata: { originalId: id },
    };
    allMeta.push(corrEntry);
    saveMetadata(allMeta);

    res.json({ id: corrId, name: corrName });
  } catch (err) {
    console.error('Failed to save correction:', err);
    res.status(500).json({ error: 'Failed to save correction' });
  }
});

/**
 * POST /api/ml/annotations/auto-save-drawing
 * Auto-save user's manual edge drawings as training data.
 *
 * Active learning: every manual edge draw/edit in MapView gets captured as a
 * training pair (satellite image + edge mask). This is the most powerful
 * training data source — real corrections from real users on real roofs.
 *
 * Body: { imageBase64, vertices, edges, bounds, address }
 */
router.post('/auto-save-drawing', (req: Request, res: Response) => {
  try {
    const { imageBase64, vertices, edges, bounds, address } = req.body;

    if (!imageBase64 || !vertices || !edges || !bounds) {
      res.status(400).json({ error: 'imageBase64, vertices, edges, and bounds are required' });
      return;
    }

    // Dynamically import correctionExporter
    let saveUserDrawingAsTraining: typeof import('../ml/correctionExporter').saveUserDrawingAsTraining;
    try {
      saveUserDrawingAsTraining = require('../ml/correctionExporter').saveUserDrawingAsTraining;
    } catch {
      res.status(500).json({ error: 'correctionExporter not available' });
      return;
    }

    const correctionData = {
      vertices: vertices.map((v: { lat: number; lng: number }) => ({ lat: v.lat, lng: v.lng })),
      edges: edges.map((e: { startVertexId: string; endVertexId: string; type: string }) => ({
        startVertexId: e.startVertexId,
        endVertexId: e.endVertexId,
        type: e.type,
      })),
    };

    const result = saveUserDrawingAsTraining(
      imageBase64,
      correctionData,
      bounds,
      address || 'unknown',
      ANNOTATIONS_DIR,
    );

    if (result.saved) {
      // Also add to metadata index
      const allMeta = loadMetadata();
      allMeta.push({
        id: randomUUID(),
        name: `user-drawing-${address || 'unknown'}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'user-drawing',
        metadata: { address, edgeCount: edges.length, vertexCount: vertices.length },
      });
      saveMetadata(allMeta);

      res.json({ saved: true, message: 'Drawing saved as training data' });
    } else {
      res.json({ saved: false, message: 'Not enough edge data to save' });
    }
  } catch (err) {
    console.error('Failed to auto-save drawing:', err);
    res.status(500).json({ error: 'Failed to save drawing as training data' });
  }
});

export { router as mlTrainingRouter };
