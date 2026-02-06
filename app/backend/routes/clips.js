import express from 'express';
import { Clip, Streamer } from '../../shared/database/index.js';
import logger from '../../shared/utils/logger.js';

const router = express.Router();

// Get recent clips
router.get('/', async (req, res) => {
  try {
    const {
      limit = 10,
      offset = 0,
      streamer,
      status,
      minScore,
    } = req.query;

    const where = {};

    if (streamer) {
      const streamerRecord = await Streamer().findOne({
        where: { display_name: streamer },
      });
      if (streamerRecord) {
        where.streamer_id = streamerRecord.id;
      }
    }

    if (status) {
      where.status = status;
    }

    if (minScore) {
      where.viral_score = { [Op.gte]: parseInt(minScore) };
    }

    const clips = await Clip().findAll({
      where,
      include: [
        {
          model: Streamer(),
          as: 'streamer',
          attributes: ['id', 'display_name', 'profile_image_url'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const total = await Clip().count({ where });

    res.json({
      clips,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit),
      },
    });
  } catch (error) {
    logger.error('❌ Error obteniendo clips:', error);
    res.status(500).json({ error: 'Error obteniendo clips' });
  }
});

// Get single clip
router.get('/:id', async (req, res) => {
  try {
    const clip = await Clip().findByPk(req.params.id, {
      include: [
        {
          model: Streamer(),
          as: 'streamer',
        },
      ],
    });

    if (!clip) {
      return res.status(404).json({ error: 'Clip no encontrado' });
    }

    res.json(clip);
  } catch (error) {
    logger.error('❌ Error obteniendo clip:', error);
    res.status(500).json({ error: 'Error obteniendo clip' });
  }
});

// Update clip status (approve/reject)
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['approved', 'rejected', 'pending_approval'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const clip = await Clip().findByPk(req.params.id);
    if (!clip) {
      return res.status(404).json({ error: 'Clip no encontrado' });
    }

    await clip.update({ status });

    logger.info(`✅ Clip ${clip.id} actualizado a ${status}`);

    // If approved, queue for publication
    if (status === 'approved') {
      const { queuePublication } = await import('../services/publicationService.js');
      await queuePublication(clip);
    }

    res.json(clip);
  } catch (error) {
    logger.error('❌ Error actualizando clip:', error);
    res.status(500).json({ error: 'Error actualizando clip' });
  }
});

// Delete clip
router.delete('/:id', async (req, res) => {
  try {
    const clip = await Clip().findByPk(req.params.id);
    if (!clip) {
      return res.status(404).json({ error: 'Clip no encontrado' });
    }

    await clip.destroy();
    logger.info(`🗑️ Clip ${req.params.id} eliminado`);

    res.json({ message: 'Clip eliminado exitosamente' });
  } catch (error) {
    logger.error('❌ Error eliminando clip:', error);
    res.status(500).json({ error: 'Error eliminando clip' });
  }
});

export default router;

export const getRecentClips = async ({ limit = 10, streamer = null }) => {
  const where = {};
  
  if (streamer) {
    const streamerRecord = await Streamer().findOne({
      where: { display_name: streamer },
    });
    if (streamerRecord) {
      where.streamer_id = streamerRecord.id;
    }
  }

  return await Clip().findAll({
    where,
    include: ['streamer'],
    order: [['created_at', 'DESC']],
    limit,
  });
};
