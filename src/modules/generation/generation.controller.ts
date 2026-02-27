import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getTenantById } from '../tenant/tenant.service';
import { listGenerations, generateCampaigns } from './generation.service';

const generateSchema = z.object({
  persona: z.string().min(1),
  vertical: z.string().min(1),
  sequence_length: z.coerce.number().int().min(2).max(6).default(4),
});

export async function handleListGenerations(req: Request, res: Response, next: NextFunction) {
  try {
    const generations = await listGenerations(req.params.id);
    res.json(generations);
  } catch (err) {
    next(err);
  }
}

export async function handleGenerate(req: Request, res: Response, next: NextFunction) {
  try {
    await getTenantById(req.params.id); // validates tenant exists
    const { persona, vertical, sequence_length } = generateSchema.parse(req.body);

    const generation = await generateCampaigns({
      tenantId: req.params.id,
      persona,
      vertical,
      sequenceLength: sequence_length,
    });

    res.status(201).json({
      generation_id: generation.id,
      output: generation.output_json,
    });
  } catch (err) {
    next(err);
  }
}
