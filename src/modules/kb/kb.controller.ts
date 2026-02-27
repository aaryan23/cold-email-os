import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getTenantById } from '../tenant/tenant.service';
import { createDocument, createChunks, splitIntoChunks, ChunkMetadata } from './kb.service';

const metadataSchema = z.object({
  vertical: z.string().default('all'),
  offer_type: z.string().default('all'),
  funnel_stage: z.string().default('awareness'),
  tone: z.string().default('direct'),
  performance_tag: z.enum(['winner', 'average', 'loser', 'unknown']).default('unknown'),
});

export async function handleUpload(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await getTenantById(req.params.id);

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const title = (req.body.title as string) || file.originalname;
    const doc_type = (req.body.doc_type as string) || 'upload';
    const metadata = metadataSchema.parse(req.body);

    const text = file.buffer.toString('utf-8');

    const doc = await createDocument({
      tenantId: tenant.id,
      title,
      doc_type,
      source_type: 'tenant_upload',
    });

    const chunks = splitIntoChunks(text, metadata as ChunkMetadata);
    await createChunks(doc.id, tenant.id, chunks);

    res.status(201).json({ document_id: doc.id, chunks_created: chunks.length });
  } catch (err) {
    next(err);
  }
}
