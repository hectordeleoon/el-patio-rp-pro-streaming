import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getActiveStreams } from '../../backend/services/streamMonitor.js';
import logger from '../../shared/utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('live')
    .setDescription('Ver streamers en vivo de El Patio RP'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const streams = await getActiveStreams();

      if (!streams || streams.length === 0) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('📡 Nadie está en vivo')
              .setDescription('No hay streamers activos en este momento.')
              .setTimestamp(),
          ],
        });
      }

      const embeds = streams.map((stream) => {
        const embed = new EmbedBuilder()
          .setColor('#9147FF')
          .setTitle(`🔴 ${stream.streamer_name} está en vivo!`)
          .setURL(stream.stream_url)
          .setDescription(stream.title || 'Sin título')
          .setThumbnail(stream.thumbnail_url)
          .addFields(
            { name: '🎮 Juego', value: stream.game || 'N/A', inline: true },
            { name: '👥 Espectadores', value: stream.viewer_count?.toString() || '0', inline: true },
            { name: '🌐 Plataforma', value: stream.platform.toUpperCase(), inline: true },
            { name: '⏰ Empezó', value: `<t:${Math.floor(new Date(stream.started_at).getTime() / 1000)}:R>`, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: 'El Patio RP Pro' });

        if (stream.profile_image_url) {
          embed.setAuthor({
            name: stream.streamer_name,
            iconURL: stream.profile_image_url,
          });
        }

        return embed;
      });

      await interaction.editReply({
        embeds: embeds.slice(0, 10), // Discord limit
      });

      logger.info(`✅ Comando /live ejecutado - ${streams.length} streams activos`);
    } catch (error) {
      logger.error('❌ Error en comando /live:', error);
      
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error')
            .setDescription('Hubo un error obteniendo los streams. Intenta de nuevo.')
            .setTimestamp(),
        ],
      });
    }
  },
};
