import { env } from '../config/env';
import { logger } from './logger';

const APIFY_BASE = 'https://api.apify.com/v2';
const TIMEOUT_MS = 600_000; // 10 minutes per Apify run

interface ApifyRun {
  id: string;
  status: string;
  defaultDatasetId: string;
}

async function startRun(actorId: string, input: Record<string, unknown>): Promise<ApifyRun> {
  const res = await fetch(`${APIFY_BASE}/acts/${actorId}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.APIFY_API_TOKEN}`,
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw new Error(`Apify run start failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { data: ApifyRun };
  return data.data;
}

async function waitForRun(runId: string): Promise<ApifyRun> {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${env.APIFY_API_TOKEN}` },
    });

    if (!res.ok) continue;

    const data = (await res.json()) as { data: ApifyRun };
    const run = data.data;

    if (run.status === 'SUCCEEDED') return run;
    if (run.status === 'FAILED' || run.status === 'ABORTED') {
      throw new Error(`Apify run ${runId} ended with status: ${run.status}`);
    }
  }

  throw new Error(`Apify run ${runId} timed out after ${TIMEOUT_MS}ms`);
}

async function getDataset<T>(datasetId: string): Promise<T[]> {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?limit=200`, {
    headers: { Authorization: `Bearer ${env.APIFY_API_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`Apify dataset fetch failed: ${res.status}`);
  }

  return res.json() as Promise<T[]>;
}

export interface YouTubeVideo {
  id: string;
  title: string;
  url: string;
  channelName: string;
  viewCount: number;
  likes?: number;
  date?: string;
  subtitles?: string;
}

export async function runYouTubeSearch(queries: string[]): Promise<YouTubeVideo[]> {
  try {
    // Limit to 5 queries × 3 results = 15 videos — keeps Apify run under ~3 min
    const topQueries = queries.slice(0, 5);
    const run = await startRun('h7sDV53CddomktSi5', {
      searchQueries: topQueries,
      maxResults: 3,
      downloadSubtitles: true,
      subtitleLanguage: 'en',
      subtitleFormat: 'plaintext',
    });

    const completed = await waitForRun(run.id);
    const items = await getDataset<YouTubeVideo>(completed.defaultDatasetId);
    logger.info({ count: items.length }, 'YouTube scrape completed');
    return items;
  } catch (err) {
    logger.error({ err }, 'YouTube Apify scrape failed — returning empty');
    return [];
  }
}

export interface RedditPost {
  id: string;
  title: string;
  url: string;
  text?: string;
  body?: string;
}

export async function runRedditScrape(urls: string[]): Promise<RedditPost[]> {
  if (urls.length === 0) return [];

  try {
    const run = await startRun('TwqHBuZZPHJxiQrTU', {
      startUrls: urls.map((url) => ({ url })),
      maxComments: 100,
      maxPosts: 100,
      scrapeComments: false,
    });

    const completed = await waitForRun(run.id);
    const items = await getDataset<RedditPost>(completed.defaultDatasetId);
    logger.info({ count: items.length }, 'Reddit scrape completed');
    return items;
  } catch (err) {
    logger.error({ err }, 'Reddit Apify scrape failed — returning empty');
    return [];
  }
}
