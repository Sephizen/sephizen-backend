import { asyncHandler } from '../utils/asyncHandler.js';
import { getUsageLogs } from '../services/usageService.js';

export const listUsageLogs = asyncHandler(async (req, res) => {
  const result = await getUsageLogs(req.user.id, req.query);
  res.json({
    success: true,
    data: result
  });
});
