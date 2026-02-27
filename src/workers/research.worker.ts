import { Worker } from 'bullmq';
import { env } from '../config/env'; // triggers env validation + dotenv
void env;

import redis from '../lib/redis';
import prisma from '../lib/prisma';
import { logger } from '../lib/logger';
import { ResearchJobData } from '../lib/queue';
import { fetchPageContent } from '../lib/jina';
import { parseTranscript, TranscriptInsights } from '../modules/research/pipeline/transcript-parser';
import { runYouTubeResearch, YouTubeInsights } from '../modules/research/pipeline/youtube-research';
import { runRedditResearch, RedditInsights } from '../modules/research/pipeline/reddit-research';
import { runCompetitorResearch, CompetitorInsights } from '../modules/research/pipeline/competitor-research';
import { runCustomerDnaResearch, CustomerDnaReport } from '../modules/research/pipeline/customer-dna';
import { YouTubeVideo } from '../lib/apify';
import { RedditPost } from '../lib/apify';

interface ReportJson {
  client_name: string;
  client_offer: string;
  icp_summary: string;
  painful_problem: string;
  search_keywords: string[];
  competitor_queries: string[];
  youtube_insights: YouTubeInsights | null;
  reddit_segments: RedditInsights | null;
  competitor_analysis: CompetitorInsights | null;
  customer_dna: CustomerDnaReport | null;
}

type InsightItem = string | { name: string; description: string; sub_points?: string[] };
type NamedPoint  = { name: string; points: string[] };

function flattenInsight(item: InsightItem): string {
  if (typeof item === 'string') return item;
  const subs = item.sub_points?.map(s => `    * ${s}`).join('\n') ?? '';
  return `${item.name}: ${item.description}${subs ? '\n' + subs : ''}`;
}

function flattenReportToText(report: ReportJson): string {
  const lines: string[] = [];

  lines.push(`CLIENT: ${report.client_name}`);
  lines.push(`OFFER: ${report.client_offer}`);
  lines.push(`ICP: ${report.icp_summary}`);
  lines.push(`PAINFUL PROBLEM: ${report.painful_problem}`);

  if (report.youtube_insights) {
    lines.push('\nYOUTUBE INSIGHTS:');
    lines.push('Problems:');
    for (const p of report.youtube_insights.problems as InsightItem[]) lines.push('  - ' + flattenInsight(p));
    lines.push('Desires:');
    for (const d of report.youtube_insights.desires as InsightItem[]) lines.push('  - ' + flattenInsight(d));
  }

  if (report.reddit_segments) {
    lines.push('\nREDDIT RESEARCH:');
    lines.push('Overarching Dream: ' + report.reddit_segments.overarching_dream);
    for (const seg of report.reddit_segments.segments) {
      lines.push(`\nSegment: ${seg.name}`);
      const ext = seg as typeof seg & { core_driver?: string; motivations?: NamedPoint[]; tradeoffs?: NamedPoint[] };
      if (ext.core_driver) lines.push('Core Driver: ' + ext.core_driver);
      lines.push('Problems: ' + seg.problems.join('; '));
      lines.push('Desires: ' + seg.desires.join('; '));
      if (ext.motivations) {
        lines.push('Motivations:');
        for (const m of ext.motivations) lines.push(`  - ${m.name}: ${m.points.join(' | ')}`);
      }
      if (ext.tradeoffs) {
        lines.push('Tradeoffs:');
        for (const t of ext.tradeoffs) lines.push(`  - ${t.name}: ${t.points.join(' | ')}`);
      }
    }
  }

  if (report.competitor_analysis) {
    lines.push('\nCOMPETITOR ANALYSIS:');
    for (const comp of report.competitor_analysis.competitors) {
      lines.push(`\n${comp.name} (${comp.url})`);
      lines.push('Quotes: ' + comp.marketing_quotes.join(' | '));
      lines.push('Strength: ' + comp.positioning_strength);
      lines.push('Gap: ' + comp.strategic_gap);
    }
  }

  if (report.customer_dna) {
    const dna = report.customer_dna;
    lines.push('\nCUSTOMER DNA INTELLIGENCE:');
    lines.push('Daily Reality: ' + dna.daily_reality);
    lines.push('Internal Narrative: ' + dna.internal_narrative);
    lines.push('Solution Archaeology: ' + dna.solution_archaeology);
    lines.push('Belief System: ' + dna.belief_system);
    lines.push('Market Intelligence: ' + dna.market_intelligence);
    lines.push('Positioning Angle: ' + dna.positioning_angle);
    lines.push('\nHeadlines:');
    for (const h of dna.headlines) lines.push(`  - ${h.headline} [${h.annotation}]`);
    lines.push('\nAction Summary:');
    lines.push('Biggest Opportunity: ' + dna.action_summary.biggest_opportunity);
    lines.push('Biggest Risk: ' + dna.action_summary.biggest_risk);
  }

  return lines.join('\n');
}

