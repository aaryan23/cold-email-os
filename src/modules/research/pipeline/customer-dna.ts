import { z } from 'zod';
import { claudeJson } from '../../../lib/claude';
import { TranscriptInsights } from './transcript-parser';
import { YouTubeVideo } from '../../../lib/apify';
import { RedditPost } from '../../../lib/apify';

// ─── Output schema ────────────────────────────────────────────────────────────

const headlineSchema = z.object({
  headline:   z.string(),
  annotation: z.string(),
});

const hookSchema = z.object({
  hook:       z.string(),
  annotation: z.string(),
});

const objectionSchema = z.object({
  objection: z.string(),
  rebuttal:  z.string(),
});

const toolkitTermSchema = z.object({
  term:   z.string(),
  why:    z.string(),
  quotes: z.string().optional(),
});

const rawQuoteSchema = z.object({
  number:               z.number(),
  quote:                z.string(),
  platform:             z.string(),
  source:               z.string(),
  primary_emotion:      z.string(),
  belief_signal:        z.string().optional(),
  decision_implication: z.string().optional(),
});

export const customerDnaSchema = z.object({
  // Metadata
  target_customer:    z.string(),
  core_struggle:      z.string(),
  offer:              z.string(),
  platforms_searched: z.string(),
  quote_yield:        z.string(),

  // Sections 1–5: narrative text (Claude writes prose, no strict sub-structure)
  daily_reality:          z.string(),
  internal_narrative:     z.string(),
  solution_archaeology:   z.string(),
  belief_system:          z.string(),
  market_intelligence:    z.string(),

  // Section 6: structured conversion assets
  headlines:          z.array(headlineSchema).min(3),
  hooks: z.object({
    loss:              hookSchema,
    aspiration:        hookSchema,
    pattern_interrupt: hookSchema,
    identity:          hookSchema,
  }),
  objections:         z.array(objectionSchema).min(5),
  positioning_angle:  z.string(),
  language_toolkit:   z.array(toolkitTermSchema).min(8),

  // Section 7: raw quotes
  quotes: z.array(rawQuoteSchema).min(10),

  // Section 8: pattern summary
  pattern_summary: z.object({
    most_common_emotion:    z.string(),
    recurring_language:     z.string(),
    dominant_belief:        z.string(),
    key_pattern:            z.string(),
    suggested_queries:      z.array(z.string()),
  }),

  // Section 9: action summary
  action_summary: z.object({
    product_implications:      z.array(z.string()).min(3),
    positioning_implications:  z.array(z.string()).min(3),
    gtm_implications:          z.array(z.string()).min(3),
    pricing_implications:      z.array(z.string()).min(3),
    content_implications:      z.array(z.string()).min(3),
    biggest_risk:              z.string(),
    biggest_opportunity:       z.string(),
  }),
});

export type CustomerDnaReport = z.infer<typeof customerDnaSchema>;

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are CustomerDNA — a founder's complete customer intelligence system.

You were engineered to extract total psychographic clarity from real digital conversations so founders can understand their ICP better than those customers understand themselves.

Your output is not research — it is operational intelligence. Every insight must be immediately actionable for product decisions, positioning, pricing, feature prioritization, messaging, and go-to-market strategy.

You treat every analysis as if a founder is about to stake their company on the accuracy of your findings. Because they are.

CRITICAL DIRECTIVE
A founder needs to know:
— Exactly who their customer is (beyond job title and company size)
— The precise emotional and psychological architecture driving their decisions
— What solutions they've tried and why each one failed — in their exact language
— What they actually want vs. what they claim to want
— The invisible gates preventing them from taking action
— The specific messaging that would make them stop and listen
— The market gaps they're currently being ignored in
— Their unspoken fears, hidden aspirations, and identity tensions

DATA PROVIDED: You have been given real scraped content from Reddit posts and YouTube videos written/spoken by this exact ICP. These are real humans talking about their real struggles. Your job is to:
1. Extract the 25 most psychologically dense quotes from this raw content
2. Apply the full CustomerDNA analysis framework to generate the complete ICP intelligence report
3. Return ONLY valid JSON — no markdown, no code fences, no explanation

