import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getServerStats } from '../../backend/services/statsService.js';
import logger from '../../shared/utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Ver estadísticas del servidor y clips'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const stats = await getServerStats();

      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('📊 Estadísticas de El Patio RP')
        .setDescription('Resumen de actividad y rendimiento')
        .addFields(
          {
            name: '🔴 Streamers',
            value: [
              `Total: ${stats.streamers.total}`,
              `En vivo: ${stats.streamers.live}`,
              `Offline: ${stats.streamers.offline}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🎬 Clips',
            value: [
              `Total: ${stats.clips.total}`,
              `Hoy: ${stats.clips.today}`,
              `Esta semana: ${stats.clips.thisWeek}`,
              `Publicados: ${stats.clips.published}`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '📈 Rendimiento',
            value: [
              `Viral Score Promedio: ${stats.performance.avgViralScore.toFixed(1)}`,
              `Tasa de Publicación: ${stats.performance.publishRate.toFixed(1)}%`,
              `Clips Aprobados: ${stats.performance.approvalRate.toFixed(1)}%`,
            ].join('\n'),
            inline: true,
          },
          {
            name: '🏆 Top Streamer',
            value: stats.topStreamer
              ? `${stats.topStreamer.name} - ${stats.topStreamer.clips} clips`
              : 'N/A',
            inline: true,
          },
          {
            name: '⭐ Mejor Clip',
            value: stats.bestClip
              ? `${stats.bestClip.title} - Score: ${stats.bestClip.viral_score}`
              : 'N/A',
            inline: true,
          },
          {
            name: '📅 Período',
            value: `Últimos 30 días`,
            inline: true,
          }
        )
        .setTimestamp()
        .setFooter({ text: 'El Patio RP Pro | Stats' });

      await interaction.editReply({ embeds: [embed] });

      logger.info('✅ Comando /stats ejecutado');
    } catch (error) {
      logger.error('❌ Error en comando /stats:', error);
      
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('❌ Error')
            .setDescription('Hubo un error obteniendo las estadísticas. Intenta de nuevo.')
            .setTimestamp(),
        ],
      });
    }
  },
};
