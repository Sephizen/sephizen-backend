import { asyncHandler } from '../utils/asyncHandler.js';
import { MODEL_REGISTRY } from '../config/models.js';

export const listModels = asyncHandler(async (_req, res) => {
  const data = Object.values(MODEL_REGISTRY).map((model) => ({
    key: model.key,
    label: model.label,
    provider: model.provider,
    modelId: model.modelId,
    family: model.family,
    creditMultiplier: model.creditMultiplier,
    inputMultiplier: model.inputMultiplier,
    outputMultiplier: model.outputMultiplier,
    maxOutputTokens: model.maxOutputTokens,
    contextWindow: model.contextWindow
  }));

  res.json({
    success: true,
    data
  });
});
