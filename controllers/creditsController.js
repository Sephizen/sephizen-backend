import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getCreditsBalance, ensureCreditsCapacity } from '../services/usageService.js';

export const getCredits = asyncHandler(async (req, res) => {
  const balance = await getCreditsBalance(req.user.id);
  res.json({
    success: true,
    data: balance
  });
});

export const checkCredits = asyncHandler(async (req, res) => {
  const body = z.object({ credits: z.coerce.number().int().positive().max(1000000) }).parse(req.body || {});
  await ensureCreditsCapacity(req.user.id, body.credits);
  res.json({
    success: true,
    data: {
      sufficient: true
    }
  });
});
