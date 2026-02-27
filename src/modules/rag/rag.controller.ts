import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getTenantById } from '../tenant/tenant.service';
import { retrieve } from './rag.service';

const retrieveSchema = z.object({
  query: z.string().min(1),
  vertical: z.string().optional(),
  offer_type: z.string().optional(),
  funnel_stage: z.string().optional(),
  top_k: z.coerce.number().int().min(5).max(30).default(15),
});

export async function handleRetrieve(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await getTenantById(req.params.id);
    const opts = retrieveSchema.parse(req.body);

    const chunks = await retrieve({
      tenantId: tenant.id,
      query: opts.query,
      vertical: opts.vertical,
      offer_type: opts.offer_type,
      funnel_stage: opts.funnel_stage,
      topK: opts.top_k,
    });

    res.json({ chunks, count: chunks.length });
  } catch (err) {
    next(err);
  }
}
