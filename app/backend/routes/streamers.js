import express from 'express';
import { Streamer, Stream } from '../../shared/database/index.js';
import logger from '../../shared/utils/logger.js';

const router = express.Router();

// Get all streamers
router.get('/', async (req, res) => {
  try {
    const { active_only = 'true' } = req.query;

    const where = {};
    if (active_only === 'true') {
      where.is_active = true;
    }

    const streamers = await Streamer().findAll({
      where,
      order: [
        ['is_live', 'DESC'],
        ['viewer_count', 'DESC'],
        ['display_name', 'ASC'],
      ],
    });

    res.json(streamers);
  } catch (error) {
    logger.error('❌ Error obteniendo streamers:', error);
    res.status(500).json({ error: 'Error obteniendo streamers' });
  }
});

// Get single streamer
router.get('/:id', async (req, res) => {
  try {
    const streamer = await Streamer().findByPk(req.params.id, {
      include: [
        {
          model: Stream(),
          as: 'streams',
          limit: 10,
          order: [['started_at', 'DESC']],
        },
      ],
    });

    if (!streamer) {
      return res.status(404).json({ error: 'Streamer no encontrado' });
    }

    res.json(streamer);
  } catch (error) {
    logger.error('❌ Error obteniendo streamer:', error);
    res.status(500).json({ error: 'Error obteniendo streamer' });
  }
});

// Create streamer
router.post('/', async (req, res) => {
  try {
    const {
      display_name,
      twitch_username,
      youtube_channel_id,
      kick_username,
      bio,
    } = req.body;

    if (!display_name) {
      return res.status(400).json({ error: 'display_name es requerido' });
    }

    const streamer = await Streamer().create({
      display_name,
      twitch_username,
      youtube_channel_id,
      kick_username,
      bio,
      is_active: true,
    });

    logger.info(`✅ Streamer creado: ${display_name}`);
    res.status(201).json(streamer);
  } catch (error) {
    logger.error('❌ Error creando streamer:', error);
    res.status(500).json({ error: 'Error creando streamer' });
  }
});

// Update streamer
router.patch('/:id', async (req, res) => {
  try {
    const streamer = await Streamer().findByPk(req.params.id);
    if (!streamer) {
      return res.status(404).json({ error: 'Streamer no encontrado' });
    }

    await streamer.update(req.body);
    logger.info(`✅ Streamer actualizado: ${streamer.display_name}`);

    res.json(streamer);
  } catch (error) {
    logger.error('❌ Error actualizando streamer:', error);
    res.status(500).json({ error: 'Error actualizando streamer' });
  }
});

// Delete streamer
router.delete('/:id', async (req, res) => {
  try {
    const streamer = await Streamer().findByPk(req.params.id);
    if (!streamer) {
      return res.status(404).json({ error: 'Streamer no encontrado' });
    }

    await streamer.update({ is_active: false });
    logger.info(`🗑️ Streamer desactivado: ${streamer.display_name}`);

    res.json({ message: 'Streamer desactivado exitosamente' });
  } catch (error) {
    logger.error('❌ Error eliminando streamer:', error);
    res.status(500).json({ error: 'Error eliminando streamer' });
  }
});

export default router;

export const getAllStreamers = async () => {
  return await Streamer().findAll({
    where: { is_active: true },
  });
};
