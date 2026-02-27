import { z } from 'zod';
import { searchWeb } from '../../../lib/jina';
import { claudeJson } from '../../../lib/claude';
import { TranscriptInsights } from './transcript-parser';

const competitorAnalysisSchema = z.object({
  competitors: z.array(
    z.object({
      name:                 z.string(),
      url:                  z.string(),
      marketing_quotes:     z.array(z.string()).length(2),
      positioning_strength: z.string(),
      strategic_gap:        z.string(),
    })
  ).max(5),
});

export type CompetitorInsights = z.infer<typeof competitorAnalysisSchema>;

const SYSTEM = `You are a competitive intelligence strategist with expertise in positioning and messaging.
Your job is to dissect competitor positioning at a psychological level — not just what they say, but WHY it works or fails.
Return valid JSON only. No markdown. No explanation. No code fences.`;

export async function runCompetitorResearch(insights: TranscriptInsights): Promise<CompetitorInsights> {
  const results = await Promise.all(
    insights.competitor_queries.map((q) => searchWeb(q))
  );

  const allResults = results.flat();

  const seen = new Set<string>();
  const unique = allResults.filter((r) => {
    if (!r.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  const filtered = unique.filter((r) => r.description && r.description.length > 10);

  if (filtered.length === 0) {
    return { competitors: [] };
  }

  const siteData = filtered.slice(0, 15).map((r) => ({
    title:       r.title,
    url:         r.url,
    description: r.description,
    content:     (r.content ?? '').slice(0, 3000),
  }));

  const prompt = `
Client Offer: ${insights.client_offer}
ICP Summary: ${insights.icp_summary}

Analyze these websites and identify up to 5 DIRECT competitors.

EXCLUDE: directories (Clutch, G2, Capterra, etc.), blog posts, news articles, Fortune 500 enterprises.
INCLUDE: Direct service/product competitors targeting the same ICP.

For each competitor:
1. Extract 2 VERBATIM quotes from their homepage copy (word-for-word, not paraphrased)
2. Identify their POSITIONING STRENGTH — be specific: what psychological need does it meet? Why does it appeal to the ICP's identity or fears? Include the label AND a detailed explanation.
3. Identify their STRATEGIC GAP — a specific weakness in their messaging or positioning. NOT a technical issue. A psychological, strategic, or messaging gap that a smart competitor could exploit. Include the label AND a detailed explanation.

Return JSON:
{
  "competitors": [
    {
      "name": "Company name",
      "url": "website url",
      "marketing_quotes": [
        "Exact verbatim quote from their homepage — word for word",
        "Second exact verbatim quote"
      ],
      "positioning_strength": "Short label: Detailed 1-2 sentence explanation of WHY this positioning works — what ICP fear/desire it speaks to, and why it wins deals",
      "strategic_gap": "Short label: Detailed 1-2 sentence explanation of the positioning weakness — why it fails the ICP psychologically and what opportunity it creates for a differentiated competitor"
    }
  ]
}

WEBSITES:
${JSON.stringify(siteData, null, 2)}
`;

  const raw = await claudeJson<unknown>(SYSTEM, prompt);
  return competitorAnalysisSchema.parse(raw);
}
