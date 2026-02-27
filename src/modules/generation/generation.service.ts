import { z } from 'zod';
import prisma from '../../lib/prisma';
import { claudeJson } from '../../lib/claude';
import { logger } from '../../lib/logger';
import { getActiveReport } from '../research/research.service';
import { retrieve } from '../rag/rag.service';
import { buildCampaignPrompt } from './prompts/campaign.prompt';
import { KbChunk } from '@prisma/client';

const generationOutputSchema = z.object({
  angles: z.array(
    z.object({
      angle_name: z.string(),
      angle_summary: z.string(),
      sequence: z.array(
        z.object({
          step: z.number(),
          subject: z.string(),
          body: z.string(),
        })
      ),
    })
  ).min(1),
});

export type GenerationOutput = z.infer<typeof generationOutputSchema>;

export class ConflictError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ConflictError';
  }
}

type ChunkWithDoc = KbChunk & { document: { doc_type: string; title: string } };

export async function listGenerations(tenantId: string) {
  return prisma.generation.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
    select: { id: true, output_json: true, created_at: true },
  });
}

export async function generateCampaigns(params: {
  tenantId: string;
  persona: string;
  vertical: string;
  sequenceLength: number;
}) {
  const { tenantId, persona, vertical, sequenceLength } = params;

  // Require active research report
  const report = await getActiveReport(tenantId);
  if (!report) {
    throw new ConflictError('No active research report found. Run research first.');
  }

  // RAG retrieval
  const chunks = (await retrieve({
    tenantId,
    query: `${persona} ${vertical}`,
    vertical,
    topK: 15,
  })) as ChunkWithDoc[];

  const { system, user } = buildCampaignPrompt({
    reportText:  report.report_text,
    reportJson:  (report.report_json as Record<string, unknown>) ?? {},
    chunks,
    persona,
    vertical,
    sequenceLength,
  });

  logger.info({ tenantId, persona, vertical, chunks: chunks.length }, 'Generating campaigns');

  let output: GenerationOutput;
  try {
    const raw = await claudeJson<unknown>(system, user, 8192);
    output = generationOutputSchema.parse(raw);
  } catch (err) {
    logger.error({ err }, 'Campaign generation failed — invalid Claude output');
    throw err;
  }

  // Store generation (append-only — every call creates new row = free history)
  const generation = await prisma.generation.create({
    data: {
      tenant_id: tenantId,
      retrieved_chunk_ids: chunks.map((c) => c.id),
      output_json: output as object,
    },
  });

  // Advance tenant status
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: 'READY_TO_GENERATE' },
  });

  return generation;
}
