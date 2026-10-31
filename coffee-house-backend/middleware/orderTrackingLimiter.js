const { RateLimiterMemory } = require('rate-limiter-flexible');

const limiter = new RateLimiterMemory({
  points: 10,
  duration: 15 * 60,
  blockDuration: 15 * 60
});

module.exports = async (req, res, next) => {
  try {
    await limiter.consume(req.ip || req.socket.remoteAddress || 'unknown');
    return next();
  } catch (rateLimitError) {
    const retryAfter = Math.max(1, Math.ceil((rateLimitError.msBeforeNext || 900000) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      success: false,
      error: 'Too many tracking attempts. Please try again later.'
    });
  }
};
