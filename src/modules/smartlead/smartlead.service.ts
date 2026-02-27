import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { NotFoundError, ValidationError } from '../tenant/tenant.service';

const SMARTLEAD_BASE = 'https://server.smartlead.ai/api/v1';

async function smartleadGet(apiKey: string, path: string): Promise<unknown> {
  const url = `${SMARTLEAD_BASE}${path}?api_key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ path, status: res.status }, 'Smartlead API returned non-200');
      return null;
    }
    return res.json();
  } catch (err) {
    logger.error({ err, path }, 'Smartlead API fetch error');
    return null;
  }
}

export async function syncCampaigns(tenantId: string): Promise<{ synced: number }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError(`Tenant ${tenantId} not found`);

  const apiKey = env.SMARTLEAD_API_KEY;
  if (!apiKey) throw new ValidationError('SMARTLEAD_API_KEY not configured in .env');

  const data = (await smartleadGet(apiKey, '/campaigns')) as {
    data?: Array<{ id: string; name: string; status?: string }>;
  } | null;

  if (!data?.data?.length) return { synced: 0 };

  let synced = 0;

  for (const campaign of data.data) {
    await prisma.smartleadCampaign.upsert({
      where: {
        tenant_id_smartlead_id: {
          tenant_id: tenantId,
          smartlead_id: String(campaign.id),
        },
      },
      update: {
        name: campaign.name,
        status: campaign.status ?? null,
        raw_data: campaign as object,
      },
      create: {
        tenant_id: tenantId,
        smartlead_id: String(campaign.id),
        name: campaign.name,
        status: campaign.status ?? null,
        raw_data: campaign as object,
      },
    });

    // Sync replies and stats for each campaign
    await syncReplies(tenantId, apiKey, String(campaign.id));
    await syncStats(tenantId, apiKey, String(campaign.id));

    synced++;
  }

  return { synced };
}

async function syncReplies(tenantId: string, apiKey: string, smartleadCampaignId: string): Promise<void> {
  const campaign = await prisma.smartleadCampaign.findFirst({
    where: { tenant_id: tenantId, smartlead_id: smartleadCampaignId },
  });
  if (!campaign) return;

  const data = (await smartleadGet(
    apiKey,
    `/campaigns/${smartleadCampaignId}/leads?status=INTERESTED`
  )) as { data?: Array<{ email: string; reply_category?: string; thread_url?: string }> } | null;

  if (!data?.data?.length) return;

  for (const reply of data.data) {
    const existing = await prisma.smartleadReply.findFirst({
      where: { campaign_id: campaign.id, lead_email: reply.email },
    });
    if (!existing) {
      await prisma.smartleadReply.create({
        data: {
          campaign_id: campaign.id,
          lead_email: reply.email,
          reply_type: reply.reply_category ?? 'interested',
          thread_url: reply.thread_url ?? null,
          raw_data: reply as object,
        },
      });
    }
  }
}

async function syncStats(tenantId: string, apiKey: string, smartleadCampaignId: string): Promise<void> {
  const campaign = await prisma.smartleadCampaign.findFirst({
    where: { tenant_id: tenantId, smartlead_id: smartleadCampaignId },
  });
  if (!campaign) return;

  const data = (await smartleadGet(
    apiKey,
    `/campaigns/${smartleadCampaignId}/analytics`
  )) as {
    sent_count?: number;
    open_count?: number;
    reply_count?: number;
    interested_count?: number;
  } | null;

  if (!data) return;

  // Insert snapshot (append-only to preserve history)
  await prisma.smartleadStat.create({
    data: {
      campaign_id: campaign.id,
      sent_count: data.sent_count ?? 0,
      open_count: data.open_count ?? 0,
      reply_count: data.reply_count ?? 0,
      interested_count: data.interested_count ?? 0,
    },
  });
}

export async function getCampaigns(tenantId: string) {
  return prisma.smartleadCampaign.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
  });
}

export async function getReplies(tenantId: string) {
  return prisma.smartleadReply.findMany({
    where: {
      campaign: { tenant_id: tenantId },
      reply_type: 'interested',
    },
    include: { campaign: { select: { name: true, smartlead_id: true } } },
    orderBy: { created_at: 'desc' },
  });
}
