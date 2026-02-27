import { Request, Response, NextFunction } from 'express';
import { syncCampaigns, getCampaigns, getReplies } from './smartlead.service';

export async function handleSync(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await syncCampaigns(req.params.id);
    res.json({ message: 'Sync complete', ...result });
  } catch (err) {
    next(err);
  }
}

export async function handleGetCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const campaigns = await getCampaigns(req.params.id);
    res.json(campaigns);
  } catch (err) {
    next(err);
  }
}

export async function handleGetReplies(req: Request, res: Response, next: NextFunction) {
  try {
    const replies = await getReplies(req.params.id);
    res.json(replies);
  } catch (err) {
    next(err);
  }
}
