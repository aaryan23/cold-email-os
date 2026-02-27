import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { logger } from './lib/logger';
import { login, requireAuth } from './middleware/auth';

// Module routers (imported after they're created)
import tenantRoutes from './modules/tenant/tenant.routes';
import researchRoutes from './modules/research/research.routes';
import kbRoutes from './modules/kb/kb.routes';
import ragRoutes from './modules/rag/rag.routes';
import generationRoutes from './modules/generation/generation.routes';
import smartleadRoutes from './modules/smartlead/smartlead.routes';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Auth
app.post('/auth/login', (req: Request, res: Response) => {
  try {
    const { password } = req.body as { password?: string };
    if (!password) return res.status(400).json({ error: 'Password required' });
    const token = login(password);
    res.json({ token });
  } catch {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Protected routes
app.use('/tenants', requireAuth);
app.use('/tenants', tenantRoutes);
app.use('/tenants', researchRoutes);
app.use('/tenants', kbRoutes);
app.use('/tenants', ragRoutes);
app.use('/tenants', generationRoutes);
app.use('/tenants', smartleadRoutes);

// API 404 (only for /tenants/* and /health)
app.use('/tenants', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error & { issues?: { path: (string|number)[]; message: string }[] }, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled error');

  if (err.name === 'ZodError' && err.issues) {
    const msg = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    return res.status(400).json({ error: msg });
  }
  if (err.name === 'NotFoundError') {
    return res.status(404).json({ error: err.message });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'ConflictError') {
    return res.status(409).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
});

export default app;
