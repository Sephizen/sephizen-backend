import { env } from '../config/env.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getMetricsSnapshot } from '../services/metricsService.js';

export const getMetrics = asyncHandler(async (_req, res) => {
  if (!env.METRICS_ENABLED) {
    res.status(404).json({
      success: false,
      message: 'Metrics are disabled'
    });
    return;
  }

  res.json({
    success: true,
    data: getMetricsSnapshot()
  });
});
