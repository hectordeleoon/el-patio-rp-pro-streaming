import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import logger from '../shared/utils/logger.js';
import { redisClient } from '../shared/cache/redis.js';
import errorHandler from './middleware/errorHandler.js';
import rateLimiter from './middleware/rateLimiter.js';
import authMiddleware from './middleware/auth.js';

// Import routes
import healthRoutes from './routes/health.js';
import webhookRoutes from './routes/webhooks.js';
import clipsRoutes from './routes/clips.js';
import streamersRoutes from './routes/streamers.js';
import statsRoutes from './routes/stats.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';

class BackendServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketServer(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
    });
    this.port = process.env.PORT || 3000;
  }

  setupMiddleware() {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    this.app.use(cookieParser());

    // Session management
    this.app.use(
      session({
        store: new RedisStore({ client: redisClient }),
        secret: process.env.PANEL_SESSION_SECRET || 'default-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
      })
    );

    // Rate limiting
    this.app.use(rateLimiter);

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  setupRoutes() {
    // Public routes
    this.app.use('/health', healthRoutes);
    this.app.use('/webhooks', webhookRoutes);
    this.app.use('/auth', authRoutes);

    // API routes (rate limited)
    this.app.use('/api/clips', clipsRoutes);
    this.app.use('/api/streamers', streamersRoutes);
    this.app.use('/api/stats', statsRoutes);

    // Admin routes (protected)
    this.app.use('/api/admin', authMiddleware, adminRoutes);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: 'La ruta solicitada no existe',
        path: req.path,
      });
    });

    // Error handler (must be last)
    this.app.use(errorHandler);
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      logger.info(`🔌 Socket conectado: ${socket.id}`);

      socket.on('subscribe:clips', () => {
        socket.join('clips');
        logger.info(`Socket ${socket.id} suscrito a clips`);
      });

      socket.on('subscribe:streams', () => {
        socket.join('streams');
        logger.info(`Socket ${socket.id} suscrito a streams`);
      });

      socket.on('disconnect', () => {
        logger.info(`🔌 Socket desconectado: ${socket.id}`);
      });
    });

    // Make io available globally for services
    global.io = this.io;
  }

  async start() {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();

    return new Promise((resolve) => {
      this.server.listen(this.port, () => {
        logger.info(`🌐 Servidor backend escuchando en puerto ${this.port}`);
        logger.info(`📡 WebSocket server iniciado`);
        logger.info(`🔗 Health check: http://localhost:${this.port}/health`);
        resolve();
      });
    });
  }

  async stop() {
    return new Promise((resolve) => {
      this.io.close(() => {
        logger.info('📡 WebSocket server cerrado');
        
        this.server.close(() => {
          logger.info('🌐 Servidor backend cerrado');
          resolve();
        });
      });
    });
  }

  getApp() {
    return this.app;
  }

  getIO() {
    return this.io;
  }
}

export default BackendServer;
