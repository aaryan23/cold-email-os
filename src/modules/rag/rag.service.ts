import { KbChunk } from '@prisma/client';
import { getChunksByTenantAndGlobal } from '../kb/kb.service';

export interface RetrieveOptions {
  tenantId: string;
  query: string;
  vertical?: string;
  offer_type?: string;
  funnel_stage?: string;
  topK?: number;
}

interface ScoredChunk {
  chunk: KbChunk & { document: { doc_type: string } };
  score: number;
}

type ChunkWithDoc = KbChunk & { document: { doc_type: string } };

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function tokenOverlapScore(queryTokens: Set<string>, chunkText: string): number {
  if (queryTokens.size === 0) return 0;
  const chunkTokens = tokenize(chunkText);
  let shared = 0;
  for (const t of queryTokens) {
    if (chunkTokens.has(t)) shared++;
  }
  return shared / queryTokens.size;
}

const PERFORMANCE_MULTIPLIERS: Record<string, number> = {
  winner: 1.5,
  average: 1.0,
  loser: 0.5,
  unknown: 1.0,
};

export async function retrieve(opts: RetrieveOptions): Promise<ChunkWithDoc[]> {
  const { tenantId, query, vertical, topK = 15 } = opts;

  const allChunks = (await getChunksByTenantAndGlobal(tenantId)) as ChunkWithDoc[];

  // Separate canonical playbook chunks (global, doc_type = 'playbook')
  const playbookChunks = allChunks.filter(
    (c) => c.tenant_id === null && c.document.doc_type === 'playbook'
  );
  const otherChunks = allChunks.filter(
    (c) => !(c.tenant_id === null && c.document.doc_type === 'playbook')
  );

  const queryTokens = tokenize(query);

  // Score playbook chunks
  const scoredPlaybook: ScoredChunk[] = playbookChunks.map((chunk) => {
    const meta = chunk.metadata as Record<string, string>;
    let score = tokenOverlapScore(queryTokens, chunk.chunk_text);
    score *= PERFORMANCE_MULTIPLIERS[meta.performance_tag] ?? 1.0;
    if (vertical && meta.vertical && meta.vertical !== 'all' && meta.vertical === vertical) {
      score += 0.2;
    }
    return { chunk, score };
  });

  // Score other chunks
  const scoredOther: ScoredChunk[] = otherChunks.map((chunk) => {
    const meta = chunk.metadata as Record<string, string>;
    let score = tokenOverlapScore(queryTokens, chunk.chunk_text);
    score *= PERFORMANCE_MULTIPLIERS[meta.performance_tag] ?? 1.0;
    if (vertical && meta.vertical && meta.vertical !== 'all' && meta.vertical === vertical) {
      score += 0.2;
    }
    return { chunk, score };
  });

  // Sort by score descending
  scoredPlaybook.sort((a, b) => b.score - a.score);
  scoredOther.sort((a, b) => b.score - a.score);

  // Always include 3-5 canonical playbook chunks
  const canonicalChunks = scoredPlaybook.slice(0, 5).map((s) => s.chunk);

  // Apply max-2-per-document rule to other chunks
  const docCount: Record<string, number> = {};
  const topOther: ChunkWithDoc[] = [];

  for (const { chunk } of scoredOther) {
    const docId = chunk.document_id;
    const count = docCount[docId] ?? 0;
    if (count < 2) {
      topOther.push(chunk);
      docCount[docId] = count + 1;
      if (topOther.length >= topK - canonicalChunks.length) break;
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  const result: ChunkWithDoc[] = [];

  for (const chunk of [...canonicalChunks, ...topOther]) {
    if (!seen.has(chunk.id)) {
      seen.add(chunk.id);
      result.push(chunk);
    }
  }

  return result;
}
