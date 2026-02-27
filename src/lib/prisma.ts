import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

prisma.$on('warn', (e) => logger.warn(e, 'Prisma warning'));
prisma.$on('error', (e) => logger.error(e, 'Prisma error'));

export default prisma;
