import { asyncHandler } from '../utils/asyncHandler.js';
import { getProfile, updateProfile } from '../services/profileService.js';

export const readProfile = asyncHandler(async (req, res) => {
  const profile = await getProfile(req.user.id);
  res.json({
    success: true,
    data: profile || {}
  });
});

export const writeProfile = asyncHandler(async (req, res) => {
  const profile = await updateProfile(req.user.id, req.body || {});
  res.json({
    success: true,
    data: profile
  });
});
