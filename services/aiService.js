import OpenAI from 'openai';
import { env } from '../config/env.js';
import { getModelByKeyOrLabel } from '../config/models.js';
import { logger } from '../utils/logger.js';

let client;

function getClient() {
  if (!client) {
    client = new OpenAI({
      baseURL: env.PUTER_BASE_URL,
      apiKey: env.PUTER_AUTH_TOKEN,
      defaultHeaders: {
        'X-Client-Info': 'public-ai-coding-assistant-backend'
      }
    });
  }
  return client;
}

export function resolveModel(modelKeyOrLabel) {
  const config = getModelByKeyOrLabel(modelKeyOrLabel);
  if (!config) {
    const error = new Error(`Unsupported model: ${modelKeyOrLabel}`);
    error.statusCode = 400;
    throw error;
  }
  return config;
}

export async function generateChatCompletion({
  model,
  messages,
  temperature = 0.2,
  maxTokens = null
}) {
  const modelConfig = resolveModel(model);
  const openai = getClient();

  const response = await openai.chat.completions.create({
    model: modelConfig.modelId,
    messages,
    temperature,
    max_tokens: maxTokens || modelConfig.maxOutputTokens
  });

  const choice = response.choices?.[0]?.message?.content || '';
  const usage = response.usage || {};

  logger.debug({
    message: 'AI completion received',
    model: modelConfig.key,
    usage
  });

  return {
    text: choice,
    usage,
    model: modelConfig
  };
}
