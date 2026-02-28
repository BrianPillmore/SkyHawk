import { Router, type Request, type Response } from 'express';
import { apiLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(apiLimiter);

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const VISION_ENABLED = process.env.ENABLE_CLAUDE_VISION === 'true';

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  return key;
}

/** Standard 503 response when Claude Vision is disabled */
function sendDisabled(res: Response) {
  res.status(503).json({
    error: 'service_unavailable',
    message: 'AI Vision is not currently enabled. Please use the drawing tools to trace the roof manually, or set ENABLE_CLAUDE_VISION=true to re-enable.',
  });
}

/**
 * POST /api/vision/analyze
 * Proxy for roof outline analysis via Claude Vision.
 * Body: { imageBase64, imageBounds, imageSize?, model?, max_tokens? }
 */
router.post('/analyze', async (req: Request, res: Response) => {
  if (!VISION_ENABLED) return sendDisabled(res);

  try {
    const { imageBase64, imageBounds, imageSize = 640, model, max_tokens } = req.body;

    if (!imageBase64 || !imageBounds) {
      res.status(400).json({ error: 'imageBase64 and imageBounds are required' });
      return;
    }

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-5-20250929',
        max_tokens: max_tokens || 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analyze this satellite image of a building roof. The image is ${imageSize}x${imageSize} pixels.

Return a JSON object with:
1. "outline": array of {x, y} pixel coordinates tracing the building roof outline clockwise. Use 8-20 points to define the polygon. Each x,y should be in the range [0, ${imageSize}].
2. "roofType": one of "flat", "shed", "gable", "hip", "complex"
3. "ridgeDirection": angle in degrees (0=north, 90=east) of the main ridge line, if applicable
4. "numFacets": estimated number of roof facets
5. "estimatedPitchDegrees": estimated roof pitch in degrees (typical residential: 15-35 degrees)

Return ONLY the JSON object, no other text.`,
            },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      res.status(anthropicRes.status).json({ error: `Anthropic API error: ${anthropicRes.status}`, details: body });
      return;
    }

    const data = await anthropicRes.json();
    res.json(data);
  } catch (err) {
    console.error('Vision analyze error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/vision/condition
 * Proxy for roof condition analysis via Claude Vision.
 * Body: { imageBase64, model?, max_tokens? }
 */
router.post('/condition', async (req: Request, res: Response) => {
  if (!VISION_ENABLED) return sendDisabled(res);

  try {
    const { imageBase64, model, max_tokens } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 is required' });
      return;
    }

    const prompt = `Analyze this aerial/satellite image of a roof and provide a detailed condition assessment.

Return a JSON object with:
- overallScore: number 1-100 (100=perfect, 1=failed)
- estimatedAgeYears: estimated age in years based on visual wear
- materialType: one of "asphalt-shingle", "metal", "tile", "slate", "wood-shake", "tpo", "epdm", "built-up", "concrete", "unknown"
- materialConfidence: 0-1 confidence in material identification
- damages: array of detected damage areas, each with:
  - type: "hail", "wind", "missing-shingle", "crack", "ponding", "debris", "other"
  - severity: "minor", "moderate", "severe"
  - description: brief description
  - confidence: 0-1
- findings: array of observation strings

Assess wear patterns, color fading, granule loss, curling, missing/damaged areas, debris, moss/algae growth, and structural issues.

Return ONLY valid JSON, no markdown.`;

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-5-20250929',
        max_tokens: max_tokens || 2048,
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
          }, {
            type: 'text',
            text: prompt,
          }],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      res.status(anthropicRes.status).json({ error: `Anthropic API error: ${anthropicRes.status}`, details: body });
      return;
    }

    const data = await anthropicRes.json();
    res.json(data);
  } catch (err) {
    console.error('Vision condition error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/vision/detect-edges
 * AI-powered roof edge detection from satellite imagery.
 * Body: { imageBase64, imageBounds, imageSize? }
 * Returns individual edges with types + pixel coordinates.
 */
router.post('/detect-edges', async (req: Request, res: Response) => {
  if (!VISION_ENABLED) return sendDisabled(res);

  try {
    const { imageBase64, imageBounds, imageSize = 640, model, max_tokens, solarSegments } = req.body;

    if (!imageBase64 || !imageBounds) {
      res.status(400).json({ error: 'imageBase64 and imageBounds are required' });
      return;
    }

    // Build segment hints for the AI if Solar API data is available
    let segmentHint = '';
    if (solarSegments && Array.isArray(solarSegments) && solarSegments.length > 0) {
      const segDetails = solarSegments.map((seg: { center: { latitude: number; longitude: number }; pitchDegrees: number; azimuthDegrees: number; stats: { areaMeters2: number } }, i: number) => {
        // Convert segment center lat/lng to approximate pixel coordinates
        const px = Math.round(((seg.center.longitude - imageBounds.west) / (imageBounds.east - imageBounds.west)) * imageSize);
        const py = Math.round(((imageBounds.north - seg.center.latitude) / (imageBounds.north - imageBounds.south)) * imageSize);
        const areaSqFt = Math.round(seg.stats.areaMeters2 * 10.7639);
        return `  Segment ${i + 1}: center ~(${px},${py}), pitch ${seg.pitchDegrees.toFixed(0)}°, azimuth ${seg.azimuthDegrees.toFixed(0)}°, ~${areaSqFt} sqft`;
      }).join('\n');

      segmentHint = `
IMPORTANT CONTEXT: Google's Solar API detected ${solarSegments.length} distinct roof plane segments:
${segDetails}

Your edge network MUST subdivide the roof into approximately ${solarSegments.length} enclosed regions (facets).
Every intersection point must be shared precisely between all edges that meet there.
`;
    }

    const prompt = `Analyze this ${imageSize}x${imageSize} satellite image of a building roof. Identify ALL visible roof structural lines and classify each one.
${segmentHint}
Return a JSON object with:
1. "edges": array of detected roof edges. Each edge has:
   - "type": one of "ridge", "hip", "valley", "rake", "eave", "flashing"
   - "start": {x, y} pixel coordinates of the edge start point (0-${imageSize})
   - "end": {x, y} pixel coordinates of the edge end point (0-${imageSize})
2. "roofType": one of "flat", "shed", "gable", "hip", "cross-gable", "complex"
3. "estimatedPitchDegrees": estimated roof pitch in degrees (typical residential: 15-35)
4. "confidence": 0-1 confidence score for the overall detection

Rules for edge detection:
- "ridge": the peak line at the top of the roof where two slopes meet
- "hip": diagonal lines running from a ridge end down to an eave corner
- "valley": interior lines where two roof planes meet going downward
- "rake": sloped edges at the gable end of a roof
- "eave": horizontal edges at the bottom/perimeter of the roof
- "flashing": lines where the roof meets a wall or chimney

CRITICAL RULES:
- Trace the actual visible roof lines precisely.
- Include ALL edges: ridges, hips, valleys, rakes, AND eaves around the full perimeter.
- Place endpoints EXACTLY where lines intersect — every junction must be a shared vertex.
- The edges must form a CONNECTED PLANAR GRAPH that divides the roof into closed polygonal regions.
- Ensure the perimeter edges (eave + rake) form a complete closed loop around the roof.
- Internal edges (ridge, hip, valley) must connect between perimeter vertices or other internal vertices.

Return ONLY the JSON object, no other text.`;

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getApiKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-5-20250929',
        max_tokens: max_tokens || 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        }],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      res.status(anthropicRes.status).json({ error: `Anthropic API error: ${anthropicRes.status}`, details: body });
      return;
    }

    const data = await anthropicRes.json();
    res.json(data);
  } catch (err) {
    console.error('Vision detect-edges error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as visionRouter };
