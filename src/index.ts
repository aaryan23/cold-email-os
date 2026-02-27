import { env } from './config/env';
import { logger } from './lib/logger';
import prisma from './lib/prisma';
import redis from './lib/redis';
import app from './app';

async function main() {
  await prisma.$connect();
  logger.info('Database connected');

  const server = app.listen(env.PORT, () => {
    logger.info(`Cold Email OS running on port ${env.PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    server.close(async () => {
      await prisma.$disconnect();
      await redis.quit();
      logger.info('Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
