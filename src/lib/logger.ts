import pino from 'pino';
import { env } from '../config/env';

export const logger = pino(
  env.NODE_ENV === 'development'
    ? {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : { level: 'info' }
);
