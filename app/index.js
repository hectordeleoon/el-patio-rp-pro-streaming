import 'dotenv/config';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './shared/utils/logger.js';
import { initializeDatabase } from './shared/database/index.js';
import { initializeRedis } from './shared/cache/redis.js';
import DiscordBot from './bot/index.js';
import BackendServer from './backend/index.js';
import { startClipProcessor } from './backend/services/clipProcessor.js';
import { startStreamMonitor } from './backend/services/streamMonitor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Application {
  constructor() {
    this.bot = null;
    this.server = null;
    this.isShuttingDown = false;
  }

  async initialize() {
    try {
      logger.info('🚀 Iniciando El Patio RP Pro...');

      // Initialize database
      logger.info('📊 Conectando a la base de datos...');
      await initializeDatabase();
      logger.info('✅ Base de datos conectada');

      // Initialize Redis
      logger.info('🔴 Conectando a Redis...');
      await initializeRedis();
      logger.info('✅ Redis conectado');

      // Start Discord Bot
      logger.info('🤖 Iniciando Discord Bot...');
      this.bot = new DiscordBot();
      await this.bot.start();
      logger.info('✅ Discord Bot activo');

      // Start Backend Server
      logger.info('🌐 Iniciando servidor backend...');
      this.server = new BackendServer();
      await this.server.start();
      logger.info(`✅ Servidor backend activo en puerto ${process.env.PORT || 3000}`);

      // Start background services
      logger.info('⚙️ Iniciando servicios en segundo plano...');
      await this.startBackgroundServices();
      logger.info('✅ Servicios en segundo plano activos');

      logger.info('✨ El Patio RP Pro está completamente operativo!');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      // Setup graceful shutdown
      this.setupGracefulShutdown();
    } catch (error) {
      logger.error('❌ Error fatal durante la inicialización:', error);
      process.exit(1);
    }
  }

  async startBackgroundServices() {
    // Start clip processor
    await startClipProcessor();
    
    // Start stream monitor
    await startStreamMonitor();

    // Additional background services can be added here
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) {
        logger.warn('Shutdown ya en progreso...');
        return;
      }

      this.isShuttingDown = true;
      logger.info(`\n${signal} recibido. Iniciando apagado graceful...`);

      try {
        // Stop accepting new requests
        if (this.server) {
          logger.info('🌐 Cerrando servidor backend...');
          await this.server.stop();
          logger.info('✅ Servidor backend cerrado');
        }

        // Disconnect bot
        if (this.bot) {
          logger.info('🤖 Desconectando Discord Bot...');
          await this.bot.stop();
          logger.info('✅ Discord Bot desconectado');
        }

        // Close database connections
        logger.info('📊 Cerrando conexiones de base de datos...');
        const { closeDatabase } = await import('./shared/database/index.js');
        await closeDatabase();
        logger.info('✅ Conexiones de base de datos cerradas');

        // Close Redis
        logger.info('🔴 Cerrando conexión Redis...');
        const { closeRedis } = await import('./shared/cache/redis.js');
        await closeRedis();
        logger.info('✅ Conexión Redis cerrada');

        logger.info('✨ Apagado completado exitosamente');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error durante el apagado:', error);
        process.exit(1);
      }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('UNHANDLED_REJECTION');
    });
  }
}

// Start the application
const app = new Application();
app.initialize().catch((error) => {
  logger.error('❌ Error crítico:', error);
  process.exit(1);
});

export default app;
