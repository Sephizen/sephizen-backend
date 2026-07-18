import { asyncHandler } from '../utils/asyncHandler.js';
import { getSettings, updateSettings } from '../services/settingsService.js';

export const readSettings = asyncHandler(async (req, res) => {
  const settings = await getSettings(req.user.id);
  res.json({
    success: true,
    data: settings
  });
});

export const writeSettings = asyncHandler(async (req, res) => {
  const settings = await updateSettings(req.user.id, req.body || {});
  res.json({
    success: true,
    data: settings
  });
});
