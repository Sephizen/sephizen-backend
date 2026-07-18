import { supabaseAdmin } from '../config/supabase.js';
import { toSafeTrimmedString } from '../utils/text.js';

export async function getProfile(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function updateProfile(userId, input) {
  const payload = {
    id: userId,
    display_name: toSafeTrimmedString(input.display_name, 120) || null,
    full_name: toSafeTrimmedString(input.full_name, 120) || null,
    avatar_url: toSafeTrimmedString(input.avatar_url, 500) || null,
    bio: toSafeTrimmedString(input.bio, 500) || null,
    website: toSafeTrimmedString(input.website, 500) || null,
    updated_at: new Date().toISOString()
  };

  if (input.preferences && typeof input.preferences === 'object') {
    payload.preferences = input.preferences;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
