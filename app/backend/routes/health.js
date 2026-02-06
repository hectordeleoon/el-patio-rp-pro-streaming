import express from 'express';
import { getSequelize } from '../../shared/database/index.js';
import { redisClient } from '../../shared/cache/redis.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      services: {},
    };

    // Check database
    try {
      const sequelize = getSequelize();
      await sequelize.authenticate();
      health.services.database = 'connected';
    } catch (error) {
      health.services.database = 'disconnected';
      health.status = 'degraded';
    }

    // Check Redis
    try {
      await redisClient.ping();
      health.services.redis = 'connected';
    } catch (error) {
      health.services.redis = 'disconnected';
      health.status = 'degraded';
    }

    // Check Discord bot
    health.services.discord = global.discordClient?.isReady() ? 'connected' : 'disconnected';

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
});

export default router;
