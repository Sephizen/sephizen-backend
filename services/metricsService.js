import { env } from '../config/env.js';
const startedAt = Date.now();

const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  statusCounts: {},
  methods: {},
  models: {},
  creditsUsed: 0,
  totalLatencyMs: 0,
  uploadRequests: 0,
  authFailures: 0,
  rateLimited: 0,
  lastRequestAt: null,
  lastRequestId: null
};

export function recordRequestMetric({
  requestId = null,
  modelKey = null,
  creditsUsed = 0,
  processingTimeMs = 0,
  success = false,
  statusCode = 0,
  method = 'GET',
  path = ''
} = {}) {
  if (!env.METRICS_ENABLED) return;
  metrics.totalRequests += 1;
  metrics.totalLatencyMs += Number(processingTimeMs || 0);
  metrics.lastRequestAt = new Date().toISOString();
  metrics.lastRequestId = requestId;
  metrics.methods[method] = (metrics.methods[method] || 0) + 1;
  metrics.statusCounts[String(statusCode)] = (metrics.statusCounts[String(statusCode)] || 0) + 1;
  metrics.creditsUsed += Number(creditsUsed || 0);

  if (success) {
    metrics.successfulRequests += 1;
  } else {
    metrics.failedRequests += 1;
  }

  if (statusCode === 429) metrics.rateLimited += 1;
  if (statusCode === 401 || statusCode === 403) metrics.authFailures += 1;
  if (path.startsWith('/api/upload')) metrics.uploadRequests += 1;
  if (modelKey) metrics.models[modelKey] = (metrics.models[modelKey] || 0) + 1;
}

export function getMetricsSnapshot() {
  if (!env.METRICS_ENABLED) {
    return { enabled: false };
  }
  const avgLatencyMs = metrics.totalRequests === 0 ? 0 : Math.round(metrics.totalLatencyMs / metrics.totalRequests);
  return {
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    totalRequests: metrics.totalRequests,
    successfulRequests: metrics.successfulRequests,
    failedRequests: metrics.failedRequests,
    rateLimited: metrics.rateLimited,
    authFailures: metrics.authFailures,
    uploadRequests: metrics.uploadRequests,
    averageLatencyMs: avgLatencyMs,
    creditsUsed: metrics.creditsUsed,
    statusCounts: metrics.statusCounts,
    methods: metrics.methods,
    models: metrics.models,
    lastRequestAt: metrics.lastRequestAt,
    lastRequestId: metrics.lastRequestId
  };
}
