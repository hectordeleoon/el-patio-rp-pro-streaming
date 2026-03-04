// ═══════════════════════════════════════════════════════════════════════════════
//            🔥 EL PATIO BOT STREAM v9.2 — RAILWAY DEPLOY READY
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const {
  Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, Partials, REST, Routes,
} = require('discord.js');
const express = require('express');
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');
const cors    = require('cors');

// CONFIGURACIÓN
const config = {
  discord: {
    token:                  process.env.DISCORD_TOKEN,
    clientId:               process.env.DISCORD_CLIENT_ID,
    guildId:                process.env.DISCORD_GUILD_ID,
    forumChannelId:         process.env.DISCORD_FORUM_CHANNEL_ID,
    streamerRoleId:         process.env.STREAMER_ROLE_ID,
    staffRoleId:            process.env.STAFF_ROLE_ID || '',
    notificationsChannelId: process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    liveChannelId:          process.env.DISCORD_LIVE_CHANNEL_ID || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    postsChannelId:         process.env.DISCORD_POSTS_CHANNEL_ID || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    clipsChannelId:         process.env.DISCORD_CLIPS_CHANNEL_ID || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    generalChannelId:       process.env.DISCORD_GENERAL_CHANNEL_ID || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    adminChannelId:         process.env.DISCORD_ADMIN_CHANNEL_ID || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    scheduleChannelId:      process.env.DISCORD_SCHEDULE_CHANNEL_ID || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
  },
  twitch:  { clientId: process.env.TWITCH_CLIENT_ID, clientSecret: process.env.TWITCH_CLIENT_SECRET },
  youtube: { apiKey:   process.env.YOUTUBE_API_KEY },
  groq:    { apiKey:   process.env.GROQ_API_KEY, model: 'llama-3.1-70b-versatile' },
  notifications: {
    checkInterval:   parseInt(process.env.CHECK_INTERVAL) || 60000,
    cooldownMinutes: parseInt(process.env.NOTIFICATION_COOLDOWN) || 30,
    retryAttempts: 3, retryDelay: 5000,
    enableTwitch:  process.env.ENABLE_TWITCH !== 'false',
    enableKick:    process.env.ENABLE_KICK !== 'false',
    enableTikTok:  process.env.ENABLE_TIKTOK !== 'false',
    enableYouTube: process.env.ENABLE_YOUTUBE === 'true',
  },
  clips: {
    viralThreshold:      parseInt(process.env.VIRAL_SCORE_AUTO_PUBLISH_THRESHOLD || '70'),
    autoClipIntervalMin: parseInt(process.env.AUTO_CLIP_INTERVAL_MIN || '20'),
    minViewers:          parseInt(process.env.MIN_VIEWERS_TO_CLIP || '10'),
    autoGeneration:      process.env.FEATURE_AUTO_CLIP_GENERATION === 'true',
  },
  port:     parseInt(process.env.PORT || '3000'), // Railway asigna PORT automáticamente
  adminKey: process.env.DASHBOARD_ADMIN_KEY || 'Leoon272113',
  staffKey: process.env.DASHBOARD_STAFF_KEY || 'staff-elpatio-2026',
  shopVipRoleId: process.env.SHOP_VIP_ROLE_ID || '',
};

// [Aquí va TODO el resto de tu código original del bot: 
// PLATFORM_CONFIG, SHOP_ITEMS, REWARD_MILESTONES, STORAGE, 
// todas las funciones helper, verificaciones, etc.]

// Para ahorrar espacio, asumo que pegarás tu código existente aquí desde 
// // PLATAFORMAS hasta justo antes de // EXPRESS API Y DASHBOARD

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS API Y DASHBOARD - RAILWAY OPTIMIZED
// ═══════════════════════════════════════════════════════════════════════════════
const webApp = express();

// Middleware esencial para Railway
webApp.use(cors());
webApp.use(express.json());
webApp.use(express.static(path.join(__dirname, 'public'))); // Sirve la carpeta public

