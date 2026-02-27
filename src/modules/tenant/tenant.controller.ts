import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma, TenantStatus } from '@prisma/client';
import { listTenants, createTenant, getTenantById, updateTenantStatus, deleteTenant } from './tenant.service';

const createSchema = z.object({
  name: z.string().min(1),
  smartlead_api_key: z.string().optional(),
  airtable_config: z.record(z.unknown()).optional(),
  notion_config: z.record(z.unknown()).optional(),
});

const statusSchema = z.object({
  status: z.nativeEnum(TenantStatus),
});

export async function handleList(_req: Request, res: Response, next: NextFunction) {
  try {
    const tenants = await listTenants();
    res.json(tenants);
  } catch (err) {
    next(err);
  }
}

export async function handleCreate(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.parse(req.body);
    const tenant = await createTenant(body as {
      name: string;
      smartlead_api_key?: string;
      airtable_config?: Prisma.InputJsonValue;
      notion_config?: Prisma.InputJsonValue;
    });
    res.status(201).json(tenant);
  } catch (err) {
    next(err);
  }
}

export async function handleGet(req: Request, res: Response, next: NextFunction) {
  try {
    const tenant = await getTenantById(req.params.id);
    res.json(tenant);
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = statusSchema.parse(req.body);
    const tenant = await updateTenantStatus(req.params.id, status);
    res.json(tenant);
  } catch (err) {
    next(err);
  }
}

export async function handleDelete(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteTenant(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
