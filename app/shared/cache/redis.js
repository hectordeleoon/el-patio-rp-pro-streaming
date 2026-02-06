import Redis from 'ioredis';
import logger from '../utils/logger.js';

let redisClient;

export async function initializeRedis() {
  try {
    redisClient = new Redis(process.env.REDIS_URL || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info('✅ Conectado a Redis');
    });

    redisClient.on('error', (err) => {
      logger.error('❌ Error de Redis:', err);
    });

    redisClient.on('reconnecting', () => {
      logger.warn('⚠️ Reconectando a Redis...');
    });

    // Test connection
    await redisClient.ping();
    logger.info('✅ Redis responde correctamente');

    return redisClient;
  } catch (error) {
    logger.error('❌ Error inicializando Redis:', error);
    throw error;
  }
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    logger.info('✅ Conexión Redis cerrada');
  }
}

export { redisClient };

export default {
  initializeRedis,
  closeRedis,
  redisClient,
};
