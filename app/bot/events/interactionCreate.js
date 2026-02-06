import { Events } from 'discord.js';
import logger from '../../shared/utils/logger.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands?.get(interaction.commandName);

    if (!command) {
      logger.error(`❌ Comando ${interaction.commandName} no encontrado`);
      return;
    }

    try {
      // Log command usage
      logger.info(
        `📝 Comando ejecutado: ${interaction.commandName} por ${interaction.user.tag} en ${interaction.guild?.name || 'DM'}`
      );

      // Execute command
      await command.execute(interaction);
    } catch (error) {
      logger.error(`❌ Error ejecutando comando ${interaction.commandName}:`, error);

      const errorMessage = {
        content: '❌ Hubo un error ejecutando este comando. Por favor intenta de nuevo.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    }
  },
};
