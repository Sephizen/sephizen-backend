import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatMessages,
  listChatSessions,
  addChatMessage,
  renameChatSession,
  recordAssistantReply
} from '../services/chatService.js';
import { estimateFromMessageBundle, calculateCreditCost } from '../utils/creditMath.js';
import { reserveCredits, refundCredits } from '../services/usageService.js';
import { generateChatCompletion, resolveModel } from '../services/aiService.js';
import { supabaseAdmin } from '../config/supabase.js';

const sessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  model: z.string().trim().optional(),
  metadata: z.record(z.any()).optional()
});

const messageSchema = z.object({
  content: z.string().trim().min(1).max(20000),
  model: z.string().trim().optional(),
  workload: z.enum(['light', 'normal', 'heavy']).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  maxOutputTokens: z.coerce.number().int().min(64).max(16384).optional(),
  attachments: z.array(z.object({
    name: z.string().max(255),
    size: z.number().int().nonnegative().optional()
  })).optional()
});

function sanitizeHistory(messages) {
  return (messages || []).map((message) => ({
    role: message.role,
    content: message.content
  }));
}

async function buildHistory(sessionId, userId) {
  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw error;
  return sanitizeHistory((data || []).reverse());
}

export const createSession = asyncHandler(async (req, res) => {
  const body = sessionSchema.parse(req.body || {});
  const session = await createChatSession(req.user.id, {
    title: body.title || 'New chat',
    modelKey: body.model || null,
    metadata: body.metadata || {}
  });

  res.status(201).json({
    success: true,
    data: session
  });
});

export const listSessions = asyncHandler(async (req, res) => {
  const result = await listChatSessions(req.user.id, req.query);
  res.json({
    success: true,
    data: result
  });
});

export const readSession = asyncHandler(async (req, res) => {
  const session = await getChatSession(req.user.id, req.params.sessionId);
  if (!session) throw new ApiError(404, 'Chat session not found');
  res.json({
    success: true,
    data: session
  });
});

export const updateSessionTitle = asyncHandler(async (req, res) => {
  const body = z.object({ title: z.string().trim().min(1).max(200) }).parse(req.body || {});
  const session = await renameChatSession(req.user.id, req.params.sessionId, body.title);
  res.json({
    success: true,
    data: session
  });
});

export const removeSession = asyncHandler(async (req, res) => {
  await deleteChatSession(req.user.id, req.params.sessionId);
  res.json({
    success: true,
    data: {
      deleted: true
    }
  });
});

export const readMessages = asyncHandler(async (req, res) => {
  const result = await listChatMessages(req.user.id, req.params.sessionId, req.query);
  res.json({
    success: true,
    data: result
  });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const body = messageSchema.parse(req.body || {});
  const session = await getChatSession(req.user.id, req.params.sessionId);
  if (!session) throw new ApiError(404, 'Chat session not found');

  const modelKey = body.model || session.model_key || 'deepseek_coder';
  const modelConfig = resolveModel(modelKey);

  const history = await buildHistory(req.params.sessionId, req.user.id);
  const messages = [
    {
      role: 'system',
      content:
        'You are a public AI coding assistant. Provide accurate, practical, production-ready code and explanations. When relevant, prefer concise step-by-step guidance and include safe defaults.'
    },
    ...history,
    { role: 'user', content: body.content }
  ];

  const estimatedCredits = estimateFromMessageBundle({
    model: modelConfig.key,
    messages,
    workload: body.workload || 'normal',
    attachments: body.attachments?.length || 0,
    expectedOutputTokens: body.maxOutputTokens || modelConfig.maxOutputTokens
  });

  const startedAt = Date.now();
  let reservedCredits = false;
  let chargedCredits = 0;
  let userMessage = null;

  try {
    await reserveCredits(req.user.id, estimatedCredits);
    reservedCredits = true;
    chargedCredits = estimatedCredits;

    userMessage = await addChatMessage({
      userId: req.user.id,
      sessionId: req.params.sessionId,
      role: 'user',
      content: body.content,
      modelKey: modelConfig.key,
      creditsUsed: 0,
      metadata: { attachments: body.attachments || [] }
    });

    const completion = await generateChatCompletion({
      model: modelConfig.key,
      messages,
      temperature: body.temperature ?? 0.2,
      maxTokens: body.maxOutputTokens || modelConfig.maxOutputTokens
    });

    const actualOutputTokens = Number(completion.usage?.completion_tokens || 0);
    const actualInputTokens = Number(completion.usage?.prompt_tokens || 0);
    const processingTimeMs = Date.now() - startedAt;

    const actualCredits = calculateCreditCost({
      model: modelConfig.key,
      inputCharacters: body.content.length + history.reduce((sum, item) => sum + String(item.content || '').length, 0),
      expectedOutputTokens: Math.max(actualOutputTokens, 1),
      workload: body.workload || 'normal',
      attachments: body.attachments?.length || 0
    });

    if (actualCredits > estimatedCredits) {
      const delta = actualCredits - estimatedCredits;
      await reserveCredits(req.user.id, delta);
      chargedCredits = actualCredits;
    } else if (actualCredits < estimatedCredits) {
      const delta = estimatedCredits - actualCredits;
      await refundCredits(req.user.id, delta);
      chargedCredits = actualCredits;
    }

    const assistantReply = await recordAssistantReply({
      userId: req.user.id,
      sessionId: req.params.sessionId,
      content: completion.text,
      modelKey: modelConfig.key,
      creditsUsed: actualCredits,
      metadata: {
        usage: completion.usage || {},
        input_tokens: actualInputTokens,
        output_tokens: actualOutputTokens,
        processing_time_ms: processingTimeMs
      }
    });

    req.selectedModelKey = modelConfig.key;
    req.creditsUsed = actualCredits;

    res.json({
      success: true,
      data: {
        sessionId: req.params.sessionId,
        userMessage,
        assistantMessage: assistantReply,
        model: modelConfig,
        usage: completion.usage || {},
        credits: {
          estimated: estimatedCredits,
          actual: actualCredits
        }
      }
    });
  } catch (error) {
    if (reservedCredits && chargedCredits > 0) {
      await refundCredits(req.user.id, chargedCredits).catch(() => {});
    }

    req.selectedModelKey = modelConfig.key;
    req.creditsUsed = 0;

    throw error;
  }
});
