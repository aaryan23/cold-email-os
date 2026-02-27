import prisma from '../../lib/prisma';

export interface ChunkMetadata {
  vertical: string;
  offer_type: string;
  funnel_stage: string;
  tone: string;
  performance_tag: 'winner' | 'average' | 'loser' | 'unknown';
}

export interface CreateDocumentDto {
  tenantId?: string;
  title: string;
  doc_type: string;
  source_type: string;
}

export interface ChunkInput {
  chunk_text: string;
  metadata: ChunkMetadata;
}

export async function createDocument(data: CreateDocumentDto) {
  return prisma.kbDocument.create({
    data: {
      tenant_id: data.tenantId ?? null,
      title: data.title,
      doc_type: data.doc_type,
      source_type: data.source_type,
    },
  });
}

export async function createChunks(documentId: string, tenantId: string | null, chunks: ChunkInput[]) {
  return prisma.kbChunk.createMany({
    data: chunks.map((c) => ({
      document_id: documentId,
      tenant_id: tenantId ?? null,
      chunk_text: c.chunk_text,
      metadata: c.metadata as object,
    })),
  });
}

export async function documentExists(title: string, source_type: string): Promise<boolean> {
  const existing = await prisma.kbDocument.findFirst({
    where: { title, source_type },
  });
  return existing !== null;
}

export async function getChunksByTenantAndGlobal(tenantId: string) {
  return prisma.kbChunk.findMany({
    where: {
      OR: [{ tenant_id: tenantId }, { tenant_id: null }],
    },
    include: { document: true },
  });
}

export function splitIntoChunks(text: string, metadata: ChunkMetadata): ChunkInput[] {
  // Split on double newlines (paragraph-level)
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30); // skip very short paragraphs

  // Merge very short paragraphs with the next one to reach ~300 token minimum
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length < 300) {
      current += (current ? '\n\n' : '') + para;
    } else {
      if (current) chunks.push(current);
      // If single para is > 1500 chars, split it further
      if (para.length > 1500) {
        const sentences = para.split(/(?<=[.!?])\s+/);
        let sub = '';
        for (const s of sentences) {
          if (sub.length + s.length > 1200) {
            if (sub) chunks.push(sub.trim());
            sub = s;
          } else {
            sub += (sub ? ' ' : '') + s;
          }
        }
        if (sub) chunks.push(sub.trim());
        current = '';
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);

  return chunks.map((c) => ({ chunk_text: c, metadata }));
}
