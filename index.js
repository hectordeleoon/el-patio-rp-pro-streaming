// ═══════════════════════════════════════════════════════════════════════════════
//          🔥 EL PATIO BOT STREAM v7.0 — ULTRA NOTIFIER 🔥
//   Twitch + Kick + TikTok + YouTube + Dashboard + Sistema Anti-Spam
//   Detección en tiempo real • Notificaciones instantáneas • 100% Robusto
// ═══════════════════════════════════════════════════════════════════════════════

const {
  Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, MessageFlags, Partials
} = require('discord.js');
const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
//                    CONFIGURACIÓN MEJORADA
// ═══════════════════════════════════════════════════════════════════════════════

const config = {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    forumChannelId: process.env.FORUM_CHANNEL_ID || process.env.DISCORD_FORUM_CHANNEL_ID,
    streamerRoleId: process.env.STREAMER_ROLE_ID,
    notificationsChannelId: process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    clipsChannelId: process.env.DISCORD_CLIPS_CHANNEL_ID,
  },
  twitch: {
    clientId: process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.1-70b-versatile',
  },
  // ⚡ CONFIGURACIÓN DE NOTIFICACIONES MEJORADA
  notifications: {
    checkInterval: parseInt(process.env.CHECK_INTERVAL) || 60000, // 1 minuto (antes 2 min)
    cooldownMinutes: parseInt(process.env.NOTIFICATION_COOLDOWN) || 30, // Anti-spam: 30 min entre notis del mismo streamer
    retryAttempts: 3,
    retryDelay: 5000,
    enableTwitch: process.env.ENABLE_TWITCH !== 'false',
    enableKick: process.env.ENABLE_KICK !== 'false',
    enableTikTok: process.env.ENABLE_TIKTOK !== 'false',
    enableYouTube: process.env.ENABLE_YOUTUBE === 'true',
    enableNewContent: process.env.ENABLE_NEW_CONTENT !== 'false',
  },
  clips: {
    enabled: process.env.FEATURE_AUTO_CLIP_GENERATION === 'true',
    maxDuration: parseInt(process.env.CLIP_MAX_DURATION) || 60,
    viralThreshold: parseInt(process.env.VIRAL_SCORE_AUTO_PUBLISH_THRESHOLD) || 70,
    checkInterval: 180000,
  },
  economy: {
    coinsPerHour: 10,
    coinsPerClip: 50,
    coinsPerAchievement: 20,
    coinsPerVote: 5,
  },
  port: process.env.PORT || 3000,
};

// ═══════════════════════════════════════════════════════════════════════════════
//                    STORAGE CON PERSISTENCIA
// ═══════════════════════════════════════════════════════════════════════════════

const storage = {
  streamers: new Map(),
  threads: new Map(),
  liveStreams: new Map(),      // Streams activos ahora
  notifiedStreams: new Map(),  // Streams ya notificados (anti-spam)
  clips: new Map(),
  achievements: new Map(),
  economy: new Map(),
  streamHistory: new Map(),
  lastContentCheck: new Map(),
  twitchToken: null,
  twitchTokenExpiry: 0,
  errors: [], // Log de errores para debugging
};

const STORAGE_FILE = path.join(__dirname, 'data/storage.json');

async function saveStorage() {
  try {
    await fs.mkdir(path.dirname(STORAGE_FILE), { recursive: true });
    const data = {
      streamers: Object.fromEntries(storage.streamers),
      threads: Object.fromEntries(storage.threads),
      liveStreams: Object.fromEntries(storage.liveStreams),
      notifiedStreams: Object.fromEntries(storage.notifiedStreams),
      achievements: Object.fromEntries(storage.achievements),
      economy: Object.fromEntries(storage.economy),
      streamHistory: Object.fromEntries([...storage.streamHistory.entries()].map(([k, v]) => [k, v.slice(-100)])),
      lastContentCheck: Object.fromEntries(storage.lastContentCheck),
    };
    await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('❌ Error guardando storage:', e.message);
  }
}

