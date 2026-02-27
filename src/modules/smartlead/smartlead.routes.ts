import { Router } from 'express';
import { handleSync, handleGetCampaigns, handleGetReplies } from './smartlead.controller';

const router = Router();

router.post('/:id/smartlead/sync', handleSync);
router.get('/:id/smartlead/campaigns', handleGetCampaigns);
router.get('/:id/smartlead/replies', handleGetReplies);

export default router;
