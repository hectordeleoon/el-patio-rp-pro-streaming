import { Sequelize } from 'sequelize';
import logger from '../utils/logger.js';
import { initModels } from './models/index.js';

let sequelize;
let models;

export async function initializeDatabase() {
  try {
    // Create Sequelize instance
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: (msg) => logger.debug(msg),
      pool: {
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        acquire: 30000,
        idle: 10000,
      },
      dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? {
          require: true,
          rejectUnauthorized: false,
        } : false,
      },
    });

    // Test connection
    await sequelize.authenticate();
    logger.info('✅ Conexión a PostgreSQL establecida');

    // Initialize models
    models = initModels(sequelize);

    // Sync database (create tables if they don't exist)
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      logger.info('✅ Tablas sincronizadas');
    } else {
      // In production, use migrations instead
      logger.info('⚠️ Producción: Usa migraciones para cambios en la BD');
    }

    return sequelize;
  } catch (error) {
    logger.error('❌ Error conectando a la base de datos:', error);
    throw error;
  }
}

export async function closeDatabase() {
  if (sequelize) {
    await sequelize.close();
    logger.info('✅ Conexión a base de datos cerrada');
  }
}

export function getSequelize() {
  return sequelize;
}

export function getModels() {
  return models;
}

// Export models for easy access
export const Streamer = () => models?.Streamer;
export const Stream = () => models?.Stream;
export const Clip = () => models?.Clip;
export const Publication = () => models?.Publication;
export const User = () => models?.User;

export default {
  initializeDatabase,
  closeDatabase,
  getSequelize,
  getModels,
};
