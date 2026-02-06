import { Events, ActivityType } from 'discord.js';
import logger from '../../shared/utils/logger.js';
import { createStreamerForums } from '../services/forumManager.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`✅ Bot conectado como ${client.user.tag}`);
    logger.info(`🎮 Sirviendo a ${client.guilds.cache.size} servidor(es)`);
    logger.info(`👥 Usuarios alcanzados: ${client.users.cache.size}`);

    // Set bot status
    client.user.setPresence({
      activities: [{
        name: 'El Patio RP',
        type: ActivityType.Watching,
      }],
      status: 'online',
    });

    // Initialize streamer forums
    try {
      await createStreamerForums(client);
      logger.info('✅ Foros de streamers inicializados');
    } catch (error) {
      logger.error('❌ Error inicializando foros:', error);
    }

    // Log ready time
    logger.info(`🚀 Bot listo en ${Date.now() - client.readyTimestamp}ms`);
  },
};
