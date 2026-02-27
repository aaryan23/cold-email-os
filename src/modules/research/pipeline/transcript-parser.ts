import { z } from 'zod';
import { claudeJson } from '../../../lib/claude';

const transcriptInsightsSchema = z.object({
  client_name: z.string(),
  client_offer: z.string(),
  icp_summary: z.string(),
  painful_problem: z.string(),
  search_keywords: z.array(z.string()).length(15),
  competitor_queries: z.array(z.string()).length(5),
});

export type TranscriptInsights = z.infer<typeof transcriptInsightsSchema>;

const SYSTEM = `You are an expert B2B market researcher. Extract structured information from onboarding call transcripts.
Return valid JSON only. No markdown. No explanation. No code fences.`;

const USER = (transcript: string) => `
Analyze this onboarding call transcript and extract the following in JSON format:

{
  "client_name": "Company or person name (fallback: 'UNABLE_TO_IDENTIFY')",
  "client_offer": "Single sentence: '[Company] helps [Target Market] achieve [Benefit] by providing [Mechanism/Service]'",
  "icp_summary": "3-4 sentences describing the Ideal Customer Profile with pain points in the client's own language",
  "painful_problem": "1-2 sentences describing the #1 specific, daily, tangible manifestation of their biggest problem — not a category, but what it physically feels like day-to-day",
  "search_keywords": ["exactly 15 broad, high-volume search keywords, lowercase, 2-5 words each, relevant to the ICP and offer"],
  "competitor_queries": ["exactly 5 competitor-focused commercial intent queries like 'best [service] for [market]'"]
}

TRANSCRIPT:
${transcript.slice(0, 12000)}
`;

export async function parseTranscript(transcriptText: string): Promise<TranscriptInsights> {
  const raw = await claudeJson<unknown>(SYSTEM, USER(transcriptText));
  return transcriptInsightsSchema.parse(raw);
}
