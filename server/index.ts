import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { visionRouter } from './routes/vision.js';
import { authRouter } from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Vision API proxy routes (protected)
app.use('/api/vision', requireAuth, visionRouter);

app.listen(PORT, () => {
  console.log(`SkyHawk API server listening on port ${PORT}`);
});
