import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from './logger';

const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function claudeComplete(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<string> {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }
    return content.text;
  } catch (err) {
    logger.error({ err }, 'Claude API error');
    throw err;
  }
}

export async function claudeJson<T>(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<T> {
  const raw = await claudeComplete(systemPrompt, userPrompt, maxTokens);

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    logger.warn({ raw }, 'Failed to parse Claude JSON response');
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }
}
