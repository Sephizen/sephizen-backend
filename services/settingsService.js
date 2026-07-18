import { getProfile, updateProfile } from './profileService.js';

export async function getSettings(userId) {
  const profile = await getProfile(userId);
  return profile?.preferences || {};
}

export async function updateSettings(userId, settings) {
  const profile = await getProfile(userId);
  const preferences = {
    ...(profile?.preferences || {}),
    ...(settings || {})
  };
  return updateProfile(userId, { preferences });
}
