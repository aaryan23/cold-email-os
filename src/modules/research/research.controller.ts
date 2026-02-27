import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { enqueueResearch, getActiveReport } from './research.service';

const runSchema = z.object({
  transcript_text: z.string().min(50, 'Transcript must be at least 50 characters'),
  website_url: z.string().url().optional(),
});

export async function handleGetReport(req: Request, res: Response, next: NextFunction) {
  try {
    const report = await getActiveReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'No active report found' });
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function handleRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { transcript_text, website_url } = runSchema.parse(req.body);
    const reportId = await enqueueResearch(req.params.id, transcript_text, website_url);
    res.status(202).json({
      message: 'Research job queued',
      report_id: reportId,
    });
  } catch (err) {
    next(err);
  }
}
