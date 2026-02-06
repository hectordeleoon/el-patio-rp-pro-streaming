import cron from 'node-cron';
import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import { google } from 'googleapis';
import axios from 'axios';
import logger from '../../shared/utils/logger.js';
import { getModels } from '../../shared/database/models/index.js';
import { validateRPStream } from '../utils/rpValidator.js';
import { notifyStreamStart, notifyStreamEnd } from './notificationService.js';

class StreamMonitor {
  constructor() {
    this.isRunning = false;
    this.checkInterval = 60000; // 1 minute
    this.twitchClient = null;
    this.youtubeClient = null;
  }

  async initialize() {
    try {
      // Initialize Twitch API
      const authProvider = new AppTokenAuthProvider(
        process.env.TWITCH_CLIENT_ID,
        process.env.TWITCH_CLIENT_SECRET
      );
      this.twitchClient = new ApiClient({ authProvider });

      // Initialize YouTube API
      this.youtubeClient = google.youtube({
        version: 'v3',
        auth: process.env.YOUTUBE_API_KEY,
      });

      logger.info('✅ Stream Monitor inicializado');
    } catch (error) {
      logger.error('❌ Error inicializando Stream Monitor:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) {
      logger.warn('⚠️ Stream Monitor ya está corriendo');
      return;
    }

    await this.initialize();
    this.isRunning = true;

    // Run immediately on start
    await this.checkAllStreamers();

    // Schedule periodic checks
    cron.schedule('*/1 * * * *', async () => {
      if (this.isRunning) {
        await this.checkAllStreamers();
      }
    });

    logger.info('🔄 Stream Monitor iniciado - Verificando cada 1 minuto');
  }

  async checkAllStreamers() {
    try {
      const { Streamer } = getModels();
      const streamers = await Streamer.findAll({
        where: { is_active: true },
      });

      logger.info(`🔍 Verificando ${streamers.length} streamers...`);

      for (const streamer of streamers) {
        await this.checkStreamer(streamer);
      }
    } catch (error) {
      logger.error('❌ Error verificando streamers:', error);
    }
  }

  async checkStreamer(streamer) {
    try {
      let isLive = false;
      let streamData = null;

      // Check Twitch
      if (streamer.twitch_username) {
        const twitchData = await this.checkTwitch(streamer.twitch_username);
        if (twitchData) {
          isLive = true;
          streamData = twitchData;
        }
      }

      // Check YouTube
      if (!isLive && streamer.youtube_channel_id) {
        const youtubeData = await this.checkYouTube(streamer.youtube_channel_id);
        if (youtubeData) {
          isLive = true;
          streamData = youtubeData;
        }
      }

      // Check Kick
      if (!isLive && streamer.kick_username) {
        const kickData = await this.checkKick(streamer.kick_username);
        if (kickData) {
          isLive = true;
          streamData = kickData;
        }
      }

      // Update streamer status
      await this.updateStreamerStatus(streamer, isLive, streamData);
    } catch (error) {
      logger.error(`❌ Error verificando streamer ${streamer.display_name}:`, error);
    }
  }

  async checkTwitch(username) {
    try {
      const user = await this.twitchClient.users.getUserByName(username);
      if (!user) return null;

      const stream = await this.twitchClient.streams.getStreamByUserId(user.id);
      if (!stream) return null;

      const game = await stream.getGame();

      return {
        platform: 'twitch',
        stream_id: stream.id,
        streamer_id: user.id,
        streamer_name: user.displayName,
        title: stream.title,
        game: game?.name || 'Unknown',
        game_id: game?.id || null,
        viewer_count: stream.viewers,
        thumbnail_url: stream.getThumbnailUrl(1920, 1080),
        started_at: stream.startDate,
        language: stream.language,
        is_mature: stream.isMature,
        tags: stream.tags,
      };
    } catch (error) {
      logger.error(`❌ Error verificando Twitch para ${username}:`, error);
      return null;
    }
  }

  async checkYouTube(channelId) {
    try {
      const response = await this.youtubeClient.search.list({
        part: ['snippet'],
        channelId: channelId,
        eventType: 'live',
        type: ['video'],
        maxResults: 1,
      });

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      const liveVideo = response.data.items[0];
      const videoDetails = await this.youtubeClient.videos.list({
        part: ['snippet', 'liveStreamingDetails', 'statistics'],
        id: [liveVideo.id.videoId],
      });

      const video = videoDetails.data.items[0];

      return {
        platform: 'youtube',
        stream_id: video.id,
        streamer_id: channelId,
        streamer_name: video.snippet.channelTitle,
        title: video.snippet.title,
        game: video.snippet.categoryId || 'Gaming',
        game_id: null,
        viewer_count: parseInt(video.liveStreamingDetails?.concurrentViewers || 0),
        thumbnail_url: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high.url,
        started_at: new Date(video.liveStreamingDetails.actualStartTime),
        language: video.snippet.defaultLanguage || 'unknown',
        tags: video.snippet.tags || [],
      };
    } catch (error) {
      logger.error(`❌ Error verificando YouTube para canal ${channelId}:`, error);
      return null;
    }
  }

  async checkKick(username) {
    try {
      const response = await axios.get(`https://kick.com/api/v2/channels/${username}`);
      
      if (!response.data || !response.data.livestream) {
        return null;
      }

      const stream = response.data.livestream;

      return {
        platform: 'kick',
        stream_id: stream.id.toString(),
        streamer_id: response.data.id.toString(),
        streamer_name: response.data.user.username,
        title: stream.session_title,
        game: stream.categories?.[0]?.name || 'Unknown',
        game_id: stream.categories?.[0]?.id?.toString() || null,
        viewer_count: stream.viewer_count || 0,
        thumbnail_url: stream.thumbnail?.url || null,
        started_at: new Date(stream.created_at),
        language: stream.language || 'unknown',
        tags: stream.tags || [],
      };
    } catch (error) {
      if (error.response?.status !== 404) {
        logger.error(`❌ Error verificando Kick para ${username}:`, error);
      }
      return null;
    }
  }

  async updateStreamerStatus(streamer, isLive, streamData) {
    const wasLive = streamer.is_live;

    if (isLive && streamData) {
      const isValidRP = await validateRPStream(streamData);

      if (!isValidRP) {
        logger.warn(`⚠️ Stream de ${streamer.display_name} no cumple requisitos de RP`);
        
        if (wasLive) {
          await this.endStream(streamer);
        }
        return;
      }

      if (!wasLive) {
        await this.startStream(streamer, streamData);
      } else {
        await this.updateStream(streamer, streamData);
      }
    } else if (wasLive && !isLive) {
      await this.endStream(streamer);
    }
  }

  async startStream(streamer, streamData) {
    try {
      const { Stream } = getModels();
      
      const stream = await Stream.create({
        streamer_id: streamer.id,
        platform: streamData.platform,
        platform_stream_id: streamData.stream_id,
        title: streamData.title,
        game: streamData.game,
        game_id: streamData.game_id,
        viewer_count: streamData.viewer_count,
        started_at: streamData.started_at,
        thumbnail_url: streamData.thumbnail_url,
        is_active: true,
      });

      await streamer.update({
        is_live: true,
        current_stream_id: stream.id,
        last_stream_at: new Date(),
        viewer_count: streamData.viewer_count,
      });

      logger.info(`🔴 ${streamer.display_name} comenzó stream en ${streamData.platform}`);

      await notifyStreamStart(streamer, streamData);

      if (global.io) {
        global.io.to('streams').emit('stream:started', {
          streamer: streamer.toJSON(),
          stream: stream.toJSON(),
        });
      }
    } catch (error) {
      logger.error(`❌ Error iniciando stream para ${streamer.display_name}:`, error);
    }
  }

  async updateStream(streamer, streamData) {
    try {
      const { Stream } = getModels();
      const stream = await Stream.findByPk(streamer.current_stream_id);
      if (!stream) return;

      await stream.update({
        title: streamData.title,
        game: streamData.game,
        viewer_count: streamData.viewer_count,
        thumbnail_url: streamData.thumbnail_url,
      });

      await streamer.update({
        viewer_count: streamData.viewer_count,
      });

      if (global.io) {
        global.io.to('streams').emit('stream:updated', {
          streamer: streamer.toJSON(),
          stream: stream.toJSON(),
        });
      }
    } catch (error) {
      logger.error(`❌ Error actualizando stream para ${streamer.display_name}:`, error);
    }
  }

  async endStream(streamer) {
    try {
      const { Stream } = getModels();
      const stream = await Stream.findByPk(streamer.current_stream_id);
      if (!stream) return;

      await stream.update({
        ended_at: new Date(),
        is_active: false,
      });

      await streamer.update({
        is_live: false,
        current_stream_id: null,
        viewer_count: 0,
      });

      logger.info(`⚫ ${streamer.display_name} terminó stream`);

      await notifyStreamEnd(streamer, stream);

      if (global.io) {
        global.io.to('streams').emit('stream:ended', {
          streamer: streamer.toJSON(),
          stream: stream.toJSON(),
        });
      }
    } catch (error) {
      logger.error(`❌ Error finalizando stream para ${streamer.display_name}:`, error);
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('🛑 Stream Monitor detenido');
  }
}

const streamMonitor = new StreamMonitor();

export const startStreamMonitor = () => streamMonitor.start();
export const stopStreamMonitor = () => streamMonitor.stop();
export const getActiveStreams = async () => {
  const { Stream } = getModels();
  return await Stream.findAll({
    where: { is_active: true },
    include: ['streamer'],
    order: [['viewer_count', 'DESC']],
  });
};

export default streamMonitor;
