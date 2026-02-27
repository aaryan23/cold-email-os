import { z } from 'zod';
import { searchReddit } from '../../../lib/jina';
import { runRedditScrape, RedditPost } from '../../../lib/apify';
import { claudeJson } from '../../../lib/claude';
import { TranscriptInsights } from './transcript-parser';

const namedPointSchema = z.object({
  name:   z.string(),
  points: z.array(z.string()).length(2),
});

const redditSegmentsSchema = z.object({
  overarching_dream: z.string(),
  segments: z.array(
    z.object({
      name:         z.string(),
      problems:     z.array(z.string()).length(5),
      desires:      z.array(z.string()).length(5),
      core_driver:  z.string(),
      motivations:  z.array(namedPointSchema).length(5),
      tradeoffs:    z.array(namedPointSchema).length(5),
      citations:    z.array(z.string()),
    })
  ).length(2),
});

export type RedditInsights = z.infer<typeof redditSegmentsSchema>;

export interface RedditResearchResult {
  insights: RedditInsights;
  rawPosts: RedditPost[];
}

function dedupPosts(posts: RedditPost[]): RedditPost[] {
  const seen = new Set<string>();
  return posts.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
}

const SYSTEM = `You are a digital anthropologist and buyer psychologist analyzing online communities.
Extract DEEP psychological profiles — named archetypes, identity tensions, behavioral drivers.
Every segment must feel like a real person the reader immediately recognizes.
Return valid JSON only. No markdown. No explanation. No code fences.`;

export async function runRedditResearch(insights: TranscriptInsights): Promise<RedditResearchResult> {
  const urlBatches = await Promise.all(
    insights.search_keywords.map((kw) => searchReddit(kw))
  );

  const allUrls = [...new Set(urlBatches.flat())].slice(0, 75);

  if (allUrls.length === 0) {
    const emptyMotivation = { name: 'No data', points: ['No Reddit data available', 'Re-run with different keywords'] };
    return {
      insights: {
        overarching_dream: 'No Reddit data available',
        segments: [
          { name: 'Segment A', problems: Array(5).fill('N/A'), desires: Array(5).fill('N/A'), core_driver: 'No data', motivations: Array(5).fill(emptyMotivation), tradeoffs: Array(5).fill(emptyMotivation), citations: [] },
          { name: 'Segment B', problems: Array(5).fill('N/A'), desires: Array(5).fill('N/A'), core_driver: 'No data', motivations: Array(5).fill(emptyMotivation), tradeoffs: Array(5).fill(emptyMotivation), citations: [] },
        ],
      },
      rawPosts: [],
    };
  }

  const posts = dedupPosts(await runRedditScrape(allUrls));

  const postData = posts.slice(0, 100).map((p) => ({
    title: p.title,
    url:   p.url,
    body:  (p.text ?? p.body ?? '').slice(0, 1500),
  }));

  const prompt = `
ICP Summary: ${insights.icp_summary}
Offer: ${insights.client_offer}

Analyze these Reddit discussions as a digital anthropologist.
Identify 2 DISTINCT, NAMED customer archetypes with DEEP psychological profiling.
Use authentic Reddit language — verbatim-style phrases, not corporate speak.

Return JSON with EXACTLY this structure:

{
  "overarching_dream": "The single deepest outcome both segments are chasing (1 aspirational sentence)",
  "segments": [
    {
      "name": "Behavior-based archetype name (e.g. 'The Story-Starved Strategist')",
      "problems": [
        "Authentic Reddit-style phrase capturing the problem (e.g. 'Storytelling: How the hell do I approach it?')",
        "Another verbatim-style pain (conversational, gritty, unpolished)",
        "...",
        "...",
        "..."
      ],
      // Exactly 5 problems — use Reddit language: blunt, frustrated, real
      "desires": [
        "What they explicitly say they want (authentic, first-person-ish language)",
        "...",
        "...",
        "...",
        "..."
      ],
      // Exactly 5 desires
      "core_driver": "2-3 sentences: the central psychological tension — their core fear, their identity wound, and what they are REALLY seeking beneath the surface",
      "motivations": [
        {
          "name": "Named motivation (e.g. 'Differentiation through Emotion')",
          "points": [
            "First specific belief or behavior that drives this motivation (what they believe/do)",
            "Second belief/behavior that reinforces this motivation (deeper layer)"
          ]
        },
        { "name": "...", "points": ["...", "..."] },
        { "name": "...", "points": ["...", "..."] },
        { "name": "...", "points": ["...", "..."] },
        { "name": "...", "points": ["...", "..."] }
      ],
      // Exactly 5 motivations
      "tradeoffs": [
        {
          "name": "Named tradeoff/challenge (e.g. 'Paralysis by Analysis')",
          "points": [
            "How this tradeoff manifests in their actual behavior (observable pattern)",
            "The downstream consequence or cost this creates for them"
          ]
        },
        { "name": "...", "points": ["...", "..."] },
        { "name": "...", "points": ["...", "..."] },
        { "name": "...", "points": ["...", "..."] },
        { "name": "...", "points": ["...", "..."] }
      ],
      // Exactly 5 tradeoffs
      "citations": ["Reddit post title 1 that informed this segment", "Reddit post title 2", "..."]
      // Up to 8 most relevant post titles used as source material
    },
    {
      "name": "Second archetype name",
      // ... same structure
    }
  ]
}

REDDIT POSTS:
${JSON.stringify(postData.slice(0, 30), null, 2)}
`;

  const raw = await claudeJson<unknown>(SYSTEM, prompt);
  const parsedInsights = redditSegmentsSchema.parse(raw);
  return { insights: parsedInsights, rawPosts: posts };
}
