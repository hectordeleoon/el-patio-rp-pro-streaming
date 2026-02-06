import { ChannelType, EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { getAllStreamers } from '../backend/services/streamerService.js';
import logger from '../shared/utils/logger.js';

class ForumManager {
  constructor() {
    this.forumChannelId = process.env.DISCORD_FORUM_CHANNEL_ID;
    this.activeThreads = new Map();
  }

  async createStreamerForums(client) {
    try {
      const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
      if (!guild) {
        logger.error('❌ Guild no encontrado');
        return;
      }

      const forumChannel = guild.channels.cache.get(this.forumChannelId);
      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        logger.error('❌ Canal de foro no encontrado o tipo incorrecto');
        return;
      }

      const streamers = await getAllStreamers();
      logger.info(`📋 Creando/actualizando foros para ${streamers.length} streamers`);

      for (const streamer of streamers) {
        await this.createOrUpdateStreamerThread(forumChannel, streamer);
      }

      logger.info('✅ Foros de streamers actualizados');
    } catch (error) {
      logger.error('❌ Error creando foros de streamers:', error);
      throw error;
    }
  }

  async createOrUpdateStreamerThread(forumChannel, streamer) {
    try {
      // Check if thread already exists
      const existingThreads = await forumChannel.threads.fetchActive();
      let thread = existingThreads.threads.find(
        (t) => t.name === streamer.display_name
      );

      if (!thread) {
        // Create new thread
        const embed = this.createStreamerEmbed(streamer);
        
        thread = await forumChannel.threads.create({
          name: streamer.display_name,
          message: {
            embeds: [embed],
          },
          appliedTags: this.getStreamerTags(forumChannel, streamer),
        });

        logger.info(`📝 Hilo creado para ${streamer.display_name}`);
      } else {
        // Update existing thread
        await this.updateStreamerThread(thread, streamer);
      }

      this.activeThreads.set(streamer.id, thread.id);
      return thread;
    } catch (error) {
      logger.error(`❌ Error creando/actualizando hilo para ${streamer.display_name}:`, error);
    }
  }

  async updateStreamerThread(thread, streamer) {
    try {
      const embed = this.createStreamerEmbed(streamer);
      
      // Fetch the first message (initial post)
      const messages = await thread.messages.fetch({ limit: 1 });
      const firstMessage = messages.first();

      if (firstMessage) {
        await firstMessage.edit({ embeds: [embed] });
        logger.info(`🔄 Hilo actualizado para ${streamer.display_name}`);
      }
    } catch (error) {
      logger.error(`❌ Error actualizando hilo para ${streamer.display_name}:`, error);
    }
  }

  createStreamerEmbed(streamer) {
    const isLive = streamer.is_live;
    const color = isLive ? '#00FF00' : '#808080';
    const statusEmoji = isLive ? '🔴' : '⚫';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${statusEmoji} ${streamer.display_name}`)
      .setDescription(streamer.bio || 'Sin descripción')
      .setThumbnail(streamer.profile_image_url)
      .addFields(
        {
          name: '🌐 Plataformas',
          value: this.formatPlatforms(streamer),
          inline: false,
        },
        {
          name: '📊 Estado',
          value: isLive ? `🔴 **EN VIVO**\n${streamer.current_game || 'N/A'}` : '⚫ Offline',
          inline: true,
        },
        {
          name: '👥 Espectadores',
          value: isLive ? streamer.viewer_count?.toString() || '0' : 'N/A',
          inline: true,
        },
        {
          name: '🎬 Total de Clips',
          value: streamer.total_clips?.toString() || '0',
          inline: true,
        },
        {
          name: '⭐ Mejor Viral Score',
          value: streamer.best_viral_score?.toString() || 'N/A',
          inline: true,
        },
        {
          name: '📅 Último Stream',
          value: streamer.last_stream_at
            ? `<t:${Math.floor(new Date(streamer.last_stream_at).getTime() / 1000)}:R>`
            : 'Nunca',
          inline: true,
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Actualizado automáticamente' });

    if (isLive && streamer.stream_thumbnail) {
      embed.setImage(streamer.stream_thumbnail);
    }

    return embed;
  }

  formatPlatforms(streamer) {
    const platforms = [];
    
    if (streamer.twitch_username) {
      platforms.push(`🟣 [Twitch](https://twitch.tv/${streamer.twitch_username})`);
    }
    if (streamer.youtube_channel_id) {
      platforms.push(`🔴 [YouTube](https://youtube.com/channel/${streamer.youtube_channel_id})`);
    }
    if (streamer.kick_username) {
      platforms.push(`🟢 [Kick](https://kick.com/${streamer.kick_username})`);
    }

    return platforms.length > 0 ? platforms.join('\n') : 'N/A';
  }

  getStreamerTags(forumChannel, streamer) {
    const tags = [];
    const availableTags = forumChannel.availableTags;

    // Add status tag
    if (streamer.is_live) {
      const liveTag = availableTags.find((t) => t.name.toLowerCase() === 'live');
      if (liveTag) tags.push(liveTag.id);
    }

    // Add platform tags
    if (streamer.twitch_username) {
      const twitchTag = availableTags.find((t) => t.name.toLowerCase() === 'twitch');
      if (twitchTag) tags.push(twitchTag.id);
    }

    return tags;
  }

  async postClipToThread(streamerId, clipData) {
    try {
      const threadId = this.activeThreads.get(streamerId);
      if (!threadId) {
        logger.warn(`⚠️ No se encontró hilo para streamer ID: ${streamerId}`);
        return;
      }

      const thread = await this.getThread(threadId);
      if (!thread) return;

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🎬 Nuevo Clip: ${clipData.title}`)
        .setDescription(clipData.description || 'Sin descripción')
        .addFields(
          { name: '📊 Viral Score', value: `${clipData.viral_score}/100`, inline: true },
          { name: '⏱️ Duración', value: `${clipData.duration}s`, inline: true },
          { name: '📅 Fecha', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
        )
        .setTimestamp();

      if (clipData.thumbnail_url) {
        embed.setImage(clipData.thumbnail_url);
      }

      await thread.send({ embeds: [embed] });
      logger.info(`✅ Clip publicado en hilo de streamer ${streamerId}`);
    } catch (error) {
      logger.error(`❌ Error publicando clip en hilo:`, error);
    }
  }

  async getThread(threadId) {
    try {
      const guild = await this.client.guilds.fetch(process.env.DISCORD_GUILD_ID);
      const forumChannel = await guild.channels.fetch(this.forumChannelId);
      return await forumChannel.threads.fetch(threadId);
    } catch (error) {
      logger.error(`❌ Error obteniendo hilo ${threadId}:`, error);
      return null;
    }
  }
}

const forumManager = new ForumManager();

export const createStreamerForums = (client) => {
  forumManager.client = client;
  return forumManager.createStreamerForums(client);
};

export const updateStreamerStatus = (streamerId, streamerData) => {
  return forumManager.updateStreamerThread(streamerId, streamerData);
};

export const postClipToStreamerThread = (streamerId, clipData) => {
  return forumManager.postClipToThread(streamerId, clipData);
};

export default forumManager;
