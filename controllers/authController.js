import { asyncHandler } from '../utils/asyncHandler.js';

export const me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
      auth: {
        sessionId: req.auth?.user?.session_id || null
      }
    }
  });
});
