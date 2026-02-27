/**
 * Global KB seed ingestion script
 * Run: npm run kb:ingest:global
 *
 * Reads all .md files from /seed/global/
 * Parses YAML frontmatter for metadata
 * Creates KbDocument + KbChunks for each file
 * Idempotent: skips files already ingested
 */

import path from 'path';
import fs from 'fs';
import { env } from '../../config/env'; // triggers env validation

// Suppress unused import warning — env import is for side effects (validation)
void env;

import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { createDocument, createChunks, documentExists, splitIntoChunks, ChunkMetadata } from './kb.service';

const SEED_DIR = path.resolve(__dirname, '../../../seed/global');

interface Frontmatter {
  title: string;
  doc_type: string;
  source_type: string;
  vertical: string;
  offer_type: string;
  funnel_stage: string;
  tone: string;
  performance_tag: 'winner' | 'average' | 'loser' | 'unknown';
}

function parseFrontmatter(content: string): { meta: Frontmatter; body: string } {
  const fmMatch = content.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error('No frontmatter found in file');
  }

  const fmLines = fmMatch[1].split('\n');
  const meta: Partial<Frontmatter> = {};

  for (const line of fmLines) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      (meta as Record<string, string>)[key.trim()] = rest.join(':').trim();
    }
  }

  return {
    meta: {
      title: meta.title || 'Untitled',
      doc_type: meta.doc_type || 'guide',
      source_type: meta.source_type || 'global_seed',
      vertical: meta.vertical || 'all',
      offer_type: meta.offer_type || 'all',
      funnel_stage: meta.funnel_stage || 'awareness',
      tone: meta.tone || 'direct',
      performance_tag: (meta.performance_tag as ChunkMetadata['performance_tag']) || 'unknown',
    },
    body: fmMatch[2].trim(),
  };
}

async function ingestFile(filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const filename = path.basename(filePath);

  let meta: Frontmatter;
  let body: string;

  try {
    ({ meta, body } = parseFrontmatter(content));
  } catch {
    logger.warn({ filename }, 'Skipping — no frontmatter');
    return;
  }

  // Idempotency check
  if (await documentExists(meta.title, 'global_seed')) {
    logger.info({ title: meta.title }, 'Already ingested — skipping');
    return;
  }

  const doc = await createDocument({
    tenantId: undefined,
    title: meta.title,
    doc_type: meta.doc_type,
    source_type: 'global_seed',
  });

  const chunkMetadata: ChunkMetadata = {
    vertical: meta.vertical,
    offer_type: meta.offer_type,
    funnel_stage: meta.funnel_stage,
    tone: meta.tone,
    performance_tag: meta.performance_tag,
  };

  const chunks = splitIntoChunks(body, chunkMetadata);
  await createChunks(doc.id, null, chunks);

  logger.info({ title: meta.title, chunks: chunks.length }, 'Ingested');
}

async function main() {
  await prisma.$connect();
  logger.info('Starting global KB ingestion...');

  const files = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.md'));
  logger.info({ count: files.length }, 'Seed files found');

  for (const file of files) {
    await ingestFile(path.join(SEED_DIR, file));
  }

  logger.info('Global KB ingestion complete');
  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error({ err }, 'Ingestion failed');
  process.exit(1);
});
