import { env } from '../config/env';
import { logger } from './logger';

const JINA_SEARCH_BASE = 'https://s.jina.ai';
const JINA_READER_BASE = 'https://r.jina.ai';
const REDDIT_URL_REGEX = /reddit\.com\/r\/[^/]+\/comments\/[^/]+/;

function jinaHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...extra,
  };
  if (env.JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${env.JINA_API_KEY}`;
  }
  return headers;
}

export interface JinaSearchResult {
  title: string;
  url: string;
  description?: string;
  content?: string;
}

export async function searchReddit(query: string): Promise<string[]> {
  try {
    const url = `${JINA_SEARCH_BASE}/${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: jinaHeaders({
        'X-Respond-With': 'no-content',
        'X-Site': 'reddit.com',
        'X-Retain-Images': 'none',
      }),
    });

    if (!res.ok) {
      logger.warn({ query, status: res.status }, 'Jina Reddit search failed');
      return [];
    }

    const text = await res.text();

    // Extract Reddit comment thread URLs
    const urls: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const match = line.match(/https?:\/\/(?:www\.)?reddit\.com\/r\/[^/]+\/comments\/[^\s)"]+/);
      if (match && REDDIT_URL_REGEX.test(match[0])) {
        urls.push(match[0]);
        if (urls.length >= 5) break;
      }
    }

    return urls;
  } catch (err) {
    logger.error({ err, query }, 'Jina Reddit search error — returning empty');
    return [];
  }
}

export async function searchWeb(query: string): Promise<JinaSearchResult[]> {
  try {
    const url = `${JINA_SEARCH_BASE}/${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: jinaHeaders({
        'X-Engine': 'direct',
        'X-Retain-Images': 'none',
      }),
    });

    if (!res.ok) {
      logger.warn({ query, status: res.status }, 'Jina web search failed');
      return [];
    }

    const text = await res.text();
    // Parse markdown-style results into structured objects
    const results: JinaSearchResult[] = [];
    const blocks = text.split(/\n---\n|\n\n(?=\d+\.\s)/);

    for (const block of blocks.slice(0, 10)) {
      const titleMatch = block.match(/^#+\s+(.+)$/m);
      const urlMatch = block.match(/URL[:\s]+([^\s\n]+)/i) || block.match(/https?:\/\/[^\s\n]+/);
      const descMatch = block.match(/(?:Description|Snippet)[:\s]+(.+?)(?:\n|$)/i);

      if (urlMatch) {
        results.push({
          title: titleMatch ? titleMatch[1].trim() : '',
          url: urlMatch[1] || urlMatch[0],
          description: descMatch ? descMatch[1].trim() : undefined,
          content: block.slice(0, 15_000),
        });
      }
    }

    return results;
  } catch (err) {
    logger.error({ err, query }, 'Jina web search error — returning empty');
    return [];
  }
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const readerUrl = `${JINA_READER_BASE}/${url}`;
    const res = await fetch(readerUrl, {
      headers: jinaHeaders({ 'X-Retain-Images': 'none' }),
    });

    if (!res.ok) {
      logger.warn({ url, status: res.status }, 'Jina reader fetch failed');
      return '';
    }

    return res.text();
  } catch (err) {
    logger.error({ err, url }, 'Jina reader error — returning empty');
    return '';
  }
}
