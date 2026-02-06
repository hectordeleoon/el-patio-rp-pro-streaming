import { Sequelize, Op } from 'sequelize';
import { Streamer, Stream, Clip, Publication } from '../../shared/database/index.js';
import logger from '../../shared/utils/logger.js';

export async function getServerStats() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Streamer stats
    const totalStreamers = await Streamer().count({ where: { is_active: true } });
    const liveStreamers = await Streamer().count({ where: { is_live: true } });

    // Clip stats
    const totalClips = await Clip().count();
    const clipsToday = await Clip().count({
      where: {
        created_at: { [Op.gte]: today },
      },
    });
    const clipsThisWeek = await Clip().count({
      where: {
        created_at: { [Op.gte]: thisWeek },
      },
    });
    const publishedClips = await Clip().count({
      where: { status: 'published' },
    });

    // Performance stats
    const avgViralScore = await Clip().findOne({
      attributes: [[Sequelize.fn('AVG', Sequelize.col('viral_score')), 'avg']],
      raw: true,
    });

    const publishRate = totalClips > 0 ? (publishedClips / totalClips) * 100 : 0;
    const approvedClips = await Clip().count({
      where: { status: { [Op.in]: ['approved', 'published'] } },
    });
    const approvalRate = totalClips > 0 ? (approvedClips / totalClips) * 100 : 0;

    // Top streamer
    const topStreamer = await Streamer().findOne({
      attributes: [
        'id',
        'display_name',
        [Sequelize.fn('COUNT', Sequelize.col('clips.id')), 'clipCount'],
      ],
      include: [
        {
          model: Clip(),
          as: 'clips',
          attributes: [],
        },
      ],
      group: ['Streamer.id'],
      order: [[Sequelize.literal('clipCount'), 'DESC']],
      raw: true,
    });

    // Best clip
    const bestClip = await Clip().findOne({
      order: [['viral_score', 'DESC']],
      limit: 1,
    });

    return {
      streamers: {
        total: totalStreamers,
        live: liveStreamers,
        offline: totalStreamers - liveStreamers,
      },
      clips: {
        total: totalClips,
        today: clipsToday,
        thisWeek: clipsThisWeek,
        published: publishedClips,
      },
      performance: {
        avgViralScore: parseFloat(avgViralScore?.avg || 0),
        publishRate,
        approvalRate,
      },
      topStreamer: topStreamer
        ? {
            name: topStreamer.display_name,
            clips: parseInt(topStreamer.clipCount),
          }
        : null,
      bestClip: bestClip
        ? {
            title: bestClip.title,
            viral_score: bestClip.viral_score,
          }
        : null,
    };
  } catch (error) {
    logger.error('❌ Error obteniendo estadísticas:', error);
    throw error;
  }
}

export default {
  getServerStats,
};
