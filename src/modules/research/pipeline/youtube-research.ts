import { z } from 'zod';
import { runYouTubeSearch, YouTubeVideo } from '../../../lib/apify';
import { searchWeb } from '../../../lib/jina';
import { claudeJson } from '../../../lib/claude';
import { TranscriptInsights } from './transcript-parser';
import { logger } from '../../../lib/logger';

const insightItemSchema = z.object({
  name:        z.string(),
  description: z.string(),
  // Claude sometimes returns 1-3 sub_points instead of exactly 2 — accept any count
  sub_points:  z.array(z.string()).min(1),
});

const videoSummarySchema = z.object({
  title:       z.string(),
  url:         z.string(),
  summary:     z.string(),
  pain_points: z.array(z.object({ name: z.string(), description: z.string() })),
  desires:     z.array(z.object({ name: z.string(), description: z.string() })),
});

const youtubeInsightsSchema = z.object({
  // Claude returns 4-8 items — never lock to exactly 6
  problems:        z.array(insightItemSchema).min(1),
  desires:         z.array(insightItemSchema).min(1),
  video_summaries: z.array(videoSummarySchema),
});

export type YouTubeInsights = z.infer<typeof youtubeInsightsSchema>;

export interface YouTubeResearchResult {
  insights: YouTubeInsights;
  rawVideos: YouTubeVideo[];
}

const EMPTY_RESULT: YouTubeResearchResult = {
  insights: {
    problems: Array(6).fill({ name: 'No data', description: 'YouTube research returned no results.', sub_points: ['Check Apify credits or retry', 'Try different keywords'] }),
    desires:  Array(6).fill({ name: 'No data', description: 'YouTube research returned no results.', sub_points: ['Check Apify credits or retry', 'Try different keywords'] }),
    video_summaries: [],
  },
  rawVideos: [],
};

function dedup(videos: YouTubeVideo[]): YouTubeVideo[] {
  const seen = new Set<string>();
  return videos.filter((v) => {
    if (!v.url || seen.has(v.url)) return false;
    seen.add(v.url);
    return true;
  });
}

function filterAndRank(videos: YouTubeVideo[]): YouTubeVideo[] {
  return dedup(videos)
    .filter((v) => (v.viewCount ?? 0) < 2_000_000)
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .slice(0, 50);
}

const SYSTEM = `You are a world-class B2B market researcher and buyer psychologist.
Your job is to extract DEEP, STRATEGIC, PSYCHOLOGICAL insights from YouTube content — not surface-level observations.
Every insight must be named, described with psychological depth, and grounded in behavioral reality.
Return valid JSON only. No markdown. No explanation. No code fences.`;

function buildAnalysisPrompt(insights: TranscriptInsights, videoData: object[]): string {
  return `
ICP Summary: ${insights.icp_summary}
Offer: ${insights.client_offer}

Analyze these YouTube videos as a deep buyer psychologist studying the ICP's mental world.
Extract STRATEGIC, PSYCHOLOGICAL patterns — named archetypes, identity traps, paradoxes.
Think in terms of: identity, fear, desire, behavioral loops, cognitive biases.

Return JSON with EXACTLY this structure:

{
  "problems": [
    {
      "name": "Dramatic named pattern (e.g. 'The Commoditized Vendor Identity Trap')",
      "description": "1-2 sentences: the psychological fear/anxiety/identity threat driving this problem",
      "sub_points": [
        "Specific manifestation: how this plays out in their daily reality or decision-making",
        "The emotional or financial consequence they experience because of this problem"
      ]
    }
  ],

  "desires": [
    {
      "name": "Dramatic named desire (e.g. 'The Guide Authority Status')",
      "description": "1-2 sentences: the psychological motivation and identity shift they crave",
      "sub_points": [
        "Specific aspiration: what success looks/feels like for them",
        "How they want to be perceived by peers, clients, or the market"
      ]
    }
  ],

  "video_summaries": [
    {
      "title": "exact video title",
      "url": "exact video url",
      "summary": "2-3 sentences: the video's core argument and why it resonates powerfully with this specific ICP",
      "pain_points": [{ "name": "Named psychological trap", "description": "1-2 sentences" }],
      "desires":     [{ "name": "Named aspiration",          "description": "1-2 sentences" }]
    }
  ]
}

VIDEOS:
${JSON.stringify(videoData.slice(0, 20), null, 2)}
`;
}

// ── Jina fallback: search YouTube via Jina when Apify returns nothing ──────────
async function getVideosViaJina(keywords: string[]): Promise<YouTubeVideo[]> {
  logger.info('Apify returned 0 YouTube videos — falling back to Jina search');

  const results = await Promise.all(
    keywords.slice(0, 5).map((kw) => searchWeb(`${kw} site:youtube.com`))
  );

  const seen = new Set<string>();
  const videos: YouTubeVideo[] = [];

  for (const batch of results) {
    for (const r of batch) {
      if (!r.url || !r.url.includes('youtube.com') || seen.has(r.url)) continue;
      seen.add(r.url);
      videos.push({
        id:          `jina-${videos.length}`,
        title:       r.title ?? '',
        url:         r.url,
        channelName: '',
        viewCount:   0,
        // Use description + any content snippet as the "subtitle" for analysis
        subtitles:   [r.title, r.description, r.content?.slice(0, 1500)]
          .filter(Boolean)
          .join('\n'),
      });
      if (videos.length >= 15) break;
    }
    if (videos.length >= 15) break;
  }

  logger.info({ count: videos.length }, 'Jina YouTube fallback completed');
  return videos;
}

// ── Main exported function ─────────────────────────────────────────────────────
export async function runYouTubeResearch(insights: TranscriptInsights): Promise<YouTubeResearchResult> {
  // Try Apify first
  let videos = await runYouTubeSearch(insights.search_keywords);
  let filtered = filterAndRank(videos);

  // If Apify gave nothing, fall back to Jina
  if (filtered.length === 0) {
    const jinaVideos = await getVideosViaJina(insights.search_keywords);
    filtered = jinaVideos;
  }

  if (filtered.length === 0) return EMPTY_RESULT;

  const videoData = filtered.slice(0, 20).map((v) => ({
    title:      v.title,
    url:        v.url,
    channel:    v.channelName,
    views:      v.viewCount,
    transcript: v.subtitles?.slice(0, 2000) ?? '',
  }));

  const prompt = buildAnalysisPrompt(insights, videoData);
  const raw = await claudeJson<unknown>(SYSTEM, prompt);
  const parsedInsights = youtubeInsightsSchema.parse(raw);
  return { insights: parsedInsights, rawVideos: filtered };
}
