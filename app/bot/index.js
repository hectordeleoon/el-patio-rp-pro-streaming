import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from '../shared/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DiscordBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.commands = new Collection();
    this.events = new Collection();
  }

  async start() {
    try {
      // Load commands
      await this.loadCommands();

      // Load events
      await this.loadEvents();

      // Register slash commands
      await this.registerCommands();

      // Login to Discord
      await this.client.login(process.env.DISCORD_TOKEN);

      logger.info('✅ Discord bot logged in successfully');
    } catch (error) {
      logger.error('❌ Error starting Discord bot:', error);
      throw error;
    }
  }

  async loadCommands() {
    const commandsPath = join(__dirname, 'commands');
    const commandFolders = readdirSync(commandsPath);

    for (const folder of commandFolders) {
      const folderPath = join(commandsPath, folder);
      const commandFiles = readdirSync(folderPath).filter(
        (file) => file.endsWith('.js')
      );

      for (const file of commandFiles) {
        try {
          const filePath = join(folderPath, file);
          const command = await import(`file://${filePath}`);
          
          if ('data' in command.default && 'execute' in command.default) {
            this.commands.set(command.default.data.name, command.default);
            logger.info(`📝 Comando cargado: ${command.default.data.name}`);
          } else {
            logger.warn(`⚠️ Comando en ${filePath} no tiene data o execute`);
          }
        } catch (error) {
          logger.error(`❌ Error cargando comando ${file}:`, error);
        }
      }
    }
  }

  async loadEvents() {
    const eventsPath = join(__dirname, 'events');
    const eventFiles = readdirSync(eventsPath).filter(
      (file) => file.endsWith('.js')
    );

    for (const file of eventFiles) {
      try {
        const filePath = join(eventsPath, file);
        const event = await import(`file://${filePath}`);

        if (event.default.once) {
          this.client.once(event.default.name, (...args) =>
            event.default.execute(...args, this.client)
          );
        } else {
          this.client.on(event.default.name, (...args) =>
            event.default.execute(...args, this.client)
          );
        }

        this.events.set(event.default.name, event.default);
        logger.info(`🎯 Evento cargado: ${event.default.name}`);
      } catch (error) {
        logger.error(`❌ Error cargando evento ${file}:`, error);
      }
    }
  }

  async registerCommands() {
    const commandsData = Array.from(this.commands.values()).map((cmd) => cmd.data.toJSON());

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
      logger.info('🔄 Registrando comandos slash...');

      if (process.env.DISCORD_GUILD_ID) {
        // Register for specific guild (faster for development)
        await rest.put(
          Routes.applicationGuildCommands(
            process.env.DISCORD_CLIENT_ID,
            process.env.DISCORD_GUILD_ID
          ),
          { body: commandsData }
        );
        logger.info(`✅ ${commandsData.length} comandos registrados en el servidor`);
      } else {
        // Register globally (takes up to 1 hour to update)
        await rest.put(
          Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
          { body: commandsData }
        );
        logger.info(`✅ ${commandsData.length} comandos registrados globalmente`);
      }
    } catch (error) {
      logger.error('❌ Error registrando comandos:', error);
      throw error;
    }
  }

  async stop() {
    logger.info('Deteniendo Discord bot...');
    this.client.destroy();
    logger.info('Discord bot detenido');
  }

  getClient() {
    return this.client;
  }
}

export default DiscordBot;
