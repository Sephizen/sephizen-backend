export function toSafeTrimmedString(value, maxLength = 2000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function formatDateUtc(date = new Date()) {
  return new Date(date).toISOString();
}

export function todayUtcKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

export function clampNumber(value, min, max) {
  const num = Number(value);
  if (Number.isNaN(num)) return min;
  return Math.min(max, Math.max(min, num));
}
