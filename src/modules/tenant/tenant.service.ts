import prisma from '../../lib/prisma';
import { Prisma, TenantStatus } from '@prisma/client';

export interface CreateTenantDto {
  name: string;
  smartlead_api_key?: string;
  airtable_config?: Prisma.InputJsonValue;
  notion_config?: Prisma.InputJsonValue;
}

export class NotFoundError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ValidationError';
  }
}

export async function listTenants() {
  return prisma.tenant.findMany({ orderBy: { created_at: 'desc' } });
}

export async function createTenant(data: CreateTenantDto) {
  return prisma.tenant.create({
    data: {
      name: data.name,
      smartlead_api_key: data.smartlead_api_key,
      airtable_config: data.airtable_config ?? undefined,
      notion_config: data.notion_config ?? undefined,
    },
  });
}

export async function getTenantById(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new NotFoundError(`Tenant ${id} not found`);
  return tenant;
}

export async function updateTenantStatus(id: string, status: TenantStatus) {
  await getTenantById(id); // throws if not found
  return prisma.tenant.update({ where: { id }, data: { status } });
}

export async function deleteTenant(id: string) {
  await getTenantById(id); // throws if not found
  // Delete child records first (no schema-level cascade set)
  await prisma.$transaction([
    prisma.smartleadStat.deleteMany({ where: { campaign: { tenant_id: id } } }),
    prisma.smartleadReply.deleteMany({ where: { campaign: { tenant_id: id } } }),
    prisma.smartleadCampaign.deleteMany({ where: { tenant_id: id } }),
    prisma.generation.deleteMany({ where: { tenant_id: id } }),
    prisma.researchReport.deleteMany({ where: { tenant_id: id } }),
    prisma.kbChunk.deleteMany({ where: { document: { tenant_id: id } } }),
    prisma.kbDocument.deleteMany({ where: { tenant_id: id } }),
    prisma.tenant.delete({ where: { id } }),
  ]);
}
