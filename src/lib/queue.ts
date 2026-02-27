import { Queue } from 'bullmq';
import redis from './redis';

export const researchQueue = new Queue('research', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

researchQueue.on('error', (err) => {
  console.error('[Queue error]', err.message);
});

export interface ResearchJobData {
  tenantId: string;
  transcriptText: string;
  reportId: string;
  websiteUrl?: string;
}
