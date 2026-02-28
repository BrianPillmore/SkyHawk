/**
 * ML Vision API Routes — ONNX model inference for roof edge detection.
 *
 * POST /api/ml/vision/detect-edges  — Run inference + vectorization
 * GET  /api/ml/vision/status        — Check if model is available
 * POST /api/ml/vision/reload        — Hot-reload model (admin)
 */

import { Router, type Request, type Response } from 'express';
import { isModelAvailable, inferRoofEdges, reloadModel } from '../ml/inference.js';
import { vectorizeEdges } from '../ml/vectorize.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

/**
 * GET /api/ml/vision/status
 * Check if ML model is available for inference.
 */
router.get('/status', (_req: Request, res: Response) => {
  const status = isModelAvailable();
  res.json(status);
});

/**
 * POST /api/ml/vision/detect-edges
 * Run ML inference on a satellite image and return vector edges.
 *
 * Body: { imageBase64, imageBounds, imageSize? }
 * Returns: DetectedRoofEdges-compatible format
 */
router.post('/detect-edges', async (req: Request, res: Response) => {
  try {
    const { imageBase64, imageBounds, imageSize = 640 } = req.body;

    if (!imageBase64 || !imageBounds) {
      res.status(400).json({ error: 'imageBase64 and imageBounds are required' });
      return;
    }

    // Check model availability
    const status = isModelAvailable();
    if (!status.available) {
      res.status(503).json({ error: `ML model not available: ${status.reason}` });
      return;
    }

    const t0 = Date.now();

    // 1. Run ONNX inference → segmentation mask
    const mask = await inferRoofEdges(imageBase64);

    const t1 = Date.now();

    // 2. Vectorize mask → edge segments in pixel coordinates
    const vectorEdges = vectorizeEdges(mask);

    const t2 = Date.now();

    // 3. Convert pixel coordinates to lat/lng
    const latRange = imageBounds.north - imageBounds.south;
    const lngRange = imageBounds.east - imageBounds.west;

    function pixelToLatLng(px: { x: number; y: number }) {
      return {
        lat: imageBounds.north - (px.y / imageSize) * latRange,
        lng: imageBounds.west + (px.x / imageSize) * lngRange,
      };
    }

    // 4. Deduplicate vertices and build indexed edge list
    const DEDUP_TOLERANCE = 3; // pixels
    const DEDUP_LAT = (DEDUP_TOLERANCE / imageSize) * latRange;
    const DEDUP_LNG = (DEDUP_TOLERANCE / imageSize) * lngRange;

    const vertices: { lat: number; lng: number }[] = [];

    function findOrAddVertex(px: { x: number; y: number }): number {
      const ll = pixelToLatLng(px);
      for (let i = 0; i < vertices.length; i++) {
        if (Math.abs(vertices[i].lat - ll.lat) < DEDUP_LAT &&
            Math.abs(vertices[i].lng - ll.lng) < DEDUP_LNG) {
          return i;
        }
      }
      vertices.push(ll);
      return vertices.length - 1;
    }

    const edges = vectorEdges.map((edge) => {
      const startIdx = findOrAddVertex(edge.start);
      const endIdx = findOrAddVertex(edge.end);
      return {
        startIndex: startIdx,
        endIndex: endIdx,
        type: edge.type,
      };
    }).filter((e) => e.startIndex !== e.endIndex);

    // 5. Determine roof type from edge composition
    const edgeTypes = new Set(edges.map((e) => e.type));
    let roofType: string = 'complex';
    if (edges.length === 0) {
      roofType = 'flat';
    } else if (!edgeTypes.has('ridge') && !edgeTypes.has('hip') && !edgeTypes.has('valley')) {
      roofType = edgeTypes.has('eave') || edgeTypes.has('rake') ? 'shed' : 'flat';
    } else if (edgeTypes.has('hip') && !edgeTypes.has('valley')) {
      roofType = 'hip';
    } else if (edgeTypes.has('ridge') && !edgeTypes.has('hip') && !edgeTypes.has('valley')) {
      roofType = 'gable';
    } else if (edgeTypes.has('valley')) {
      roofType = 'cross-gable';
    }

    const inferenceMs = t1 - t0;
    const vectorizeMs = t2 - t1;
    const totalMs = Date.now() - t0;

    console.log(`[ML] detect-edges: inference=${inferenceMs}ms, vectorize=${vectorizeMs}ms, total=${totalMs}ms, edges=${edges.length}, vertices=${vertices.length}`);

    res.json({
      vertices,
      edges,
      roofType,
      estimatedPitchDegrees: 22, // ML model doesn't estimate pitch; caller merges with Solar API
      confidence: 0.7,
      dataSource: 'ml-model',
      timing: { inferenceMs, vectorizeMs, totalMs },
    });
  } catch (err) {
    console.error('[ML] detect-edges error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Inference failed' });
  }
});

/**
 * POST /api/ml/vision/reload
 * Hot-reload the ONNX model (after deploying a new version).
 */
router.post('/reload', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    await reloadModel();
    const status = isModelAvailable();
    res.json({ reloaded: true, ...status });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Reload failed' });
  }
});

export { router as mlVisionRouter };
