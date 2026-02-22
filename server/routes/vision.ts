import { Router, type Request, type Response } from 'express';
import { apiLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(apiLimiter);

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  return key;
}

/**
 * POST /api/vision/analyze
 * Proxy for roof outline analysis via Claude Vision.
 * Body: { imageBase64, imageBounds, imageSize?, model?, max_tokens? }
 */
router.post('/analyze', async (req: Request, res: Response) => {
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

export { router as visionRouter };