// Middleware de autenticación
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key || req.body?.key;
  if (key === config.adminKey) { req.role = 'admin'; req.userLevel = 3; return next(); }
  if (key === config.staffKey) { req.role = 'staff'; req.userLevel = 2; return next(); }
  return res.status(401).json({ error: 'No autorizado. Clave inválida.' });
}

function requireAdminOnly(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key || req.body?.key;
  if (key === config.adminKey) { req.role = 'admin'; req.userLevel = 3; return next(); }
  return res.status(403).json({ error: 'Solo el admin principal puede hacer esto.' });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUTAS API (Todas las que te di antes)
// ═══════════════════════════════════════════════════════════════════════════════

// Status público
webApp.get('/api/status', (req, res) => {
  const streamersList = [];
  for (const [uid, d] of storage.streamers.entries()) {
    streamersList.push({
      id: uid, 
      displayName: d.displayName || uid, 
      platforms: d.platforms || {}, 
      stats: d.stats || {}, 
      coins: getCoins(uid), 
      isLive: [...storage.liveStreams.keys()].some(k => k.includes(uid)),
    });
  }
  res.json({
    bot: client.user?.tag || 'Desconectado',
    status: 'online', 
    ping: client.ws.ping, 
    uptime: Math.floor(process.uptime()),
    memory: fmtMem(), 
    version: '9.2',
    stats: { streamers: storage.streamers.size, liveNow: storage.liveStreams.size },
    config: { 
      enableTwitch: config.notifications.enableTwitch, 
      enableKick: config.notifications.enableKick, 
      enableTikTok: config.notifications.enableTikTok 
    },
    streamers: streamersList,
  });
});

// Live streams
webApp.get('/api/live', (req, res) => {
  const list = [];
  for (const [key, data] of storage.liveStreams.entries()) {
    const uid = key.substring(key.indexOf('-') + 1);
    const sd = storage.streamers.get(uid) || {};
    list.push({...data, userId: uid, platforms: sd.platforms || {}, displayName: sd.displayName || uid});
  }
  res.json(list);
});

// Ruta para buscar miembros
webApp.get('/admin/find-member', requireAdmin, async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json([]);
  
  try {
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) return res.status(500).json({ error: 'Bot no conectado al servidor' });
    
    let members;
    try {
      members = await guild.members.fetch({ query: q, limit: 10 });
      if (members.size === 0) {
        members = guild.members.cache.filter(m => 
          (m.displayName?.toLowerCase().includes(q)) || 
          (m.user?.username?.toLowerCase().includes(q)) ||
          (m.id === q)
        ).first(10);
      }
    } catch(e) {
      members = guild.members.cache.filter(m => 
        (m.displayName?.toLowerCase().includes(q)) || 
        (m.user?.username?.toLowerCase().includes(q)) ||
        (m.id === q)
      ).first(10);
    }
    
    const results = [];
    for (const [id, m] of members.entries ? members.entries() : Object.entries(members)) {
      if (results.length >= 10) break;
      results.push({ 
        id: m.id, 
        displayName: m.displayName || m.user?.username || 'Unknown', 
        username: m.user?.username || 'unknown', 
        avatar: m.user?.displayAvatarURL({ size: 64 }) || '', 
        isRegistered: storage.streamers.has(m.id), 
        hasStreamerRole: config.discord.streamerRoleId ? m.roles?.cache.has(config.discord.streamerRoleId) : false 
      });
    }
    
    res.json(results);
  } catch(e) { 
    console.error('Error en find-member:', e);
    res.status(500).json({ error: e.message }); 
  }
});

// Registro aprobación
webApp.post('/api/approve-registration/:uid', requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const pending = storage.pendingRegistrations.get(uid);
    if (!pending) return res.status(404).json({ error: 'Solicitud no encontrada' });
    
    const guild = client.guilds.cache.get(config.discord.guildId);
    const member = await guild.members.fetch(uid).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });
    
    const thread = await createStreamerThread(member, pending.platforms, pending.bio, '#9146FF');
    storage.pendingRegistrations.delete(uid);
    saveStorage();
    
    res.json({ ok: true, threadId: thread.id, displayName: member.displayName });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