export function startResearchWorker(): Worker<ResearchJobData> {
  const worker = new Worker<ResearchJobData>(
    'research',
    async (job) => {
      const { tenantId, transcriptText, reportId, websiteUrl } = job.data;
      logger.info({ tenantId, reportId }, 'Research job started');

      // Optionally enrich transcript with website content
      let fullContext = transcriptText;
      if (websiteUrl) {
        try {
          logger.info({ tenantId, websiteUrl }, 'Fetching website content');
          const siteContent = await fetchPageContent(websiteUrl);
          if (siteContent && siteContent.length > 50) {
            fullContext = `WEBSITE CONTENT (${websiteUrl}):\n${siteContent.slice(0, 8000)}\n\n---\n\nONBOARDING TRANSCRIPT:\n${transcriptText}`;
            logger.info({ tenantId, websiteUrl }, 'Website content fetched and prepended');
          }
        } catch (err) {
          logger.warn({ err, tenantId, websiteUrl }, 'Website fetch failed — continuing without it');
        }
      }

      // Step 1: Parse transcript (blocking — needed for steps 2-4)
      let parsed: TranscriptInsights;
      try {
        parsed = await parseTranscript(fullContext);
        logger.info({ tenantId, client: parsed.client_name }, 'Transcript parsed');
      } catch (err) {
        logger.error({ err, tenantId }, 'Transcript parsing failed');
        throw err; // Fatal — retry the whole job
      }

      // Steps 2-4: Run SEQUENTIALLY to avoid exceeding the 30k input-token/min rate limit.
      // Running them in parallel causes all three Claude calls to fire simultaneously, which
      // blows the org-level rate limit and results in 429 errors on YouTube and Reddit.
      type Settled<T> = { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown };
      async function tryStep<T>(fn: () => Promise<T>): Promise<Settled<T>> {
        try { return { status: 'fulfilled', value: await fn() }; }
        catch (reason) { return { status: 'rejected', reason }; }
      }

      const youtubeResult    = await tryStep(() => runYouTubeResearch(parsed));
      const redditResult     = await tryStep(() => runRedditResearch(parsed));
      const competitorResult = await tryStep(() => runCompetitorResearch(parsed));

      if (youtubeResult.status === 'rejected') {
        logger.warn({ err: youtubeResult.reason }, 'YouTube research failed — continuing');
      }
      if (redditResult.status === 'rejected') {
        logger.warn({ err: redditResult.reason }, 'Reddit research failed — continuing');
      }
      if (competitorResult.status === 'rejected') {
        logger.warn({ err: competitorResult.reason }, 'Competitor research failed — continuing');
      }

      // Extract insights + raw data
      const youtubeInsights = youtubeResult.status === 'fulfilled' ? youtubeResult.value.insights : null;
      const rawVideos: YouTubeVideo[] = youtubeResult.status === 'fulfilled' ? youtubeResult.value.rawVideos : [];
      const redditInsights = redditResult.status === 'fulfilled' ? redditResult.value.insights : null;
      const rawPosts: RedditPost[] = redditResult.status === 'fulfilled' ? redditResult.value.rawPosts : [];

      // Step 5: CustomerDNA — deep psychographic analysis using raw scraped data
      let customerDna: CustomerDnaReport | null = null;
      try {
        logger.info({ tenantId }, 'CustomerDNA analysis started');
        customerDna = await runCustomerDnaResearch(parsed, rawPosts, rawVideos);
        logger.info({ tenantId }, 'CustomerDNA analysis complete');
      } catch (err) {
        logger.warn({ err, tenantId }, 'CustomerDNA analysis failed — continuing without it');
      }

      const report_json: ReportJson = {
        ...parsed,
        youtube_insights: youtubeInsights,
        reddit_segments:  redditInsights,
        competitor_analysis: competitorResult.status === 'fulfilled' ? competitorResult.value : null,
        customer_dna: customerDna,
      };

      const report_text = flattenReportToText(report_json);

      // Atomic update: deactivate old reports + activate new one + advance tenant status
      await prisma.$transaction([
        prisma.researchReport.updateMany({
          where: { tenant_id: tenantId, is_active: true },
          data: { is_active: false },
        }),
        prisma.researchReport.update({
          where: { id: reportId },
          data: { report_json: report_json as object, report_text, is_active: true },
        }),
        prisma.tenant.update({
          where: { id: tenantId },
          data: { status: 'RESEARCH_READY' },
        }),
      ]);

      logger.info({ tenantId, reportId }, 'Research pipeline complete');
    },
    { connection: redis }
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Research job permanently failed');
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Research job completed successfully');
  });

  logger.info('Research worker started');
  return worker;
}

// Standalone mode: node dist/workers/research.worker.js
if (require.main === module) {
  const worker = startResearchWorker();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Worker shutting down...');
    await worker.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
