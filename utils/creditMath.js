import { getModelByKeyOrLabel } from '../config/models.js';

function ceilDiv(value, divisor) {
  return Math.ceil(value / divisor);
}

function normalizeWorkload(workload = 'normal') {
  const value = String(workload).toLowerCase();
  if (['light', 'small', 'simple'].includes(value)) return 'light';
  if (['heavy', 'large', 'complex', 'coding'].includes(value)) return 'heavy';
  return 'normal';
}

export function calculateCreditCost({
  model,
  inputCharacters = 0,
  expectedOutputTokens = 1024,
  workload = 'normal',
  attachments = 0
}) {
  const modelConfig = getModelByKeyOrLabel(model);
  if (!modelConfig) {
    throw new Error(`Unsupported model: ${model}`);
  }

  const workloadKey = normalizeWorkload(workload);
  const workloadMultiplier = {
    light: 0.85,
    normal: 1,
    heavy: 1.7
  }[workloadKey];

  const inputUnits = ceilDiv(Math.max(0, Number(inputCharacters) || 0), 900);
  const outputUnits = ceilDiv(Math.max(0, Number(expectedOutputTokens) || 0), 450);
  const attachmentPenalty = Math.max(0, Number(attachments) || 0) * 1.5;

  const rawCredits =
    2 +
    (inputUnits * modelConfig.inputMultiplier) +
    (outputUnits * modelConfig.outputMultiplier) +
    attachmentPenalty;

  const credits = Math.ceil(rawCredits * modelConfig.creditMultiplier * workloadMultiplier);
  return Math.max(1, credits);
}

export function estimateFromMessageBundle({ model, messages = [], workload = 'normal', attachments = 0, expectedOutputTokens = 1024 }) {
  const inputCharacters = messages.reduce((sum, message) => {
    if (!message || typeof message.content !== 'string') return sum;
    return sum + message.content.length;
  }, 0);

  return calculateCreditCost({
    model,
    inputCharacters,
    expectedOutputTokens,
    workload,
    attachments
  });
}