webApp.post('/api/reject-registration/:uid', requireAdmin, (req, res) => {
  try {
    const { uid } = req.params;
    storage.pendingRegistrations.delete(uid);
    saveStorage();
    res.json({ ok: true });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// Streamers
webApp.get('/api/streamers', requireAdmin, (req, res) => {
  const list = [];
  for (const [uid, data] of storage.streamers.entries()) {
    list.push({
      uid,
      ...data,
      coins: getCoins(uid),
      isLive: [...storage.liveStreams.keys()].some(k => k.includes(uid)),
      weeklyStats: storage.weeklyStats.get(uid) || {},
      economy: storage.economy.get(uid) || { coins: 0 }
    });
  }
  res.json(list);
});

webApp.delete('/api/streamer/:uid', requireAdminOnly, async (req, res) => {
  try {
    const { uid } = req.params;
    if (!storage.streamers.has(uid)) return res.status(404).json({ error: 'No encontrado' });
    
    const threadId = storage.threads.get(uid);
    if (threadId) {
      try {
        const guild = client.guilds.cache.get(config.discord.guildId);
        const thread = await guild.channels.fetch(threadId).catch(() => null);
        if (thread) await thread.delete('Eliminado por admin');
      } catch (e) { console.error('Error eliminando hilo:', e); }
    }
    
    try {
      const guild = client.guilds.cache.get(config.discord.guildId);
      const member = await guild.members.fetch(uid).catch(() => null);
      if (member && config.discord.streamerRoleId) {
        await member.roles.remove(config.discord.streamerRoleId);
      }
    } catch (e) { console.error('Error quitando rol:', e); }
    
    storage.streamers.delete(uid);
    storage.threads.delete(uid);
    saveStorage();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Solicitudes pendientes
webApp.get('/api/pending-registrations', requireAdmin, (req, res) => {
  res.json([...storage.pendingRegistrations.entries()].map(([uid, d]) => ({ uid, ...d })));
});

// Posts
webApp.get('/api/posts', requireAdmin, (req, res) => {
  res.json(storage.posts || []);
});

webApp.post('/api/posts', requireAdmin, (req, res) => {
  try {
    const { platform, content, url } = req.body;
    const post = {
      id: Date.now().toString(),
      platform, content, url,
      createdAt: new Date().toISOString(),
      createdBy: req.role
    };
    if (!storage.posts) storage.posts = [];
    storage.posts.unshift(post);
    if (storage.posts.length > 100) storage.posts.pop();
    saveStorage();
    res.json({ ok: true, post });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Top 3
webApp.get('/api/top3', requireAdmin, (req, res) => {
  const stats = [];
  for (const [uid, data] of storage.weeklyStats.entries()) {
    const streamer = storage.streamers.get(uid);
    if (streamer) {
      stats.push({
        uid,
        displayName: streamer.displayName,
        avatar: streamer.avatar || '',
        ...data,
        score: (data.peakViewers || 0) + ((data.streams || 0) * 10) + ((data.viralClips || 0) * 50)
      });
    }
  }
  res.json(stats.sort((a, b) => b.score - a.score).slice(0, 3));
});

webApp.post('/api/top3/reset', requireAdminOnly, (req, res) => {
  storage.weeklyStats.clear();
  saveStorage();
  res.json({ ok: true });
});

// Clips
webApp.get('/api/clips', requireAdmin, (req, res) => {
  const all = [];
  for (const [uid, clips] of storage.clips.entries()) {
    clips.forEach(c => all.push({ ...c, streamerId: uid }));
  }
  res.json(all.sort((a, b) => new Date(b.processedAt || 0) - new Date(a.processedAt || 0)).slice(0, 100));
});

// Apuestas
webApp.get('/api/bets', requireAdmin, (req, res) => {
  const active = [];
  for (const [id, bet] of storage.bets || new Map()) {
    if (bet.status === 'active') active.push({ id, ...bet });
  }
  res.json(active);
});

webApp.get('/api/bets/history', requireAdmin, (req, res) => {
  const history = [];
  for (const [id, bet] of storage.bets || new Map()) {
    if (bet.status !== 'active') history.push({ id, ...bet });
  }
  res.json(history.slice(-50));
});

// Horarios
webApp.get('/api/schedules', requireAdmin, (req, res) => {
  const schedules = [];
  for (const [uid, data] of storage.streamSchedules || new Map()) {
    const streamer = storage.streamers.get(uid);
    schedules.push({ uid, displayName: streamer?.displayName || 'Desconocido', ...data });
  }
  res.json(schedules);
});

// Config
webApp.get('/api/config', requireAdmin, (req, res) => {
  res.json({
    notifications: config.notifications,
    clips: config.clips,
    discord: {
      guildId: config.discord.guildId,
      streamerRoleId: config.discord.streamerRoleId,
    }
  });
});

webApp.post('/api/config', requireAdminOnly, (req, res) => {
  try {
    const { checkInterval, cooldownMinutes } = req.body;
    if (checkInterval) config.notifications.checkInterval = parseInt(checkInterval);
    if (cooldownMinutes) config.notifications.cooldownMinutes = parseInt(cooldownMinutes);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Stats
webApp.get('/api/stats', requireAdmin, (req, res) => {
  const totalCoins = [...storage.economy.values()].reduce((a, b) => a + (b.coins || 0), 0);
  res.json({
    streamers: storage.streamers.size,
    liveNow: storage.liveStreams.size,
    pending: storage.pendingRegistrations.size,
    totalCoins,
    clips: storage.clips?.size || 0,
    bets: storage.bets?.size || 0,
    uptime: process.uptime()
  });
});

// Logs
webApp.get('/api/logs', requireAdmin, (req, res) => {
  res.json(webLogs.slice(-100));
});

// Forzar check
webApp.post('/api/check-now', requireAdmin, async (req, res) => {
  try {
    await checkAllStreams();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Torneos
webApp.get('/api/tournaments', requireAdmin, (req, res) => {
  res.json([...storage.tournaments.values()]);
});

webApp.post('/api/tournament', requireAdminOnly, (req, res) => {
  try {
    const { name, metric, duration, prize } = req.body;
    const id = Date.now().toString();
    storage.tournaments.set(id, {
      id, name, metric,
      startTime: Date.now(),
      endTime: Date.now() + (duration * 3600000),
      prize,
      participants: [],
      status: 'active'
    });
    saveStorage();
    res.json({ ok: true, tournamentId: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// RUTA FRONTEND: Sirve el index.html para cualquier ruta no API (SPA)
webApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════════
// INICIO DEL BOT
// ═══════════════════════════════════════════════════════════════════════════════

// Client setup (tu código existente)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Evento ready (versión nueva para evitar deprecation)
client.once('clientReady', async () => {
  console.log(`🤖 ${client.user.tag} listo!`);
  console.log(`📊 Versión: 9.2 Ultra Notifier`);
  console.log(`🌐 Web dashboard: http://localhost:${config.port}`);
  
  loadStorage();
  await registerCommands();
  
  // Iniciar loop
  setInterval(checkAllStreams, config.notifications.checkInterval);
  console.log(`🔄 Verificación cada ${config.notifications.checkInterval / 1000}s`);
  
  // Iniciar servidor web (IMPORTANTE: Railway necesita escuchar en 0.0.0.0)
  webApp.listen(config.port, '0.0.0.0', () => {
    console.log(`🌐 Dashboard activo en puerto ${config.port}`);
  });
});

client.on('error', (e) => logError('Discord Client', e));

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Guardando...');
  saveStorage();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Cerrando...');
  saveStorage();
  client.destroy();
  process.exit(0);
});

client.login(config.discord.token).catch(e => {
  console.error('❌ Error login:', e.message);
  process.exit(1);
});
