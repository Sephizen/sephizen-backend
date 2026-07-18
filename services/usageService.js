import { supabaseAdmin } from '../config/supabase.js';
import { env } from '../config/env.js';
import { todayUtcKey } from '../utils/text.js';

function normalizeCreditRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    dailyLimit: row.daily_limit,
    dailyUsed: row.daily_used,
    remainingCredits: row.remaining_credits,
    lastResetAt: row.last_reset_at,
    updatedAt: row.updated_at
  };
}

export async function getUsageLogs(userId, { page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  const { data, error, count } = await supabaseAdmin
    .from('usage_logs')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('request_timestamp', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    items: data || [],
    page: safePage,
    limit: safeLimit,
    total: count || 0
  };
}

export async function logUsage({
  userId,
  selectedModel,
  creditsUsed,
  requestTimestamp = new Date().toISOString(),
  processingTimeMs,
  success
}) {
  const payload = {
    user_id: userId,
    selected_model: selectedModel,
    credits_used: Number(creditsUsed || 0),
    request_timestamp: requestTimestamp,
    processing_time_ms: Number(processingTimeMs || 0),
    success: Boolean(success)
  };

  const { error } = await supabaseAdmin.from('usage_logs').insert(payload);
  if (error) throw error;
  return payload;
}

export async function getOrCreateCreditsRow(userId) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (existing) {
    return normalizeCreditRow(existing);
  }

  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    daily_limit: env.DAILY_CREDIT_LIMIT,
    daily_used: 0,
    remaining_credits: env.DAILY_CREDIT_LIMIT,
    last_reset_at: now,
    updated_at: now
  };

  const { data, error } = await supabaseAdmin
    .from('user_credits')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return normalizeCreditRow(data);
}

export async function getCreditsBalance(userId) {
  const row = await getOrCreateCreditsRow(userId);
  return row;
}

function toPositiveCreditInteger(value) {
  const amount = Math.floor(Number(value || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error('Credits must be a positive integer');
    error.statusCode = 400;
    throw error;
  }
  return amount;
}

function normalizeRpcError(error, fallbackMessage) {
  if (!error) return null;
  if (String(error.code) === 'P0001' || /insufficient credits/i.test(String(error.message || ''))) {
    const normalized = new Error('Insufficient credits for this request');
    normalized.statusCode = 403;
    return normalized;
  }
  const normalized = new Error(fallbackMessage || error.message || 'Credit adjustment failed');
  normalized.statusCode = error.statusCode || 500;
  normalized.details = error;
  return normalized;
}

export async function reserveCredits(userId, credits) {
  const amount = toPositiveCreditInteger(credits);
  await getOrCreateCreditsRow(userId);

  const { data, error } = await supabaseAdmin.rpc('adjust_daily_credits', {
    p_user_id: userId,
    p_credits_delta: amount,
    p_daily_limit: env.DAILY_CREDIT_LIMIT
  });

  if (error) throw normalizeRpcError(error, 'Unable to reserve credits');
  return data?.[0] || null;
}

export async function refundCredits(userId, credits) {
  const amount = toPositiveCreditInteger(credits);
  await getOrCreateCreditsRow(userId);

  const { data, error } = await supabaseAdmin.rpc('adjust_daily_credits', {
    p_user_id: userId,
    p_credits_delta: -amount,
    p_daily_limit: env.DAILY_CREDIT_LIMIT
  });

  if (error) throw normalizeRpcError(error, 'Unable to refund credits');
  return data?.[0] || null;
}

export async function ensureCreditsCapacity(userId, credits) {
  const balance = await getCreditsBalance(userId);
  if (balance.remainingCredits < credits) {
    const error = new Error('Insufficient credits for this request');
    error.statusCode = 403;
    throw error;
  }
  return balance;
}

export async function touchDailyReset(userId) {
  const row = await getOrCreateCreditsRow(userId);
  const today = todayUtcKey();
  const lastReset = row.lastResetAt ? todayUtcKey(row.lastResetAt) : null;
  if (lastReset !== today) {
    const { data, error } = await supabaseAdmin
      .from('user_credits')
      .update({
        daily_used: 0,
        remaining_credits: row.dailyLimit,
        last_reset_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return normalizeCreditRow(data);
  }
  return row;
}