async function loadStorage() {
  try {
    const raw = await fs.readFile(STORAGE_FILE, 'utf8');
    const data = JSON.parse(raw);
    const load = (map, obj) => { if (obj) Object.entries(obj).forEach(([k, v]) => map.set(k, v)); };
    load(storage.streamers, data.streamers);
    load(storage.threads, data.threads);
    load(storage.liveStreams, data.liveStreams);
    load(storage.notifiedStreams, data.notifiedStreams);
    load(storage.achievements, data.achievements);
    load(storage.economy, data.economy);
    load(storage.streamHistory, data.streamHistory);
    load(storage.lastContentCheck, data.lastContentCheck);
    console.log(`✅ Storage cargado: ${storage.streamers.size} streamers`);
  } catch (e) {
    console.log('⚠️ No hay storage previo, empezando limpio');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    CLIENTE DISCORD CON RECONEXIÓN
// ═══════════════════════════════════════════════════════════════════════════════

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ═══════════════════════════════════════════════════════════════════════════════
//                    HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function getCoins(userId) {
  return storage.economy.get(userId)?.coins || 0;
}

function addCoins(userId, amount, reason = '') {
  if (!amount) return getCoins(userId);
  const ec = storage.economy.get(userId) || { coins: 0, transactions: [] };
  ec.coins += amount;
  ec.transactions = ec.transactions || [];
  ec.transactions.push({ amount, reason, date: new Date().toISOString() });
  if (ec.transactions.length > 50) ec.transactions = ec.transactions.slice(-50);
  storage.economy.set(userId, ec);
  return ec.coins;
}

function logError(context, error) {
  const errMsg = `[${new Date().toISOString()}] ${context}: ${error.message || error}`;
  storage.errors.push(errMsg);
  if (storage.errors.length > 100) storage.errors.shift();
  console.error(`❌ ${errMsg}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    TWITCH API — CON RETRY
// ═══════════════════════════════════════════════════════════════════════════════

async function getTwitchToken() {
  if (!config.twitch.clientId || !config.twitch.clientSecret) return null;
  if (storage.twitchToken && Date.now() < storage.twitchTokenExpiry) return storage.twitchToken;
  
  try {
    const r = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: { 
        client_id: config.twitch.clientId, 
        client_secret: config.twitch.clientSecret, 
        grant_type: 'client_credentials' 
      },
      timeout: 10000,
    });
    storage.twitchToken = r.data.access_token;
    storage.twitchTokenExpiry = Date.now() + (r.data.expires_in - 300) * 1000;
    console.log('✅ Token Twitch renovado');
    return storage.twitchToken;
  } catch (e) {
    logError('Twitch Token', e);
    return null;
  }
}

async function checkTwitchStream(username, retries = 0) {
  const token = await getTwitchToken();
  if (!token) return null;
  
  try {
    const r = await axios.get('https://api.twitch.tv/helix/streams', {
      headers: { 
        'Client-ID': config.twitch.clientId, 
        'Authorization': `Bearer ${token}` 
      },
      params: { user_login: username.toLowerCase() },
      timeout: 10000,
    });
    
    if (!r.data.data.length) return null;
    
    const s = r.data.data[0];
    return {
      isLive: true,
      title: s.title || 'Sin título',
      game: s.game_name || 'Sin categoría',
      viewers: s.viewer_count || 0,
      thumbnailUrl: s.thumbnail_url?.replace('{width}', '1280').replace('{height}', '720') + `?t=${Date.now()}`,
      startedAt: new Date(s.started_at),
      streamUrl: `https://twitch.tv/${username}`,
      platform: 'twitch',
    };
  } catch (e) {
    if (retries < config.notifications.retryAttempts) {
      console.log(`🔄 Retry Twitch ${username} (${retries + 1}/${config.notifications.retryAttempts})`);
      await new Promise(r => setTimeout(r, config.notifications.retryDelay));
      return checkTwitchStream(username, retries + 1);
    }
    logError(`Twitch Check ${username}`, e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    KICK API — MÉTODO ROBUSTO
// ═══════════════════════════════════════════════════════════════════════════════

async function checkKickStream(username, retries = 0) {
  try {
    // Método 1: API oficial de Kick
    const r = await axios.get(`https://kick.com/api/v2/channels/${username}/livestream`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    
    if (!r.data?.data?.id && !r.data?.id) return null;
    
    const data = r.data.data || r.data;
    return {
      isLive: true,
      title: data.session_title || data.title || 'Sin título',
      game: data.categories?.[0]?.name || data.category?.name || 'Sin categoría',
      viewers: data.viewer_count || data.viewers_count || 0,
      thumbnailUrl: data.thumbnail?.url || data.thumbnail_url,
      startedAt: new Date(data.created_at || Date.now()),
      streamUrl: `https://kick.com/${username}`,
      platform: 'kick',
    };
  } catch (e) {
    if (retries < config.notifications.retryAttempts) {
      console.log(`🔄 Retry Kick ${username} (${retries + 1}/${config.notifications.retryAttempts})`);
      await new Promise(r => setTimeout(r, config.notifications.retryDelay));
      return checkKickStream(username, retries + 1);
    }
    // No loguear como error - Kick puede estar offline
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    TIKTOK LIVE — MÚLTIPLES MÉTODOS
// ═══════════════════════════════════════════════════════════════════════════════

// Método 1: Web scraping mejorado
async function checkTikTokLiveScraping(username, retries = 0) {
  const cleanUser = username.replace('@', '').trim();
  
  try {
    const r = await axios.get(`https://www.tiktok.com/@${cleanUser}/live`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      },
      maxRedirects: 5,
    });
    
    const html = r.data || '';
    
    // Múltiples indicadores de live
    const liveIndicators = [
      '"isLiving":true',
      '"liveStatus":1',
      '"status":2',
      '"roomStatus":2',
      '"living":true',
      '"is_live":true',
      '"liveRoomStatus":1',
      '"LiveRoom":{',
      '"live_id":"',
    ];
    
    const isLive = liveIndicators.some(indicator => html.includes(indicator));
    
    if (!isLive) return null;
    
    // Extraer datos
    let viewers = 0;
    const vMatch = html.match(/"user_count":(\d+)/) || 
                   html.match(/"viewerCount":(\d+)/) ||
                   html.match(/"viewer_count":(\d+)/) ||
                   html.match(/"live_viewer_count":(\d+)/);
    if (vMatch) viewers = parseInt(vMatch[1]) || 0;
    
    let title = `${cleanUser} está en vivo en TikTok!`;
    const tMatch = html.match(/"title":"([^"]{5,100})"/) ||
                   html.match(/"live_title":"([^"]{5,100})"/) ||
                   html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (tMatch) title = tMatch[1].replace(/\\u0026/g, '&').replace(/\\n/g, ' ');
    
    // Extraer thumbnail
    let thumbnailUrl = null;
    const thumbMatch = html.match(/"cover":"(https:[^"]+)"/) ||
                       html.match(/"thumbnail":"(https:[^"]+)"/);
    if (thumbMatch) thumbnailUrl = thumbMatch[1].replace(/\\u002F/g, '/');
    
    return {
      isLive: true,
      title,
      game: 'TikTok Live',
      viewers,
      thumbnailUrl,
      startedAt: new Date(),
      streamUrl: `https://www.tiktok.com/@${cleanUser}/live`,
      platform: 'tiktok',
    };
  } catch (e) {
    if (retries < config.notifications.retryAttempts) {
      console.log(`🔄 Retry TikTok ${username} (${retries + 1}/${config.notifications.retryAttempts})`);
      await new Promise(r => setTimeout(r, config.notifications.retryDelay * 2));
      return checkTikTokLiveScraping(username, retries + 1);
    }
    return null;
  }
}

