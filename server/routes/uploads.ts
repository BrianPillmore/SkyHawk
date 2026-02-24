import { Router, type Request, type Response } from 'express';
import multer from 'multer';
// pdf-parse v2 has private-typed methods that work at runtime; use type assertion
import { PDFParse as PDFParseClass } from 'pdf-parse';

interface PDFParseRuntime {
  load(buffer: Buffer): Promise<void>;
  getInfo(): Promise<{ numPages?: number; [key: string]: unknown }>;
  getText(page: { pageNumber: number }): Promise<{ text: string }>;
  destroy(): void;
}

function createParser(): PDFParseRuntime {
  return new PDFParseClass({}) as unknown as PDFParseRuntime;
}
import { query } from '../db/index.js';

const router = Router();

// Configure multer for PDF uploads (10MB max, memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  },
});

interface AuthenticatedRequest extends Request {
  user: { username: string; userId?: string };
}

/**
 * Parse EagleView-style fields from extracted PDF text.
 */
function parseEagleViewData(text: string): {
  address: string | null;
  totalAreaSqFt: number | null;
  facetCount: number | null;
  predominantPitch: string | null;
  pitchBreakdown: Array<{ pitch: string; area: number }>;
  wastePercent: number | null;
} {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Address: often on one of the first lines, look for common patterns
  let address: string | null = null;
  for (const line of lines.slice(0, 20)) {
    // Match street address pattern (number + street name)
    if (/^\d+\s+[A-Za-z]/.test(line) && line.length < 200) {
      address = line;
      break;
    }
  }

  // Total area
  let totalAreaSqFt: number | null = null;
  const areaMatch = text.match(/Total\s+(?:Roof\s+)?Area[:\s]*([0-9,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|SF)/i)
    || text.match(/([0-9,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|SF)\s*(?:Total|total)/i);
  if (areaMatch) {
    totalAreaSqFt = parseFloat(areaMatch[1].replace(/,/g, ''));
  }

  // Facet count
  let facetCount: number | null = null;
  const facetMatch = text.match(/(?:Number\s+of\s+)?Facets?[:\s]*(\d+)/i)
    || text.match(/(\d+)\s+facets?/i);
  if (facetMatch) {
    facetCount = parseInt(facetMatch[1], 10);
  }

  // Predominant pitch
  let predominantPitch: string | null = null;
  const pitchMatch = text.match(/(?:Predominant|Primary)\s+Pitch[:\s]*(\d+\/12)/i)
    || text.match(/(\d+\/12)/);
  if (pitchMatch) {
    predominantPitch = pitchMatch[1];
  }

  // Pitch breakdown
  const pitchBreakdown: Array<{ pitch: string; area: number }> = [];
  const pitchLineRegex = /(\d+\/12)\s+([0-9,]+(?:\.\d+)?)\s*(?:sq\.?\s*ft|SF)?/gi;
  let pitchLineMatch;
  while ((pitchLineMatch = pitchLineRegex.exec(text)) !== null) {
    pitchBreakdown.push({
      pitch: pitchLineMatch[1],
      area: parseFloat(pitchLineMatch[2].replace(/,/g, '')),
    });
  }

  // Waste percent
  let wastePercent: number | null = null;
  const wasteMatch = text.match(/(?:Suggested\s+)?Waste[:\s]*(\d+(?:\.\d+)?)\s*%/i);
  if (wasteMatch) {
    wastePercent = parseFloat(wasteMatch[1]);
  }

  return { address, totalAreaSqFt, facetCount, predominantPitch, pitchBreakdown, wastePercent };
}

/**
 * POST /api/uploads/eagleview
 * Upload an EagleView PDF, extract data, and award 2 credits (max 6 total).
 */
router.post(
  '/eagleview',
  upload.single('file'),
  async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      res.status(400).json({ error: 'User account not linked to database' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No PDF file provided' });
      return;
    }

    try {
      // Extract text from PDF
      const parser = createParser();
      await parser.load(req.file.buffer);
      const info = await parser.getInfo();
      const numPages = info?.numPages ?? 0;
      const textParts: string[] = [];
      for (let i = 1; i <= numPages; i++) {
        const result = await parser.getText({ pageNumber: i });
        if (result?.text) textParts.push(result.text);
      }
      const extractedText = textParts.join('\n');
      parser.destroy();

      // Parse EagleView fields
      const parsed = parseEagleViewData(extractedText);

      // Insert upload record
      const insertResult = await query<{ id: string }>(
        `INSERT INTO eagleview_uploads (user_id, filename, address, total_area_sqft, facet_count, predominant_pitch, pitch_breakdown, waste_percent, raw_extracted_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          userId,
          req.file.originalname,
          parsed.address,
          parsed.totalAreaSqFt,
          parsed.facetCount,
          parsed.predominantPitch,
          JSON.stringify(parsed.pitchBreakdown),
          parsed.wastePercent,
          JSON.stringify({ text: extractedText.slice(0, 10000), parsed }),
        ],
      );

      // Award 2 credits, capped at 6 total
      const creditResult = await query<{ report_credits: number }>(
        'UPDATE users SET report_credits = LEAST(COALESCE(report_credits, 0) + 2, 6) WHERE id = $1 RETURNING report_credits',
        [userId],
      );

      const newCredits = creditResult.rows[0]?.report_credits ?? 0;

      res.status(201).json({
        id: insertResult.rows[0].id,
        filename: req.file.originalname,
        extractedData: parsed,
        creditsAwarded: 2,
        reportCredits: newCredits,
      });
    } catch (err) {
      console.error('EagleView upload error:', err);
      res.status(500).json({ error: 'Failed to process PDF' });
    }
  },
);

/**
 * GET /api/uploads/eagleview
 * List all EagleView uploads for the authenticated user.
 */
router.get('/eagleview', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.userId;

  if (!userId) {
    res.status(400).json({ error: 'User account not linked to database' });
    return;
  }

  try {
    const result = await query(
      `SELECT id, filename, address, total_area_sqft, facet_count, predominant_pitch, waste_percent, credits_awarded, created_at
       FROM eagleview_uploads
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    res.json({ uploads: result.rows });
  } catch (err) {
    console.error('List uploads error:', err);
    res.status(500).json({ error: 'Failed to list uploads' });
  }
});

/**
 * GET /api/uploads/eagleview/:id
 * Get a single EagleView upload with full extracted data.
 */
router.get('/eagleview/:id', async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user?.userId;

  if (!userId) {
    res.status(400).json({ error: 'User account not linked to database' });
    return;
  }

  try {
    const result = await query(
      `SELECT * FROM eagleview_uploads WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Upload not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get upload error:', err);
    res.status(500).json({ error: 'Failed to get upload' });
  }
});

export { router as uploadsRouter };
