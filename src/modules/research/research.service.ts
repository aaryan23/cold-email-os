import prisma from '../../lib/prisma';
import { researchQueue, ResearchJobData } from '../../lib/queue';
import { NotFoundError } from '../tenant/tenant.service';

export async function enqueueResearch(
  tenantId: string,
  transcriptText: string,
  websiteUrl?: string,
): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError(`Tenant ${tenantId} not found`);

  const report = await prisma.researchReport.create({
    data: {
      tenant_id: tenantId,
      transcript_text: transcriptText,
      report_json: {},
      report_text: '',
      is_active: false,
    },
  });

  await researchQueue.add('research', {
    tenantId,
    transcriptText,
    reportId: report.id,
    websiteUrl,
  } satisfies ResearchJobData);

  return report.id;
}

export async function getActiveReport(tenantId: string) {
  return prisma.researchReport.findFirst({
    where: { tenant_id: tenantId, is_active: true },
  });
}
