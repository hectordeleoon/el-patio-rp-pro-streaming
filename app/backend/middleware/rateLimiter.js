import { redisClient } from '../../shared/cache/redis.js';
import logger from '../../shared/utils/logger.js';

const rateLimiter = async (req, res, next) => {
  try {
    // Skip rate limiting for health checks
    if (req.path === '/health') {
      return next();
    }

    const ip = req.ip || req.connection.remoteAddress;
    const key = `rate_limit:${ip}`;
    const limit = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
    const window = parseInt(process.env.RATE_LIMIT_WINDOW) || 15; // minutes

    const current = await redisClient.incr(key);
    
    if (current === 1) {
      await redisClient.expire(key, window * 60);
    }

    if (current > limit) {
      logger.warn(`⚠️ Rate limit excedido para IP: ${ip}`);
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Has excedido el límite de ${limit} requests por ${window} minutos`,
      });
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
    
    next();
  } catch (error) {
    logger.error('❌ Error en rate limiter:', error);
    // If rate limiting fails, allow the request
    next();
  }
};

export default rateLimiter;
