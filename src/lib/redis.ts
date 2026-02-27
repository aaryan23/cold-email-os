import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

export default redis;