// Método 2: API alternativa
async function checkTikTokLiveAPI(username) {
  const cleanUser = username.replace('@', '').trim();
  
  try {
    // Usar servicio de terceros o API alternativa
    const r = await axios.get(`https://www.tiktok.com/@${cleanUser}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const html = r.data || '';
    
    // Buscar datos del usuario en el HTML
    const dataMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>({.+?)<\/script>/);
    if (dataMatch) {
      const data = JSON.parse(dataMatch[1]);
      const userData = data['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo?.user;
      if (userData?.isLive) {
        return {
          isLive: true,
          title: `${cleanUser} está en vivo en TikTok!`,
          game: 'TikTok Live',
          viewers: 0,
          thumbnailUrl: null,
          startedAt: new Date(),
          streamUrl: `https://www.tiktok.com/@${cleanUser}/live`,
          platform: 'tiktok',
        };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function checkTikTokLive(username) {
  // Intentar múltiples métodos
  let result = await checkTikTokLiveScraping(username);
  if (!result) {
    result = await checkTikTokLiveAPI(username);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    YOUTUBE LIVE
// ═══════════════════════════════════════════════════════════════════════════════

async function checkYouTubeLive(channelHandle, retries = 0) {
  if (!config.youtube.apiKey) return null;
  
  try {
    const cleanHandle = channelHandle.replace('@', '').trim();
    
    // Buscar canal
    const searchR = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { 
        part: 'snippet', 
        q: cleanHandle, 
        type: 'channel', 
        key: config.youtube.apiKey, 
        maxResults: 1 
      },
      timeout: 10000,
    });
    
    if (!searchR.data.items?.length) return null;
    const channelId = searchR.data.items[0].id.channelId;
    
    // Buscar live
    const liveR = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { 
        part: 'snippet', 
        channelId, 
        eventType: 'live', 
        type: 'video', 
        key: config.youtube.apiKey, 
        maxResults: 1 
      },
      timeout: 10000,
    });
    
    if (!liveR.data.items?.length) return null;
    
    const live = liveR.data.items[0];
    return {
      isLive: true,
      title: live.snippet.title,
      game: 'YouTube Live',
      viewers: 0, // YouTube no da viewers en tiempo real vía API
      thumbnailUrl: live.snippet.thumbnails?.high?.url || live.snippet.thumbnails?.default?.url,
      startedAt: new Date(live.snippet.publishedAt),
      streamUrl: `https://youtube.com/watch?v=${live.id.videoId}`,
      platform: 'youtube',
    };
  } catch (e) {
    if (retries < config.notifications.retryAttempts) {
      console.log(`🔄 Retry YouTube ${channelHandle} (${retries + 1}/${config.notifications.retryAttempts})`);
      await new Promise(r => setTimeout(r, config.notifications.retryDelay));
      return checkYouTubeLive(channelHandle, retries + 1);
    }
    logError(`YouTube Check ${channelHandle}`, e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    SISTEMA ANTI-SPAM (COOLDOWN)
// ═══════════════════════════════════════════════════════════════════════════════

function canNotify(streamKey) {
  const lastNotified = storage.notifiedStreams.get(streamKey);
  if (!lastNotified) return true;
  
  const cooldownMs = config.notifications.cooldownMinutes * 60 * 1000;
  const timeSinceLastNotify = Date.now() - lastNotified;
  
  return timeSinceLastNotify >= cooldownMs;
}

function markNotified(streamKey) {
  storage.notifiedStreams.set(streamKey, Date.now());
  // Limpiar notificaciones antiguas (más de 24h)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [key, time] of storage.notifiedStreams.entries()) {
    if (time < cutoff) storage.notifiedStreams.delete(key);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    DETECCIÓN PRINCIPAL DE STREAMS
// ═══════════════════════════════════════════════════════════════════════════════

async function checkAllStreams() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Verificando streams...`);
  
  if (storage.streamers.size === 0) {
    console.log('⚠️ No hay streamers registrados');
    return;
  }
  
  let checked = 0;
  let liveFound = 0;
  
  for (const [userId, data] of storage.streamers.entries()) {
    try {
      const guild = client.guilds.cache.get(config.discord.guildId);
      if (!guild) continue;
      
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      
      const platforms = data.platforms || {};
      
      // Verificar cada plataforma
      const checks = [];
      
      if (config.notifications.enableTwitch && platforms.twitch) {
        checks.push(checkAndNotify('twitch', userId, platforms.twitch, member, data));
      }
      if (config.notifications.enableKick && platforms.kick) {
        checks.push(checkAndNotify('kick', userId, platforms.kick, member, data));
      }
      if (config.notifications.enableTikTok && platforms.tiktok) {
        checks.push(checkAndNotify('tiktok', userId, platforms.tiktok, member, data));
      }
      if (config.notifications.enableYouTube && platforms.youtube) {
        checks.push(checkAndNotify('youtube', userId, platforms.youtube, member, data));
      }
      
      const results = await Promise.allSettled(checks);
      checked += checks.length;
      liveFound += results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      
    } catch (error) {
      logError(`CheckStreams ${userId}`, error);
    }
  }
  
  console.log(`✅ Verificación completa: ${checked} checks, ${liveFound} streams en vivo detectados`);
  console.log(`📊 Streams activos: ${storage.liveStreams.size}`);
}

async function checkAndNotify(platform, userId, username, member, streamerData) {
  const streamKey = `${platform}-${userId}`;
  
  // Verificar si ya está en vivo (para no duplicar)
  if (storage.liveStreams.has(streamKey)) {
    // Verificar si sigue en vivo (actualizar datos)
    const streamData = await getStreamData(platform, username);
    
    if (streamData?.isLive) {
      // Actualizar viewers
      const existing = storage.liveStreams.get(streamKey);
      existing.currentViewers = streamData.viewers;
      if (streamData.viewers > (existing.peakViewers || 0)) {
        existing.peakViewers = streamData.viewers;
      }
      storage.liveStreams.set(streamKey, existing);
      return true; // Sigue en vivo
    } else {
      // Terminó el stream
      await handleStreamEnd(streamKey, userId);
      return false;
    }
  }
  
  // Verificar si hay nuevo stream
  const streamData = await getStreamData(platform, username);
  
  if (streamData?.isLive) {
    // Verificar cooldown (anti-spam)
    if (!canNotify(streamKey)) {
      console.log(`⏳ Cooldown activo para ${member.displayName} en ${platform}`);
      // Guardar como live pero sin notificar
      storage.liveStreams.set(streamKey, {
        startedAt: new Date().toISOString(),
        currentViewers: streamData.viewers,
        peakViewers: streamData.viewers,
        platform,
        title: streamData.title,
        silent: true, // No se notificó por cooldown
      });
      return true;
    }
    
    // ¡NUEVO STREAM! Enviar notificación
    console.log(`🔴 ${member.displayName} está EN VIVO en ${platform}!`);
    
    storage.liveStreams.set(streamKey, {
      startedAt: new Date().toISOString(),
      currentViewers: streamData.viewers,
      peakViewers: streamData.viewers,
      platform,
      title: streamData.title,
      silent: false,
    });
    
    // Enviar notificación
    await sendLiveNotification(platform, member, username, streamData, streamerData);
    markNotified(streamKey);
    
    // Actualizar stats
    const sd = storage.streamers.get(userId);
    if (sd) {
      sd.stats = sd.stats || {};
      sd.stats.totalStreams = (sd.stats.totalStreams || 0) + 1;
      sd.stats.lastStream = new Date().toISOString();
      storage.streamers.set(userId, sd);
    }
    
    await saveStorage();
    return true;
  }
  
  return false;
}

async function getStreamData(platform, username) {
  switch (platform) {
    case 'twitch': return await checkTwitchStream(username);
    case 'kick': return await checkKickStream(username);
    case 'tiktok': return await checkTikTokLive(username);
    case 'youtube': return await checkYouTubeLive(username);
    default: return null;
  }
}

async function handleStreamEnd(streamKey, userId) {
  const liveData = storage.liveStreams.get(streamKey);
  if (!liveData) return;
  
  const durationMs = Date.now() - new Date(liveData.startedAt).getTime();
  const durationHours = durationMs / 3600000;
  
  const sd = storage.streamers.get(userId);
  if (sd) {
    sd.stats = sd.stats || {};
    sd.stats.totalHours = (sd.stats.totalHours || 0) + durationHours;
    if ((liveData.peakViewers || 0) > (sd.stats.peakViewers || 0)) {
      sd.stats.peakViewers = liveData.peakViewers;
    }
    
    // Guardar en historial
    const hist = storage.streamHistory.get(userId) || [];
    hist.push({
      date: liveData.startedAt,
      duration: durationMs / 1000,
      platform: liveData.platform,
      peakViewers: liveData.peakViewers,
    });
    storage.streamHistory.set(userId, hist);
    storage.streamers.set(userId, sd);
    
    // Dar coins
    const coinsEarned = Math.floor(durationHours * config.economy.coinsPerHour);
    if (coinsEarned > 0) {
      addCoins(userId, coinsEarned, `Stream de ${durationHours.toFixed(1)}h en ${liveData.platform}`);
    }
  }
  
  storage.liveStreams.delete(streamKey);
  console.log(`⚫ Stream terminado: ${streamKey} (${durationHours.toFixed(1)}h)`);
  await saveStorage();
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    NOTIFICACIONES MEJORADAS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendLiveNotification(platform, member, username, streamData, streamerData) {
  try {
    const guild = client.guilds.cache.get(config.discord.guildId);
    const notifChannel = guild?.channels.cache.get(config.discord.notificationsChannelId);
    if (!notifChannel) {
      console.log('⚠️ Canal de notificaciones no configurado');
      return;
    }
    
    const platformConfig = {
      twitch: { emoji: '🟣', color: '#9146FF', name: 'Twitch' },
      kick: { emoji: '🟢', color: '#53FC18', name: 'Kick' },
      tiktok: { emoji: '⚫', color: '#FF0050', name: 'TikTok' },
      youtube: { emoji: '🔴', color: '#FF0000', name: 'YouTube' },
    };
    
    const plat = platformConfig[platform];
    
    // Embed principal mejorado
    const embed = new EmbedBuilder()
      .setColor(plat.color)
      .setAuthor({ 
        name: `${member.displayName} está en vivo!`, 
        iconURL: member.user.displayAvatarURL({ forceStatic: false }) 
      })
      .setTitle(`🔴 ${streamData.title || 'Sin título'}`)
      .setURL(streamData.streamUrl)
      .setDescription(`${plat.emoji} **${plat.name}** • ${streamData.game || 'Sin categoría'}`)
      .addFields(
        { 
          name: '👥 Espectadores', 
          value: formatNumber(streamData.viewers || 0), 
          inline: true 
        },
        { 
          name: '⏰ Comenzó', 
          value: `<t:${Math.floor(Date.now() / 1000)}:R>`, 
          inline: true 
        },
      )
      .setFooter({ 
        text: `${plat.name} • @${username} • El Patio RP`, 
        iconURL: platform === 'twitch' ? 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png' : undefined
      })
      .setTimestamp();
    
    // Thumbnail con cache-busting
    if (streamData.thumbnailUrl) {
      embed.setImage(streamData.thumbnailUrl + (streamData.thumbnailUrl.includes('?') ? '&' : '?') + `t=${Date.now()}`);
    }
    
    // Botones
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(`Ver en ${plat.name}`)
        .setStyle(ButtonStyle.Link)
        .setURL(streamData.streamUrl)
        .setEmoji(plat.emoji)
    );
    
    // Mensaje de notificación con mención
    const mentionText = config.discord.streamerRoleId ? 
      `<@&${config.discord.streamerRoleId}> **${member.displayName}** está en vivo!` :
      `🔴 **${member.displayName}** está en vivo en **${plat.name}**!`;
    
    // Enviar al canal de notificaciones
    const notifMsg = await notifChannel.send({
      content: mentionText,
      embeds: [embed],
      components: [buttons],
    });
    
    // Actualizar hilo del streamer si existe
    const threadId = storage.threads.get(member.id);
    if (threadId) {
      try {
        const thread = await guild.channels.fetch(threadId);
        if (thread) {
          await thread.send({
            content: `🔴 ¡Estoy en vivo ahora!`,
            embeds: [embed],
          });
        }
      } catch (e) {
        // Hilo puede estar archivado
      }
    }
    
    console.log(`✅ Notificación enviada: ${member.displayName} en ${plat.name}`);
    
  } catch (error) {
    logError('SendLiveNotification', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    FORO DE STREAMERS
// ═══════════════════════════════════════════════════════════════════════════════

async function createStreamerThread(member, platforms, bio, color) {
  const guild = client.guilds.cache.get(config.discord.guildId);
  const forumChannel = guild?.channels.cache.get(config.discord.forumChannelId);
  
  if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
    throw new Error('Canal de foro no configurado correctamente');
  }
  
  const streamerColor = color || '#9146FF';
  
  const embed = new EmbedBuilder()
    .setColor(streamerColor)
    .setTitle(`🎮 ${member.displayName}`)
    .setThumbnail(member.user.displayAvatarURL({ forceStatic: false, size: 256 }))
    .setDescription(bio || '*Sin biografía*');
  
  let platformsText = '';
  if (platforms?.twitch) platformsText += `🟣 **Twitch:** [${platforms.twitch}](https://twitch.tv/${platforms.twitch})\n`;
  if (platforms?.kick) platformsText += `🟢 **Kick:** [${platforms.kick}](https://kick.com/${platforms.kick})\n`;
  if (platforms?.youtube) platformsText += `🔴 **YouTube:** [${platforms.youtube}](https://youtube.com/${platforms.youtube})\n`;
  if (platforms?.tiktok) platformsText += `⚫ **TikTok:** [@${platforms.tiktok}](https://tiktok.com/@${platforms.tiktok})\n`;
  
  if (platformsText) {
    embed.addFields({ name: '📺 Plataformas', value: platformsText });
  }
  
  embed.addFields(
    { name: '👤 Miembro desde', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
    { name: '📊 Streams', value: '0', inline: true },
    { name: '⏱️ Horas', value: '0h', inline: true }
  );
  
  embed.setFooter({ text: `ID: ${member.id}` }).setTimestamp();
  
  const thread = await forumChannel.threads.create({
    name: `🎮 ${member.displayName}`,
    message: { embeds: [embed] },
    reason: 'Nuevo streamer registrado',
  });
  
  storage.threads.set(member.id, thread.id);
  storage.streamers.set(member.id, {
    platforms: platforms || {},
    bio: bio || '',
    threadId: thread.id,
    createdAt: Date.now(),
    color: streamerColor,
    stats: { totalStreams: 0, totalHours: 0, avgViewers: 0, peakViewers: 0, viralClips: 0, lastStream: null },
  });
  
  // Dar rol de streamer
  if (config.discord.streamerRoleId && !member.roles.cache.has(config.discord.streamerRoleId)) {
    await member.roles.add(config.discord.streamerRoleId).catch(() => {});
  }
  
  return thread;
}

// ═══════════════════════════════════════════════════════════════════════════════
//                    COMANDOS SLASH
// ═══════════════════════════════════════════════════════════════════════════════

const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Verifica la latencia del bot'),
  
  new SlashCommandBuilder()
    .setName('registrar-streamer')
    .setDescription('Registra tus plataformas de streaming')
    .addStringOption(o => o.setName('twitch').setDescription('Usuario de Twitch').setRequired(false))
    .addStringOption(o => o.setName('kick').setDescription('Usuario de Kick').setRequired(false))
    .addStringOption(o => o.setName('youtube').setDescription('Canal de YouTube (@usuario)').setRequired(false))
    .addStringOption(o => o.setName('tiktok').setDescription('Usuario de TikTok (@usuario)').setRequired(false))
    .addStringOption(o => o.setName('biografia').setDescription('Breve descripción sobre ti').setRequired(false))
    .addStringOption(o => o.setName('color').setDescription('Color en hex (ej: #FF5500)').setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('mi-hilo')
    .setDescription('Ver tu hilo en el foro'),
  
  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Estadísticas del servidor o un usuario')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a consultar').setRequired(false)),
  
  new SlashCommandBuilder()
    .setName('live')
    .setDescription('Ver streams en vivo ahora'),
  
  new SlashCommandBuilder()
    .setName('check-stream')
    .setDescription('Forzar verificación de streams (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  new SlashCommandBuilder()
    .setName('config-cooldown')
    .setDescription('Configurar cooldown de notificaciones (Admin)')
    .addIntegerOption(o => o.setName('minutos').setDescription('Minutos de cooldown').setRequired(true).setMinValue(5).setMaxValue(120))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

// ═══════════════════════════════════════════════════════════════════════════════
//                    EVENTOS
// ═══════════════════════════════════════════════════════════════════════════════

client.once('clientReady', async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔥 EL PATIO BOT STREAM v7.0 — ULTRA NOTIFIER 🔥       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`✅ Bot conectado: ${client.user.tag}`);
  console.log(`📡 Guild: ${config.discord.guildId}`);
  
  await loadStorage();
  
  // Registrar comandos
  try {
    const { REST } = require('@discordjs/rest');
    const { Routes } = require('discord-api-types/v10');
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log(`✅ ${commands.length} comandos registrados`);
  } catch (e) {
    console.error('❌ Error registrando comandos:', e.message);
  }
  
  // Iniciar verificación de streams
  console.log(`🔴 Verificación cada ${config.notifications.checkInterval / 1000}s`);
  console.log(`⏳ Cooldown: ${config.notifications.cooldownMinutes} minutos`);
  
  // Primera verificación inmediata
  await checkAllStreams();
  
  // Loop de verificación
  setInterval(checkAllStreams, config.notifications.checkInterval);
  
  // Auto-save cada 5 minutos
  setInterval(saveStorage, 300000);
  
  console.log('════════════════════════════════════════════════════════════');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  const { commandName } = interaction;
  
  try {
    // ─── PING ───
    if (commandName === 'ping') {
      const latency = client.ws.ping;
      const embed = new EmbedBuilder()
        .setColor(latency < 100 ? '#00FF00' : latency < 200 ? '#FFFF00' : '#FF0000')
        .setTitle('🏓 Pong!')
        .setDescription(`Latencia: **${latency}ms**`)
        .addFields(
          { name: '📡 WebSocket', value: `${latency}ms`, inline: true },
          { name: '⏱️ Uptime', value: `${Math.floor(process.uptime() / 60)}m`, inline: true },
          { name: '👥 Streamers', value: `${storage.streamers.size}`, inline: true },
        );
      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    
    // ─── REGISTRAR STREAMER ───
    else if (commandName === 'registrar-streamer') {
      if (config.discord.streamerRoleId && !interaction.member.roles.cache.has(config.discord.streamerRoleId)) {
        return await interaction.reply({ 
          content: '❌ Necesitas el rol de Streamer para registrarte.\nPide a un administrador que te lo asigne.',
          flags: MessageFlags.Ephemeral 
        });
      }
      
      if (storage.threads.has(interaction.user.id)) {
        const threadId = storage.threads.get(interaction.user.id);
        return await interaction.reply({ 
          content: `⚠️ Ya estás registrado. Tu hilo: <#${threadId}>\n\nUsa "/mi-hilo" para verlo.`,
          flags: MessageFlags.Ephemeral 
        });
      }
      
      const platforms = {
        twitch: interaction.options.getString('twitch')?.toLowerCase() || null,
        kick: interaction.options.getString('kick') || null,
        youtube: interaction.options.getString('youtube') || null,
        tiktok: (interaction.options.getString('tiktok') || '').replace('@', '') || null,
      };
      
      const bio = interaction.options.getString('biografia') || '';
      const color = interaction.options.getString('color') || '#9146FF';
      
      if (!platforms.twitch && !platforms.kick && !platforms.youtube && !platforms.tiktok) {
        return await interaction.reply({ 
          content: '❌ Debes agregar al menos una plataforma (Twitch, Kick, YouTube o TikTok).',
          flags: MessageFlags.Ephemeral 
        });
      }
      
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      try {
        const thread = await createStreamerThread(interaction.member, platforms, bio, color);
        await saveStorage();
        
        const platList = Object.entries(platforms)
          .filter(([, v]) => v)
          .map(([p]) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(', ');
        
        await interaction.editReply({ 
          content: `✅ ¡Registrado exitosamente!\n\n📌 Tu hilo: <#${thread.id}>\n📺 Plataformas: ${platList}\n\n🔔 Recibirás notificaciones automáticas cuando entres en vivo.` 
        });
      } catch (e) {
        await interaction.editReply({ content: `❌ Error: ${e.message}` });
      }
    }
    
    // ─── MI HILO ───
    else if (commandName === 'mi-hilo') {
      const threadId = storage.threads.get(interaction.user.id);
      if (!threadId) {
        return await interaction.reply({ 
          content: '❌ No tienes un hilo registrado.\nUsa `/registrar-streamer` para crear uno.',
          flags: MessageFlags.Ephemeral 
        });
      }
      await interaction.reply({ 
        content: `📌 Tu hilo: <#${threadId}>`,
        flags: MessageFlags.Ephemeral 
      });
    }
    
    // ─── STATS ───
    else if (commandName === 'stats') {
      const targetUser = interaction.options.getUser('usuario');
      
      if (targetUser) {
        const data = storage.streamers.get(targetUser.id);
        if (!data) {
          return await interaction.reply({ 
            content: '❌ Este usuario no está registrado como streamer.',
            flags: MessageFlags.Ephemeral 
          });
        }
        
        const stats = data.stats || {};
        const embed = new EmbedBuilder()
          .setColor(data.color || '#9146FF')
          .setTitle(`📊 Stats de ${targetUser.username}`)
          .setThumbnail(targetUser.displayAvatarURL({ forceStatic: false }))
          .addFields(
            { name: '📺 Streams', value: (stats.totalStreams || 0).toString(), inline: true },
            { name: '⏱️ Horas', value: `${(stats.totalHours || 0).toFixed(1)}h`, inline: true },
            { name: '🔥 Peak Viewers', value: formatNumber(stats.peakViewers || 0), inline: true },
            { name: '🪙 Coins', value: getCoins(targetUser.id).toString(), inline: true },
          );
        
        if (stats.lastStream) {
          embed.addFields({ 
            name: '🕐 Último Stream', 
            value: `<t:${Math.floor(new Date(stats.lastStream).getTime() / 1000)}:R>`,
            inline: true 
          });
        }
        
        return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }
      
      // Stats del servidor
      let totalHours = 0, totalStreams = 0;
      for (const [, d] of storage.streamers.entries()) {
        totalHours += d.stats?.totalHours || 0;
        totalStreams += d.stats?.totalStreams || 0;
      }
      
      const embed = new EmbedBuilder()
        .setColor('#9146FF')
        .setTitle('📊 Estadísticas del Servidor')
        .addFields(
          { name: '🎮 Streamers', value: storage.streamers.size.toString(), inline: true },
          { name: '🔴 En Vivo', value: storage.liveStreams.size.toString(), inline: true },
          { name: '📝 Hilos', value: storage.threads.size.toString(), inline: true },
          { name: '📺 Streams Totales', value: totalStreams.toString(), inline: true },
          { name: '⏱️ Horas Totales', value: `${totalHours.toFixed(1)}h`, inline: true },
          { name: '📡 Latencia', value: `${client.ws.ping}ms`, inline: true },
        )
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    
    // ─── LIVE ───
    else if (commandName === 'live') {
      await interaction.deferReply();
      
      if (storage.liveStreams.size === 0) {
        return await interaction.editReply({ 
          content: '😴 No hay streams en vivo ahora mismo.\n\nEl bot verifica cada minuto automáticamente.' 
        });
      }
      
      const guild = client.guilds.cache.get(config.discord.guildId);
      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle(`🔴 Streams en Vivo (${storage.liveStreams.size})`)
        .setDescription('Streamers transmitiendo ahora mismo:');
      
      for (const [key, data] of storage.liveStreams.entries()) {
        const firstDash = key.indexOf('-');
        const userId = key.substring(firstDash + 1);
        const member = await guild.members.fetch(userId).catch(() => null);
        const name = member?.displayName || userId;
        
        const platformEmojis = {
          twitch: '🟣',
          kick: '🟢',
          tiktok: '⚫',
          youtube: '🔴',
        };
        
        embed.addFields({
          name: `${platformEmojis[data.platform] || '🔴'} ${name}`,
          value: `👥 ${formatNumber(data.currentViewers)} viewers • ⏰ <t:${Math.floor(new Date(data.startedAt).getTime() / 1000)}:R>`,
          inline: false,
        });
      }
      
      await interaction.editReply({ embeds: [embed] });
    }
    
    // ─── CHECK STREAM (Admin) ───
    else if (commandName === 'check-stream') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      
      console.log('🔍 Verificación manual iniciada por:', interaction.user.tag);
      await checkAllStreams();
      
      await interaction.editReply({ 
        content: `✅ Verificación completada.\n📊 Streams activos: ${storage.liveStreams.size}` 
      });
    }
    
    // ─── CONFIG COOLDOWN (Admin) ───
    else if (commandName === 'config-cooldown') {
      const minutos = interaction.options.getInteger('minutos');
      config.notifications.cooldownMinutes = minutos;
      
      await interaction.reply({ 
        content: `✅ Cooldown configurado a **${minutos} minutos**.\n\nLas notificaciones del mismo streamer tendrán este tiempo de espera.`,
        flags: MessageFlags.Ephemeral 
      });
    }
    
  } catch (error) {
    logError(`Command ${commandName}`, error);
    
    const msg = { 
      content: '❌ Error ejecutando el comando. Intenta de nuevo.',
      flags: MessageFlags.Ephemeral 
    };
    
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// DM automático al dar rol de streamer
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    const hadRole = oldMember.roles.cache.has(config.discord.streamerRoleId);
    const hasRole = newMember.roles.cache.has(config.discord.streamerRoleId);
    
    if (!hadRole && hasRole && !storage.threads.has(newMember.id)) {
      await newMember.send({
        content: `🎉 ¡Felicidades! Ahora eres **Streamer** en **${newMember.guild.name}**!\n\n` +
          `📋 Para registrarte y que el bot detecte tus streams, usa el comando:\n` +
          `\`/registrar-streamer\`\n\n` +
          `🔔 El bot detectará automáticamente cuando estés en vivo en:\n` +
          `• Twitch 🟣\n` +
          `• Kick 🟢\n` +
          `• TikTok ⚫\n` +
          `• YouTube 🔴\n\n` +
          `⚡ ¡Buena suerte con tus streams!`,
      }).catch(() => {
        // Usuario puede tener DMs cerrados
      });
    }
  } catch {}
});

// ═══════════════════════════════════════════════════════════════════════════════
//                    SERVIDOR WEB + DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

const webApp = express();
webApp.use(express.json());

// CORS
webApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Admin key
const ADMIN_KEY = process.env.DASHBOARD_ADMIN_KEY || 'elpatio-admin-2026';

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'No autorizado' });
  next();
}

// Logs en memoria
const webLogs = [];
const _origLog = console.log;
const _origErr = console.error;

console.log = (...args) => {
  const msg = args.join(' ');
  webLogs.push({ type: 'info', msg, time: new Date().toISOString() });
  if (webLogs.length > 200) webLogs.shift();
  _origLog(...args);
};

console.error = (...args) => {
  const msg = args.join(' ');
  webLogs.push({ type: 'error', msg, time: new Date().toISOString() });
  if (webLogs.length > 200) webLogs.shift();
  _origErr(...args);
};

// Endpoints
// Dashboard HTML
webApp.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

webApp.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

webApp.get("/api/status", (req, res) => {
  let totalHours = 0, totalStreams = 0;
  for (const [, d] of storage.streamers.entries()) {
    totalHours += d.stats?.totalHours || 0;
    totalStreams += d.stats?.totalStreams || 0;
  }
  
  res.json({
    status: 'online',
    bot: client.user?.tag || 'Conectando...',
    version: '7.0-NEKOTINA',
    uptime: process.uptime(),
    stats: {
      streamers: storage.streamers.size,
      threads: storage.threads.size,
      liveStreams: storage.liveStreams.size,
      totalHours: totalHours.toFixed(2),
      totalStreams,
    },
    config: {
      checkInterval: config.notifications.checkInterval,
      cooldownMinutes: config.notifications.cooldownMinutes,
      enableTwitch: config.notifications.enableTwitch,
      enableKick: config.notifications.enableKick,
      enableTikTok: config.notifications.enableTikTok,
      enableYouTube: config.notifications.enableYouTube,
    },
    ping: client.ws.ping,
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
  });
});

webApp.get('/health', (_, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

webApp.get('/live', (req, res) => {
  const live = [];
  for (const [key, data] of storage.liveStreams.entries()) {
    const [platform, ...userIdParts] = key.split('-');
    const userId = userIdParts.join('-');
    const streamerData = storage.streamers.get(userId);
    live.push({
      key,
      platform,
      userId,
      ...data,
      platforms: streamerData?.platforms || {},
    });
  }
  res.json(live);
});

webApp.get('/streamers', (req, res) => {
  const data = {};
  for (const [uid, d] of storage.streamers.entries()) {
    data[uid] = {
      platforms: d.platforms || {},
      bio: d.bio || '',
      color: d.color || '#9146FF',
      threadId: d.threadId,
      createdAt: d.createdAt,
      stats: d.stats || {},
    };
  }
  res.json(data);
});

webApp.get('/admin/logs', requireAdmin, (req, res) => {
  res.json({ logs: webLogs.slice(-100) });
});

webApp.post('/admin/check-streams', requireAdmin, async (req, res) => {
  try {
    await checkAllStreams();
    res.json({ ok: true, message: 'Verificación ejecutada', liveCount: storage.liveStreams.size });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Buscar miembro en Discord por nombre/tag/id
webApp.get('/admin/find-member', requireAdmin, async (req, res) => {
  try {
    const query = req.query.q?.toLowerCase().trim();
    if (!query) return res.status(400).json({ error: 'Falta parámetro q' });

    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) return res.status(500).json({ error: 'Guild no encontrado' });

    await guild.members.fetch();
    const members = guild.members.cache.filter(m =>
      m.user.username.toLowerCase().includes(query) ||
      m.displayName.toLowerCase().includes(query) ||
      m.id === query
    );

    const results = members.map(m => ({
      id: m.id,
      username: m.user.username,
      displayName: m.displayName,
      avatar: m.user.displayAvatarURL({ size: 64 }),
      hasStreamerRole: config.discord.streamerRoleId ? m.roles.cache.has(config.discord.streamerRoleId) : false,
      isRegistered: storage.streamers.has(m.id),
    })).slice(0, 10);

    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Registrar streamer desde el dashboard
webApp.post('/admin/register-streamer', requireAdmin, async (req, res) => {
  try {
    const { userId, platforms, bio, color } = req.body;
    if (!userId) return res.status(400).json({ error: 'Falta userId' });

    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) return res.status(500).json({ error: 'Guild no encontrado' });

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Miembro no encontrado en el servidor' });

    if (storage.threads.has(userId)) {
      return res.status(409).json({ error: 'Este usuario ya está registrado', threadId: storage.threads.get(userId) });
    }

    const cleanPlatforms = {
      twitch: platforms?.twitch?.toLowerCase().trim() || null,
      kick: platforms?.kick?.trim() || null,
      youtube: platforms?.youtube?.trim() || null,
      tiktok: platforms?.tiktok?.replace('@', '').trim() || null,
    };

    // Filtrar plataformas vacías
    Object.keys(cleanPlatforms).forEach(k => { if (!cleanPlatforms[k]) delete cleanPlatforms[k]; });

    if (Object.keys(cleanPlatforms).length === 0) {
      return res.status(400).json({ error: 'Debes agregar al menos una plataforma' });
    }

    const thread = await createStreamerThread(member, cleanPlatforms, bio || '', color || '#9146FF');
    await saveStorage();

    console.log(`✅ Streamer registrado desde dashboard: ${member.displayName}`);
    res.json({ ok: true, threadId: thread.id, displayName: member.displayName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar streamer desde el dashboard
webApp.delete('/admin/streamer/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!storage.streamers.has(userId)) return res.status(404).json({ error: 'Streamer no encontrado' });

    storage.streamers.delete(userId);
    storage.threads.delete(userId);
    storage.liveStreams.forEach((_, key) => { if (key.includes(userId)) storage.liveStreams.delete(key); });
    await saveStorage();

    console.log(`🗑️ Streamer eliminado desde dashboard: ${userId}`);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Iniciar servidor
webApp.listen(config.port, () => {
  console.log(`🚀 Web server en puerto ${config.port}`);
  console.log(`📊 Dashboard: http://localhost:${config.port}/`);
});

// ═══════════════════════════════════════════════════════════════════════════════
//                    INICIAR BOT
// ═══════════════════════════════════════════════════════════════════════════════

client.login(config.discord.token).catch(e => {
  console.error('❌ Error al iniciar el bot:', e.message);
  process.exit(1);
});
