import Queue from 'bull';
import logger from '../../shared/utils/logger.js';
import { Publication } from '../../shared/database/index.js';

const publicationQueue = new Queue('publication', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD,
  },
});

class PublicationService {
  constructor() {
    this.platforms = ['tiktok', 'instagram', 'youtube_shorts', 'discord'];
  }

  async initialize() {
    // Setup queue processors
    publicationQueue.process('publish', 3, this.processPublication.bind(this));

    publicationQueue.on('completed', (job) => {
      logger.info(`✅ Publicación completada: ${job.id}`);
    });

    publicationQueue.on('failed', (job, err) => {
      logger.error(`❌ Publicación fallida: ${job.id}`, err);
    });

    logger.info('✅ Publication Service inicializado');
  }

  async queuePublication(clip) {
    const platforms = this.getPlatformsForClip(clip);

    for (const platform of platforms) {
      const job = await publicationQueue.add('publish', {
        clip_id: clip.id,
        platform,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      logger.info(`📝 Publicación en cola: ${platform} para clip ${clip.id}`);
    }
  }

  getPlatformsForClip(clip) {
    // Determine which platforms to publish based on clip properties
    const platforms = [];

    if (clip.vertical_file_path) {
      platforms.push('tiktok', 'instagram', 'youtube_shorts');
    }

    if (clip.horizontal_file_path) {
      platforms.push('discord');
    }

    return platforms;
  }

  async processPublication(job) {
    const { clip_id, platform } = job.data;

    try {
      logger.info(`📤 Publicando clip ${clip_id} en ${platform}...`);

      // Create publication record
      const publication = await Publication().create({
        clip_id,
        platform,
        status: 'pending',
      });

      // Get clip data
      const { Clip, Streamer } = await import('../../shared/database/index.js');
      const clip = await Clip().findByPk(clip_id, {
        include: ['streamer'],
      });

      if (!clip) {
        throw new Error('Clip no encontrado');
      }

      // Generate caption and hashtags
      const { caption, hashtags } = this.generateCaption(clip, platform);

      // Publish to platform
      let result;
      switch (platform) {
        case 'tiktok':
          result = await this.publishToTikTok(clip, caption, hashtags);
          break;
        case 'instagram':
          result = await this.publishToInstagram(clip, caption, hashtags);
          break;
        case 'youtube_shorts':
          result = await this.publishToYouTubeShorts(clip, caption, hashtags);
          break;
        case 'discord':
          result = await this.publishToDiscord(clip, caption);
          break;
        default:
          throw new Error(`Plataforma no soportada: ${platform}`);
      }

      // Update publication record
      await publication.update({
        status: 'published',
        platform_post_id: result.postId,
        platform_url: result.url,
        caption,
        hashtags,
        published_at: new Date(),
      });

      logger.info(`✅ Publicado en ${platform}: ${result.url}`);

      // Emit WebSocket event
      if (global.io) {
        global.io.to('clips').emit('clip:published', {
          clip_id,
          platform,
          url: result.url,
        });
      }

      return publication;
    } catch (error) {
      logger.error(`❌ Error publicando en ${platform}:`, error);
      
      // Update publication with error
      const publication = await Publication().findOne({
        where: { clip_id, platform, status: 'pending' },
      });

      if (publication) {
        await publication.update({
          status: 'failed',
          error_message: error.message,
        });
      }

      throw error;
    }
  }

  generateCaption(clip, platform) {
    const streamer = clip.streamer;
    
    // Base caption
    let caption = `${clip.title}\n\n`;
    if (clip.description) {
      caption += `${clip.description}\n\n`;
    }
    caption += `📺 ${streamer.display_name}`;

    // Hashtags
    const hashtags = [
      'ElPatioRP',
      'GTARP',
      'GTAVRoleplay',
      'Roleplay',
      'GTA5',
      'Gaming',
    ];

    // Platform-specific adjustments
    if (platform === 'tiktok') {
      hashtags.push('TikTokGaming', 'FYP');
    } else if (platform === 'instagram') {
      hashtags.push('InstaGaming', 'Reels');
    } else if (platform === 'youtube_shorts') {
      hashtags.push('Shorts', 'YouTubeShorts');
    }

    // Add hashtags to caption
    caption += '\n\n' + hashtags.map(tag => `#${tag}`).join(' ');

    return { caption, hashtags };
  }

  async publishToTikTok(clip, caption, hashtags) {
    // TikTok API implementation
    // This requires TikTok's Content Posting API
    logger.info('📱 Publicando en TikTok...');
    
    // Placeholder - implement actual TikTok API calls
    return {
      postId: 'tiktok_' + Date.now(),
      url: 'https://tiktok.com/@elpatiorp/video/...',
    };
  }

  async publishToInstagram(clip, caption, hashtags) {
    // Instagram API implementation
    // This requires Instagram Graph API
    logger.info('📷 Publicando en Instagram...');
    
    // Placeholder - implement actual Instagram API calls
    return {
      postId: 'ig_' + Date.now(),
      url: 'https://instagram.com/p/...',
    };
  }

  async publishToYouTubeShorts(clip, caption, hashtags) {
    // YouTube Shorts API implementation
    logger.info('🎬 Publicando en YouTube Shorts...');
    
    // Placeholder - implement actual YouTube API calls
    return {
      postId: 'yt_' + Date.now(),
      url: 'https://youtube.com/shorts/...',
    };
  }

  async publishToDiscord(clip, caption) {
    // Discord webhook or channel posting
    logger.info('💬 Publicando en Discord...');
    
    const channelId = process.env.DISCORD_CLIPS_CHANNEL_ID;
    if (!channelId || !global.discordClient) {
      throw new Error('Discord no configurado');
    }

    const channel = await global.discordClient.channels.fetch(channelId);
    const message = await channel.send({
      content: caption,
      files: [clip.horizontal_file_path],
    });

    return {
      postId: message.id,
      url: message.url,
    };
  }
}

const publicationService = new PublicationService();

export const initPublicationService = async () => {
  await publicationService.initialize();
};

export const queuePublication = (clip) => {
  return publicationService.queuePublication(clip);
};

export default publicationService;