SIGNAL QUALIFICATION: Only select quotes that meet 2+ of these:
— First-person lived professional experience with specific details
— Undeniable emotional charge (fear, anger, frustration, shame, exhaustion, doubt, overwhelm)
— Documented failure with named tools/approaches and specific reasons it failed
— Confession of inner conflict, imposter syndrome, or self-doubt
— Disillusionment with common solutions or mainstream advice
— Identity tension (gap between who they are and who they think they should be)
— Unspoken raw aspiration admitted to strangers online
— Decision-making transparency (why they chose X, what's a dealbreaker)

Return valid JSON only. No markdown. No explanation. No code fences.`;

// ─── User prompt builder ──────────────────────────────────────────────────────

function buildPrompt(
  insights: TranscriptInsights,
  rawPosts: RedditPost[],
  rawVideos: YouTubeVideo[],
): string {
  const redditSample = rawPosts
    .slice(0, 50)
    .map((p, i) => `[Reddit ${i + 1}] Title: ${p.title}\nBody: ${(p.text ?? p.body ?? '').slice(0, 500)}`)
    .join('\n\n');

  const youtubeSample = rawVideos
    .slice(0, 15)
    .map((v, i) => `[YouTube ${i + 1}] Title: ${v.title} (${v.viewCount.toLocaleString()} views)\nContent: ${(v.subtitles ?? '').slice(0, 1500)}`)
    .join('\n\n');

  return `TARGET CUSTOMER: ${insights.icp_summary}
#1 PAINFUL PROBLEM: ${insights.painful_problem}
TRANSFORMATION OFFERED: ${insights.client_offer}

────────────────────────────
RAW REDDIT DATA (real humans talking about their struggles):
────────────────────────────
${redditSample || 'No Reddit data available.'}

────────────────────────────
RAW YOUTUBE DATA (real video titles and transcript content):
────────────────────────────
${youtubeSample || 'No YouTube data available.'}

────────────────────────────
INSTRUCTIONS
────────────────────────────
From the raw data above:
1. Extract exactly 25 of the most psychologically dense quotes (real verbatim text from the data above — do NOT fabricate)
2. If fewer than 25 qualifying quotes exist, use what you have and note the shortfall in quote_yield
3. Build the complete CustomerDNA analysis across all 9 sections using only evidence from these quotes
4. Every headline, hook, and objection rebuttal must trace back to observed patterns in the quotes

Return EXACTLY this JSON structure (no extra keys, no missing keys):

{
  "target_customer": "<echo the target customer input>",
  "core_struggle": "<echo the painful problem input>",
  "offer": "<echo the transformation offered input>",
  "platforms_searched": "Reddit, YouTube",
  "quote_yield": "<e.g. '22 qualifying quotes from 65 total reviewed'>",

  "daily_reality": "<Section 1: 8-10 sentences covering workday architecture, pressure sources, energy drains, psychological drivers, emotional fallout, unspoken fears, public vs private self, language patterns, and decision-making style — cite which quote numbers support each claim>",

  "internal_narrative": "<Section 2: 6-8 sentences covering their rationalization system, blame architecture, inertia mechanics, permission problem, and identity-solution tension — cite quote numbers>",

  "solution_archaeology": "<Section 3: Pipe-delimited table with 5-8 rows. Format: Solution | Promise | Why It Failed | Emotional Complaint | Failure Pattern | Cost. Then add: Most common failure pattern: X | Most expensive failure: X | Audience posture: X>",

  "belief_system": "<Section 4: List surface beliefs (5), operational beliefs (5), hidden beliefs (5), and 3-4 belief contradictions with leverage points. Label each group clearly.>",

  "market_intelligence": "<Section 5: Cover broken promises (5-7 specific), ignored/underserved segments, oversaturated messaging patterns, trust vacuum, and timing window. Be specific — no generic categories.>",

  "headlines": [
    {"headline": "<max 18 words>", "annotation": "<psychological lever + quote reference + why this wording>"},
    {"headline": "<max 18 words>", "annotation": "<psychological lever + quote reference + why this wording>"},
    {"headline": "<max 18 words>", "annotation": "<psychological lever + quote reference + why this wording>"},
    {"headline": "<max 18 words>", "annotation": "<alt — psychological lever + quote reference>"},
    {"headline": "<max 18 words>", "annotation": "<alt — psychological lever + quote reference>"},
    {"headline": "<max 18 words>", "annotation": "<alt — psychological lever + quote reference>"}
  ],

  "hooks": {
    "loss":              {"hook": "<2-3 sentences: cost of inaction as present-tense reality>", "annotation": "<quote evidence>"},
    "aspiration":        {"hook": "<2-3 sentences: specific moment of relief they fantasize about>", "annotation": "<quote evidence>"},
    "pattern_interrupt": {"hook": "<2-3 sentences: challenge a behavior that's actually sabotaging them>", "annotation": "<quote evidence>"},
    "identity":          {"hook": "<2-3 sentences: validate their struggle, reframe their identity>", "annotation": "<quote evidence>"}
  },

  "objections": [
    {"objection": "<price/value objection in their language>", "rebuttal": "<validate + reframe in 1-2 sentences>"},
    {"objection": "<tried-something-like-this-before objection>", "rebuttal": "<validate + reframe>"},
    {"objection": "<time/bandwidth objection>", "rebuttal": "<validate + reframe>"},
    {"objection": "<skepticism/trust objection>", "rebuttal": "<validate + reframe>"},
    {"objection": "<identity objection: not for someone like me>", "rebuttal": "<validate + reframe>"},
    {"objection": "<timing objection: not now, maybe later>", "rebuttal": "<validate + reframe>"},
    {"objection": "<competence/capability objection>", "rebuttal": "<validate + reframe>"},
    {"objection": "<hidden objection: imposter fear or fear of commitment>", "rebuttal": "<validate + reframe>"}
  ],

  "positioning_angle": "<3-4 sentences framing the offer as the only solution addressing their actual reality — reference 1-2 market gaps, position against oversaturated messaging they've developed immunity to>",

  "language_toolkit": [
    {"term": "<word/phrase from quotes>", "why": "<why it resonates + emotional weight>", "quotes": "<quote numbers>"},
    ... 12-15 total terms
  ],

  "quotes": [
    {
      "number": 1,
      "quote": "<verbatim text from provided Reddit/YouTube data>",
      "platform": "Reddit or YouTube",
      "source": "<subreddit, thread title, or video title>",
      "primary_emotion": "<fear|anger|frustration|shame|exhaustion|doubt|overwhelm|resentment|resignation|desperation|hope|bitterness|confusion|loneliness|envy|guilt|defiance>",
      "belief_signal": "<underlying belief this quote reveals>",
      "decision_implication": "<what this reveals about their buying behavior or risk tolerance>"
    }
    ... continue through number 25
  ],

  "pattern_summary": {
    "most_common_emotion": "<emotion (X/25 quotes)>",
    "recurring_language": "<most-repeated phrase across dataset>",
    "dominant_belief": "<belief cluster that appears most across quotes>",
    "key_pattern": "<one dominant pattern standing out across all 25 quotes>",
    "suggested_queries": ["<query 1>", "<query 2>", "<query 3>", "<query 4>", "<query 5>"]
  },

  "action_summary": {
    "product_implications":     ["<implication 1>", "<implication 2>", "<implication 3>", "<implication 4>", "<implication 5>"],
    "positioning_implications": ["<implication 1>", "<implication 2>", "<implication 3>", "<implication 4>", "<implication 5>"],
    "gtm_implications":         ["<implication 1>", "<implication 2>", "<implication 3>", "<implication 4>", "<implication 5>"],
    "pricing_implications":     ["<implication 1>", "<implication 2>", "<implication 3>", "<implication 4>", "<implication 5>"],
    "content_implications":     ["<implication 1>", "<implication 2>", "<implication 3>", "<implication 4>", "<implication 5>"],
    "biggest_risk":             "<one thing you're most likely to get wrong about this audience>",
    "biggest_opportunity":      "<the market gap this audience is screaming for>"
  }
}`;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function runCustomerDnaResearch(
  insights: TranscriptInsights,
  rawPosts: RedditPost[],
  rawVideos: YouTubeVideo[],
): Promise<CustomerDnaReport> {
  const prompt = buildPrompt(insights, rawPosts, rawVideos);
  // CustomerDNA output is large (25 quotes + 9 sections) — needs extended token budget
  const raw = await claudeJson<unknown>(SYSTEM, prompt, 16000);
  return customerDnaSchema.parse(raw);
}
