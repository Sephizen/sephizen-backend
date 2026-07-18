import { supabaseAdmin } from '../config/supabase.js';

export async function createChatSession(userId, { title = 'New chat', modelKey = null, metadata = {} } = {}) {
  const payload = {
    user_id: userId,
    title,
    model_key: modelKey,
    metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function listChatSessions(userId, { page = 1, limit = 20 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  const { data, error, count } = await supabaseAdmin
    .from('chat_sessions')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  return {
    items: data || [],
    page: safePage,
    limit: safeLimit,
    total: count || 0
  };
}

export async function getChatSession(userId, sessionId) {
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function deleteChatSession(userId, sessionId) {
  const { error: messagesError } = await supabaseAdmin
    .from('chat_messages')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);

  if (messagesError) throw messagesError;

  const { error } = await supabaseAdmin
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (error) throw error;
  return true;
}

export async function listChatMessages(userId, sessionId, { page = 1, limit = 100 } = {}) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 100));
  const from = (safePage - 1) * safeLimit;
  const to = from + safeLimit - 1;

  const { data, error, count } = await supabaseAdmin
    .from('chat_messages')
    .select('*', { count: 'exact' })
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .range(from, to);

  if (error) throw error;

  return {
    items: data || [],
    page: safePage,
    limit: safeLimit,
    total: count || 0
  };
}

export async function addChatMessage({
  userId,
  sessionId,
  role,
  content,
  modelKey = null,
  creditsUsed = 0,
  metadata = {}
}) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    session_id: sessionId,
    role,
    content,
    model_key: modelKey,
    credits_used: Number(creditsUsed || 0),
    metadata,
    created_at: now
  };

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  await supabaseAdmin
    .from('chat_sessions')
    .update({
      updated_at: now,
      last_message_at: now,
      last_message_preview: String(content).slice(0, 140)
    })
    .eq('id', sessionId)
    .eq('user_id', userId);

  return data;
}

export async function recordAssistantReply({
  userId,
  sessionId,
  content,
  modelKey,
  creditsUsed,
  metadata = {}
}) {
  const { data, error } = await supabaseAdmin.rpc('record_chat_reply', {
    p_user_id: userId,
    p_session_id: sessionId,
    p_content: content,
    p_model_key: modelKey,
    p_credits_used: creditsUsed,
    p_metadata: metadata
  });

  if (error) throw error;
  return data?.[0] || null;
}

export async function renameChatSession(userId, sessionId, title) {
  const { data, error } = await supabaseAdmin
    .from('chat_sessions')
    .update({
      title,
      updated_at: new Date().toISOString()
    })
    .eq('id', sessionId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
