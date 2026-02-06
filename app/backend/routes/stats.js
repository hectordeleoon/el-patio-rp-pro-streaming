import express from 'express';
import { getServerStats } from '../services/statsService.js';
import logger from '../../shared/utils/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const stats = await getServerStats();
    res.json(stats);
  } catch (error) {
    logger.error('❌ Error obteniendo stats:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

export default router;
