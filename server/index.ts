import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { visionRouter } from './routes/vision.js';
import { authRouter } from './routes/auth.js';
import { propertiesRouter } from './routes/properties.js';
import { measurementsRouter } from './routes/measurements.js';
import { claimsRouter } from './routes/claims.js';
import { uploadsRouter } from './routes/uploads.js';
import { apiKeysRouter } from './routes/apiKeys.js';
import { reportsRouter } from './routes/reports.js';
import { auditRouter } from './routes/audit.js';
import { checkoutRouter } from './routes/checkout.js';
import { requireAuth } from './middleware/auth.js';
import { apiKeyAuth } from './middleware/apiKeyAuth.js';
import { auditLogger } from './middleware/auditLog.js';
import { initDb } from './db/index.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));

// Audit logging middleware — logs all mutating /api/ requests
app.use('/api', auditLogger);

// API key authentication — checks X-API-Key header before JWT auth
// Falls through to JWT auth if no API key header present
app.use('/api', apiKeyAuth);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Checkout & billing routes (auth handled inside router per-endpoint)
app.use('/api/checkout', checkoutRouter);
app.use('/api/webhooks/stripe', checkoutRouter);
app.use('/api/user', checkoutRouter);

// Vision API proxy routes (protected)
app.use('/api/vision', requireAuth, visionRouter);

// Property CRUD routes (protected)
app.use('/api/properties', requireAuth, propertiesRouter);

// Measurement routes (nested under properties, protected)
app.use('/api/properties/:propertyId/measurements', requireAuth, measurementsRouter);

// Claims routes (nested under properties, protected)
app.use('/api/properties/:propertyId/claims', requireAuth, claimsRouter);

// Upload routes (protected)
app.use('/api/uploads', requireAuth, uploadsRouter);

// API key management routes (protected)
app.use('/api/api-keys', requireAuth, apiKeysRouter);

// Report generation routes (protected)
app.use('/api/reports', requireAuth, reportsRouter);

// Audit log query routes (protected, RBAC enforced inside the router)
app.use('/api/audit-log', requireAuth, auditRouter);

// Start server
async function start() {
  // Try to connect to database (non-fatal if DATABASE_URL not set)
  if (process.env.DATABASE_URL) {
    try {
      await initDb();
    } catch (err) {
      console.warn('Database connection failed — running without persistence:', err);
    }
  } else {
    console.warn('DATABASE_URL not set — running without database persistence');
  }

  app.listen(PORT, () => {
    console.log(`SkyHawk API server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
