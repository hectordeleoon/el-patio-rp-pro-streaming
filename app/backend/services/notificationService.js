import { EmbedBuilder } from 'discord.js';
import logger from '../../shared/utils/logger.js';

let discordClient = null;

export function setDiscordClient(client) {
  discordClient = client;
}

export async function notifyStreamStart(streamer, streamData) {
  try {
    if (!discordClient) {
      logger.warn('⚠️ Discord client no disponible para notificaciones');
      return;
    }

    const channelId = process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID;
    if (!channelId) return;

    const channel = await discordClient.channels.fetch(channelId);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`🔴 ${streamer.display_name} está en vivo!`)
      .setURL(`https://${streamData.platform}.tv/${streamer[`${streamData.platform}_username`]}`)
      .setDescription(streamData.title || 'Sin título')
      .setThumbnail(streamer.profile_image_url)
      .addFields(
        { name: '🎮 Juego', value: streamData.game || 'N/A', inline: true },
        { name: '👥 Espectadores', value: streamData.viewer_count?.toString() || '0', inline: true },
        { name: '🌐 Plataforma', value: streamData.platform.toUpperCase(), inline: true }
      )
      .setImage(streamData.thumbnail_url)
      .setTimestamp()
      .setFooter({ text: 'El Patio RP Pro' });

    await channel.send({ embeds: [embed] });
    logger.info(`✅ Notificación de stream enviada para ${streamer.display_name}`);
  } catch (error) {
    logger.error('❌ Error enviando notificación de stream:', error);
  }
}

export async function notifyStreamEnd(streamer, stream) {
  try {
    if (!discordClient) return;

    const channelId = process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID;
    if (!channelId) return;

    const channel = await discordClient.channels.fetch(channelId);
    if (!channel) return;

    const duration = Math.floor((new Date(stream.ended_at) - new Date(stream.started_at)) / 1000 / 60);

    const embed = new EmbedBuilder()
      .setColor('#808080')
      .setTitle(`⚫ ${streamer.display_name} terminó el stream`)
      .setDescription(`Stream de ${duration} minutos`)
      .addFields(
        { name: '🎮 Juego', value: stream.game || 'N/A', inline: true },
        { name: '👥 Pico de Espectadores', value: stream.viewer_count?.toString() || '0', inline: true },
        { name: '⏱️ Duración', value: `${duration} minutos`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'El Patio RP Pro' });

    await channel.send({ embeds: [embed] });
    logger.info(`✅ Notificación de fin de stream enviada para ${streamer.display_name}`);
  } catch (error) {
    logger.error('❌ Error enviando notificación de fin de stream:', error);
  }
}

export async function notifyNewClip(clip, streamer) {
  try {
    if (!discordClient) return;

    const channelId = process.env.DISCORD_CLIPS_CHANNEL_ID;
    if (!channelId) return;

    const channel = await discordClient.channels.fetch(channelId);
    if (!channel) return;

    const viralColor = clip.viral_score >= 80 ? '#00FF00' : 
                      clip.viral_score >= 50 ? '#FFA500' : '#FF0000';

    const embed = new EmbedBuilder()
      .setColor(viralColor)
      .setTitle(`🎬 Nuevo Clip: ${clip.title}`)
      .setDescription(clip.description || 'Sin descripción')
      .addFields(
        { name: '👤 Streamer', value: streamer.display_name, inline: true },
        { name: '📊 Viral Score', value: `${clip.viral_score}/100`, inline: true },
        { name: '⏱️ Duración', value: `${clip.duration}s`, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `Clip ID: ${clip.id}` });

    if (clip.thumbnail_url) {
      embed.setImage(clip.thumbnail_url);
    }

    await channel.send({ embeds: [embed] });
    logger.info(`✅ Notificación de nuevo clip enviada: ${clip.id}`);
  } catch (error) {
    logger.error('❌ Error enviando notificación de clip:', error);
  }
}

export default {
  setDiscordClient,
  notifyStreamStart,
  notifyStreamEnd,
  notifyNewClip,
};
