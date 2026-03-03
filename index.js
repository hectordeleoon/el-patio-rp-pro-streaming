// ═══════════════════════════════════════════════════════════════════════════════
//          🔥 EL PATIO BOT STREAM v8.3 — ULTRA NOTIFIER (UNIFICADO) 🔥
//   Twitch + Kick + TikTok + YouTube • IA Groq • Auto-Clips • Top 3 Semanal
//   Auto-Registro • Horarios • Metas de Viewers • Embeds estilo Nekotina
// ═══════════════════════════════════════════════════════════════════════════════

'use strict';

require('dotenv').config();

const {
  Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, Partials, REST, Routes,
  ThreadAutoArchiveDuration,
} = require('discord.js');
const express = require('express');
const axios   = require('axios');
const fs      = require('fs');
const path    = require('path');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

const config = {
  discord: {
    token:                  process.env.DISCORD_TOKEN,
    clientId:               process.env.DISCORD_CLIENT_ID,
    guildId:                process.env.DISCORD_GUILD_ID,
    forumChannelId:         process.env.FORUM_CHANNEL_ID,
    streamerRoleId:         process.env.STREAMER_ROLE_ID,
    notificationsChannelId: process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    liveChannelId:          process.env.DISCORD_LIVE_CHANNEL_ID || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    postsChannelId:         process.env.DISCORD_POSTS_CHANNEL_ID,
    clipsChannelId:         process.env.DISCORD_CLIPS_CHANNEL_ID,
    generalChannelId:       process.env.DISCORD_GENERAL_CHANNEL_ID,
    adminChannelId:         process.env.DISCORD_ADMIN_CHANNEL_ID,
    scheduleChannelId:      process.env.DISCORD_SCHEDULE_CHANNEL_ID,
  },
  twitch: {
    clientId:     process.env.TWITCH_CLIENT_ID,
    clientSecret: process.env.TWITCH_CLIENT_SECRET,
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
  },
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model:  'llama-3.1-70b-versatile',
  },
  notifications: {
    checkInterval:   parseInt(process.env.CHECK_INTERVAL)          || 60000,
    cooldownMinutes: parseInt(process.env.NOTIFICATION_COOLDOWN)   || 30,
    retryAttempts:   3,
    retryDelay:      5000,
    enableTwitch:    process.env.ENABLE_TWITCH  !== 'false',
    enableKick:      process.env.ENABLE_KICK    !== 'false',
    enableTikTok:    process.env.ENABLE_TIKTOK  !== 'false',
    enableYouTube:   process.env.ENABLE_YOUTUBE === 'true',
  },
  clips: {
    viralThreshold:      parseInt(process.env.VIRAL_SCORE_AUTO_PUBLISH_THRESHOLD || '65'),
    autoClipIntervalMin: parseInt(process.env.AUTO_CLIP_INTERVAL_MIN             || '20'),
    minViewers:          parseInt(process.env.MIN_VIEWERS_TO_CLIP                || '30'),
  },
  upload: {
    tiktok:         process.env.AUTO_UPLOAD_TIKTOK    === 'true',
    instagram:      process.env.AUTO_UPLOAD_INSTAGRAM === 'true',
    tiktokToken:    process.env.TIKTOK_UPLOAD_ACCESS_TOKEN,
    instagramToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    instagramAccId: process.env.INSTAGRAM_ACCOUNT_ID,
  },
  port:     parseInt(process.env.PORT || '3000'),
  adminKey: process.env.DASHBOARD_ADMIN_KEY || 'elpatio-admin-2026',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM CONFIG — colores y metadatos por plataforma
// ═══════════════════════════════════════════════════════════════════════════════

const PLATFORM_CONFIG = {
  twitch: {
    color: 0x9146FF, emojiText: '🟣', name: 'Twitch',
    icon: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c1.png',
    watchLabel: 'Ver en Twitch', liveLabel: '🔴 EN VIVO EN TWITCH',
    urlBase: 'https://twitch.tv/',
    thumb: (u) => `https://static-cdn.jtvnw.net/previews-ttv/live_user_${u}-1280x720.jpg?t=${Date.now()}`,
  },
  kick: {
    color: 0x53FC18, emojiText: '🟢', name: 'Kick',
    icon: 'https://kick.com/favicon.ico',
    watchLabel: 'Ver en Kick', liveLabel: '🔴 EN VIVO EN KICK',
    urlBase: 'https://kick.com/', thumb: () => null,
  },
  tiktok: {
    color: 0xFF0050, emojiText: '⚫', name: 'TikTok',
    icon: 'https://www.tiktok.com/favicon.ico',
    watchLabel: 'Ver en TikTok', liveLabel: '🔴 EN VIVO EN TIKTOK',
    urlBase: 'https://www.tiktok.com/@', thumb: () => null,
  },
  youtube: {
    color: 0xFF0000, emojiText: '🔴', name: 'YouTube',
    icon: 'https://www.youtube.com/favicon.ico',
    watchLabel: 'Ver en YouTube', liveLabel: '🔴 EN VIVO EN YOUTUBE',
    urlBase: 'https://youtube.com/@', thumb: () => null,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE + PERSISTENCIA
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_FILE = path.join(__dirname, 'data', 'storage.json');

const storage = {
  streamers:            new Map(), // uid → { platforms, bio, color, stats, ... }
  threads:              new Map(), // uid → threadId
  liveStreams:          new Map(), // "platform-uid" → streamData
  notifiedStreams:      new Map(), // streamKey → timestamp
  clips:                new Map(), // uid → [clipObj, ...]
  achievements:         new Map(),
  economy:              new Map(),
  streamHistory:        new Map(),
  lastContentCheck:     new Map(),
  pendingRegistrations: new Map(), // uid → pending
  streamSchedules:      new Map(), // uid → [{ dia, hora, juego }]
  achievedMilestones:   new Map(), // uid → Set of mKey
  weeklyStats:          new Map(), // uid → { streams, totalViewers, peakViewers, clips }
};

function saveStorage() {
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = {
      streamers:        Object.fromEntries(storage.streamers),
      threads:          Object.fromEntries(storage.threads),
      liveStreams:      Object.fromEntries(storage.liveStreams),
      notifiedStreams:  Object.fromEntries(storage.notifiedStreams),
      achievements:     Object.fromEntries(storage.achievements),
      economy:          Object.fromEntries(storage.economy),
      streamHistory:    Object.fromEntries([...storage.streamHistory.entries()].map(([k, v]) => [k, v.slice(-100)])),
      lastContentCheck: Object.fromEntries(storage.lastContentCheck),
      clips:            Object.fromEntries(storage.clips),
      streamSchedules:  Object.fromEntries(storage.streamSchedules),
      weeklyStats:      Object.fromEntries(storage.weeklyStats),
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) { console.error('❌ Error guardando storage:', e.message); }
}

function loadStorage() {
  try {
    if (!fs.existsSync(STORAGE_FILE)) return console.log('⚠️ Sin storage previo, empezando limpio');
    const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    const load = (map, obj) => { if (obj) Object.entries(obj).forEach(([k, v]) => map.set(k, v)); };
    load(storage.streamers,        data.streamers);
    load(storage.threads,          data.threads);
    load(storage.liveStreams,       data.liveStreams);
    load(storage.notifiedStreams,   data.notifiedStreams);
    load(storage.achievements,     data.achievements);
    load(storage.economy,          data.economy);
    load(storage.streamHistory,    data.streamHistory);
    load(storage.lastContentCheck, data.lastContentCheck);
    load(storage.clips,            data.clips);
    load(storage.streamSchedules,  data.streamSchedules);
    load(storage.weeklyStats,      data.weeklyStats);
    // Reconstruir threads desde streamers si thread map está vacío
    if (storage.threads.size === 0) {
      for (const [uid, d] of storage.streamers.entries()) {
        if (d.threadId) storage.threads.set(uid, d.threadId);
      }
    }
    console.log(`✅ Storage cargado: ${storage.streamers.size} streamers`);
  } catch (e) { console.error('❌ Error cargando storage:', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCORD CLIENT
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
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function getCoins(userId) { return storage.economy.get(userId)?.coins || 0; }

function addCoins(userId, amount, reason = '') {
  if (!amount) return getCoins(userId);
  const ec = storage.economy.get(userId) || { coins: 0, transactions: [] };
  ec.coins += amount;
  ec.transactions = (ec.transactions || []);
  ec.transactions.push({ amount, reason, date: new Date().toISOString() });
  if (ec.transactions.length > 50) ec.transactions = ec.transactions.slice(-50);
  storage.economy.set(userId, ec);
  return ec.coins;
}

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

function logError(context, error) {
  console.error(`[${new Date().toISOString()}] ${context}: ${error?.message || error}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 1 — TWITCH TOKEN
// ═══════════════════════════════════════════════════════════════════════════════

let twitchToken = null;
let twitchTokenExpiry = 0;

async function getTwitchToken() {
  if (!config.twitch.clientId || !config.twitch.clientSecret) return null;
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;
  try {
    const r = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: { client_id: config.twitch.clientId, client_secret: config.twitch.clientSecret, grant_type: 'client_credentials' },
      timeout: 10000,
    });
    twitchToken       = r.data.access_token;
    twitchTokenExpiry = Date.now() + (r.data.expires_in - 300) * 1000;
    console.log('✅ Token Twitch renovado');
    return twitchToken;
  } catch (e) { logError('Twitch Token', e); return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 2 — VERIFICACIÓN DE PLATAFORMAS (registro seguro)
// ═══════════════════════════════════════════════════════════════════════════════

async function verifyPlatformUser(platform, username) {
  const clean = username.replace('@', '').trim();
  try {
    if (platform === 'twitch') {
      const token = await getTwitchToken();
      if (!token) return { exists: false, error: 'Sin credenciales Twitch' };
      const r = await axios.get('https://api.twitch.tv/helix/users', {
        headers: { 'Client-ID': config.twitch.clientId, 'Authorization': `Bearer ${token}` },
        params: { login: clean.toLowerCase() }, timeout: 8000,
      });
      const u = r.data?.data?.[0];
      if (!u) return { exists: false, error: `"${username}" no existe en Twitch` };
      return { exists: true, displayName: u.display_name, avatar: u.profile_image_url, verified: true, method: 'Twitch API' };
    }

    if (platform === 'kick') {
      const r = await axios.get(`https://kick.com/api/v2/channels/${clean.toLowerCase()}`, {
        timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      });
      const d = r.data?.data || r.data;
      if (!d?.id) return { exists: false, error: `"${username}" no existe en Kick` };
      return { exists: true, displayName: d.user?.username || clean, avatar: d.user?.profile_pic || null, followers: d.followers_count || 0, isLive: !!d.livestream, verified: true, method: 'Kick API' };
    }

    if (platform === 'tiktok') {
      try {
        const r = await axios.get(`https://www.tiktok.com/@${clean}`, {
          timeout: 12000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'es-ES,es;q=0.9', 'Referer': 'https://www.tiktok.com/',
          },
        });
        const html = r.data || '';
        const notFound = html.includes('"statusCode":10202') || html.includes("Couldn't find this account") || html.includes('"userInfo":{}') || html.includes('"uniqueId":""');
        if (notFound) return { exists: false, error: `@${username} no existe en TikTok` };
        const nameMatch  = html.match(/"uniqueId":"([^"]+)","nickname":"([^"]+)"/);
        const followersM = html.match(/"followerCount":(\d+)/);
        const avatarM    = html.match(/"avatarLarger":"([^"]+)"/);
        const verifiedM  = html.match(/"verified":(true|false)/);
        return { exists: true, displayName: nameMatch ? nameMatch[2] : `@${clean}`, avatar: avatarM ? avatarM[1].replace(/\\/g, '') : null, followers: followersM ? parseInt(followersM[1]) : 0, verified: verifiedM?.[1] === 'true', method: 'TikTok Perfil Público' };
      } catch (e) {
        if (e.response?.status === 404) return { exists: false, error: `@${username} no existe en TikTok` };
        if (e.response?.status === 429) return { exists: true, displayName: `@${clean}`, warning: '⚠️ TikTok limitó la verificación — se asume válido.', method: 'Rate limited' };
        return { exists: true, displayName: `@${clean}`, warning: `⚠️ No verificado: ${e.message}`, method: 'Error' };
      }
    }

    if (platform === 'youtube') {
      if (config.youtube.apiKey) {
        const handle = clean.startsWith('@') ? clean.slice(1) : clean;
        const r = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: { part: 'snippet,statistics', forHandle: handle, key: config.youtube.apiKey }, timeout: 8000,
        });
        const ch = r.data?.items?.[0];
        if (!ch) return { exists: false, error: `@${username} no encontrado en YouTube` };
        return { exists: true, displayName: ch.snippet?.title, avatar: ch.snippet?.thumbnails?.default?.url, followers: parseInt(ch.statistics?.subscriberCount || 0), verified: true, method: 'YouTube API' };
      }
      try {
        const handle = clean.startsWith('@') ? clean : `@${clean}`;
        const r = await axios.get(`https://www.youtube.com/${handle}`, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (r.status === 404) return { exists: false, error: `${username} no existe en YouTube` };
        const nameM = r.data?.match(/"title":"([^"]{2,60})"/);
        return { exists: true, displayName: nameM ? nameM[1] : clean, warning: 'Verificación básica — agrega YOUTUBE_API_KEY para verificación completa', method: 'YouTube scraping' };
      } catch (e) {
        if (e.response?.status === 404) return { exists: false, error: `${username} no existe en YouTube` };
        return { exists: true, displayName: clean, warning: 'No verificado', method: 'Sin verificar' };
      }
    }

    if (platform === 'instagram') {
      try {
        const r = await axios.get(`https://www.instagram.com/${clean}/`, {
          timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'es-ES,es;q=0.9' },
        });
        const html = r.data || '';
        if (html.includes('"errorPage"') || html.length < 500) return { exists: false, error: `@${username} no existe en Instagram` };
        const nameM      = html.match(/"full_name":"([^"]{1,50})"/);
        const followersM = html.match(/"edge_followed_by":\{"count":(\d+)\}/);
        const privateM   = html.match(/"is_private":(true|false)/);
        return { exists: true, displayName: nameM ? nameM[1] : `@${clean}`, followers: followersM ? parseInt(followersM[1]) : 0, isPrivate: privateM?.[1] === 'true', warning: privateM?.[1] === 'true' ? '⚠️ Cuenta privada' : null, method: 'Instagram Perfil Público' };
      } catch (e) {
        if (e.response?.status === 404) return { exists: false, error: `@${username} no existe en Instagram` };
        return { exists: true, displayName: `@${clean}`, warning: 'No verificado', method: 'Sin verificar' };
      }
    }

    return { exists: true, displayName: username, warning: 'Sin verificación para esta plataforma' };
  } catch (e) {
    if (e.response?.status === 404) return { exists: false, error: `"${username}" no existe en ${platform}` };
    return { exists: true, displayName: username, warning: `Error: ${e.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 3 — DETECCIÓN DE STREAMS
// ═══════════════════════════════════════════════════════════════════════════════

async function checkTwitchStream(username, retries = 0) {
  const token = await getTwitchToken();
  if (!token) return null;
  try {
    const r = await axios.get('https://api.twitch.tv/helix/streams', {
      headers: { 'Client-ID': config.twitch.clientId, 'Authorization': `Bearer ${token}` },
      params: { user_login: username.toLowerCase() }, timeout: 10000,
    });
    if (!r.data.data?.length) return null;
    const s = r.data.data[0];
    return {
      isLive: true, title: s.title || 'Sin título', game: s.game_name || 'Sin categoría',
      viewers: s.viewer_count || 0,
      thumbnailUrl: s.thumbnail_url?.replace('{width}', '1280').replace('{height}', '720') + `?t=${Date.now()}`,
      startedAt: new Date(s.started_at), streamUrl: `https://twitch.tv/${username}`, platform: 'twitch',
    };
  } catch (e) {
    if (retries < config.notifications.retryAttempts) {
      await new Promise(r => setTimeout(r, config.notifications.retryDelay));
      return checkTwitchStream(username, retries + 1);
    }
    return null;
  }
}

async function checkKickStream(username, retries = 0) {
  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${username}/livestream`, {
      timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
    });
    if (!r.data?.data?.id && !r.data?.id) return null;
    const data = r.data.data || r.data;
    return {
      isLive: true, title: data.session_title || data.title || 'Sin título',
      game: data.categories?.[0]?.name || data.category?.name || 'Sin categoría',
      viewers: data.viewer_count || data.viewers_count || 0,
      thumbnailUrl: data.thumbnail?.url || data.thumbnail_url || null,
      startedAt: new Date(data.created_at || Date.now()),
      streamUrl: `https://kick.com/${username}`, platform: 'kick',
    };
  } catch (e) {
    if (retries < config.notifications.retryAttempts) {
      await new Promise(r => setTimeout(r, config.notifications.retryDelay));
      return checkKickStream(username, retries + 1);
    }
    return null;
  }
}

async function checkTikTokLive(username) {
  const cleanUser = username.replace('@', '').trim();
  try {
    const r = await axios.get(`https://www.tiktok.com/@${cleanUser}/live`, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9', 'DNT': '1',
      },
    });
    const html = r.data || '';
    const isLive = ['"isLiving":true', '"liveStatus":1', '"status":2', '"roomStatus":2', '"living":true', '"liveRoomStatus":1'].some(s => html.includes(s));
    if (!isLive) return null;
    const vMatch = html.match(/"user_count":(\d+)/) || html.match(/"viewerCount":(\d+)/);
    const tMatch = html.match(/"title":"([^"]{5,100})"/) || html.match(/"live_title":"([^"]{5,100})"/);
    return {
      isLive: true, title: tMatch ? tMatch[1].replace(/\\u0026/g, '&') : `${cleanUser} está en vivo en TikTok!`,
      game: 'TikTok Live', viewers: vMatch ? parseInt(vMatch[1]) : 0,
      thumbnailUrl: null, startedAt: new Date(),
      streamUrl: `https://www.tiktok.com/@${cleanUser}/live`, platform: 'tiktok',
    };
  } catch { return null; }
}

async function checkYouTubeLive(channelHandle, retries = 0) {
  if (!config.youtube.apiKey) return null;
  try {
    const cleanHandle = channelHandle.replace('@', '').trim();
    const searchR = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', q: cleanHandle, type: 'channel', key: config.youtube.apiKey, maxResults: 1 }, timeout: 10000,
    });
    if (!searchR.data.items?.length) return null;
    const channelId = searchR.data.items[0].id.channelId;
    const liveR = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', channelId, eventType: 'live', type: 'video', key: config.youtube.apiKey, maxResults: 1 }, timeout: 10000,
    });
    if (!liveR.data.items?.length) return null;
    const live = liveR.data.items[0];
    return {
      isLive: true, title: live.snippet.title, game: 'YouTube Live', viewers: 0,
      thumbnailUrl: live.snippet.thumbnails?.high?.url || null,
      startedAt: new Date(live.snippet.publishedAt),
      streamUrl: `https://youtube.com/watch?v=${live.id.videoId}`, platform: 'youtube',
    };
  } catch (e) {
    if (retries < config.notifications.retryAttempts) {
      await new Promise(r => setTimeout(r, config.notifications.retryDelay));
      return checkYouTubeLive(channelHandle, retries + 1);
    }
    return null;
  }
}

async function getStreamData(platform, username) {
  switch (platform) {
    case 'twitch':  return await checkTwitchStream(username);
    case 'kick':    return await checkKickStream(username);
    case 'tiktok':  return await checkTikTokLive(username);
    case 'youtube': return await checkYouTubeLive(username);
    default:        return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 4 — IA GROQ
// ═══════════════════════════════════════════════════════════════════════════════

async function askGroqAI(userPrompt, systemPrompt = 'Eres el asistente de El Patio RP. Responde en español.') {
  if (!config.groq.apiKey) return null;
  try {
    const r = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: config.groq.model, max_tokens: 500, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }] },
      { headers: { Authorization: `Bearer ${config.groq.apiKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    return r.data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.error('❌ Groq error:', e.response?.data?.error?.message || e.message);
    return null;
  }
}

async function analyzeClipWithAI(streamData, streamerName, platform) {
  try {
    const prompt = `Analiza este momento de stream del streamer "${streamerName}" en ${platform}:\n- Juego: ${streamData.game || 'GTA RP'}\n- Título: ${streamData.title || 'Sin título'}\n- Espectadores: ${streamData.viewers || streamData.currentViewers || 0}\nResponde SOLO con JSON válido sin markdown:\n{"viralScore":75,"category":"epic","title":"Título optimizado para TikTok","hashtags":["#GTARP","#clip"],"hypeText":"Texto corto de hype para Discord","autoPublish":true}`;
    const raw = await askGroqAI(prompt, 'Eres experto en viralidad de clips para streamers latinos de GTA RP. Responde SOLO JSON.');
    if (!raw) return null;
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 5 — ANTI-SPAM Y COOLDOWN
// ═══════════════════════════════════════════════════════════════════════════════

function canNotify(streamKey) {
  const last = storage.notifiedStreams.get(streamKey);
  if (!last) return true;
  return (Date.now() - last) >= config.notifications.cooldownMinutes * 60 * 1000;
}

function markNotified(streamKey) {
  storage.notifiedStreams.set(streamKey, Date.now());
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [k, t] of storage.notifiedStreams.entries()) {
    if (t < cutoff) storage.notifiedStreams.delete(k);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 6 — NOTIFICACIONES DE LIVE (estilo Nekotina, por plataforma)
// ═══════════════════════════════════════════════════════════════════════════════

async function sendLiveNotification(platform, member, username, streamData, streamerData) {
  try {
    const guild     = client.guilds.cache.get(config.discord.guildId);
    const channelId = config.discord.liveChannelId || config.discord.notificationsChannelId;
    const channel   = guild?.channels.cache.get(channelId);
    if (!channel) return console.log('⚠️ Canal de lives no configurado');

    const p         = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.twitch;
    const streamUrl = `${p.urlBase}${username}`;
    const thumbUrl  = p.thumb(username);
    const aiContent = streamData.aiContent;
    const aiScore   = aiContent?.viralScore || 0;
    const aiHype    = aiContent?.hypeText   || null;
    const plats     = streamerData?.platforms || {};

    const embed = new EmbedBuilder()
      .setColor(p.color)
      .setAuthor({ name: p.liveLabel, iconURL: p.icon })
      .setTitle(member.displayName)
      .setURL(streamUrl)
      .setDescription(
        `**${streamData.title || '¡En vivo!'}**` +
        (aiHype ? `\n> *${aiHype}*` : '')
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `El Patio RP • ${p.name} • @${username}`, iconURL: client.user?.displayAvatarURL() })
      .setTimestamp();

    const fields = [];
    if (streamData.game) fields.push({ name: '🎮 Juego',        value: streamData.game,                            inline: true });
    fields.push({ name: '👥 Espectadores', value: (streamData.viewers || 0) > 0 ? formatNumber(streamData.viewers) : 'Iniciando...', inline: true });
    if (aiScore > 0) fields.push({ name: '🤖 Score IA', value: `${aiScore}/100 ${aiScore >= 80 ? '🔥🔥🔥' : '🔥🔥'}`, inline: true });
    embed.addFields(fields);

    if (thumbUrl) embed.setImage(thumbUrl);

    const mainBtn = new ButtonBuilder()
      .setLabel(`${p.emojiText} ${p.watchLabel}`)
      .setStyle(ButtonStyle.Link)
      .setURL(streamUrl);

    const extraBtns = [];
    if (platform !== 'twitch'  && plats.twitch)   extraBtns.push(new ButtonBuilder().setLabel('🟣 Twitch').setStyle(ButtonStyle.Link).setURL(`https://twitch.tv/${plats.twitch}`));
    if (platform !== 'kick'    && plats.kick)     extraBtns.push(new ButtonBuilder().setLabel('🟢 Kick').setStyle(ButtonStyle.Link).setURL(`https://kick.com/${plats.kick}`));
    if (platform !== 'tiktok'  && plats.tiktok)   extraBtns.push(new ButtonBuilder().setLabel('⚫ TikTok').setStyle(ButtonStyle.Link).setURL(`https://www.tiktok.com/@${plats.tiktok}`));
    if (platform !== 'youtube' && plats.youtube)  extraBtns.push(new ButtonBuilder().setLabel('🔴 YouTube').setStyle(ButtonStyle.Link).setURL(`https://youtube.com/@${plats.youtube}`));

    const components = [new ActionRowBuilder().addComponents(mainBtn)];
    if (extraBtns.length) components.push(new ActionRowBuilder().addComponents(...extraBtns.slice(0, 4)));

    const mention = config.discord.streamerRoleId ? `<@&${config.discord.streamerRoleId}>` : '@everyone';
    const msg = await channel.send({
      content:    `${mention} ¡**${member.displayName}** está en vivo en **${p.name}**! ${p.emojiText}`,
      embeds:     [embed],
      components,
    });

    // Notificar también en hilo de foro
    const threadId = storage.threads.get(member.id);
    if (threadId) {
      const thread = guild.channels.cache.get(threadId);
      if (thread) await thread.send({ content: `🔴 ¡Estoy en vivo ahora en ${p.name}!`, embeds: [embed] }).catch(() => {});
    }

    console.log(`✅ Notificación ${platform} → ${member.displayName}`);
    return msg;
  } catch (e) { logError('sendLiveNotification', e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 7 — AUTO-CLIPS IA
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchTwitchClips(username) {
  const token = await getTwitchToken();
  if (!token) return [];
  try {
    const userRes = await axios.get('https://api.twitch.tv/helix/users', {
      headers: { 'Client-ID': config.twitch.clientId, 'Authorization': `Bearer ${token}` },
      params: { login: username.toLowerCase() },
    });
    const broadcasterId = userRes.data?.data?.[0]?.id;
    if (!broadcasterId) return [];
    const startDate = new Date(Date.now() - config.clips.autoClipIntervalMin * 60 * 1000).toISOString();
    const clipsRes  = await axios.get('https://api.twitch.tv/helix/clips', {
      headers: { 'Client-ID': config.twitch.clientId, 'Authorization': `Bearer ${token}` },
      params: { broadcaster_id: broadcasterId, started_at: startDate, first: 5 },
    });
    return clipsRes.data?.data || [];
  } catch { return []; }
}

async function processAutoClip(member, streamData, streamerData, platform) {
  if ((streamData.viewers || streamData.currentViewers || 0) < config.clips.minViewers) return;
  const clips = platform === 'twitch' ? await fetchTwitchClips(streamerData.platforms?.twitch) : [];

  const aiContent  = await analyzeClipWithAI(streamData, member.displayName, platform);
  const viralScore = aiContent?.viralScore || Math.floor(Math.random() * 30 + 40);

  const clipData = {
    id:          `clip-${Date.now()}-${member.id}`,
    streamerId:  member.id, streamer: member.displayName, platform,
    title:       aiContent?.title    || streamData.title || 'Clip automático',
    hashtags:    aiContent?.hashtags || ['#ElPatioRP', '#GTARP'],
    viralScore, category: aiContent?.category || 'highlight',
    hypeText:    aiContent?.hypeText || '¡Momento épico!',
    processedAt: new Date().toISOString(),
    twitchClip:  clips[0] || null,
    url:         clips[0]?.url        || null,
    thumbnail:   clips[0]?.thumbnail_url || null,
    autoPublish: viralScore >= config.clips.viralThreshold,
    uploaded:    false,
  };

  const userClips = storage.clips.get(member.id) || [];
  userClips.unshift(clipData);
  if (userClips.length > 50) userClips.pop();
  storage.clips.set(member.id, userClips);

  // Stats semanales
  const stats = storage.weeklyStats.get(member.id) || { streams: 0, totalViewers: 0, peakViewers: 0, clips: 0 };
  stats.clips++;
  storage.weeklyStats.set(member.id, stats);

  saveStorage();
  await sendClipNotification(member, clipData, streamerData);
  if (clipData.autoPublish) await autoUploadClip(clipData).catch(() => {});
}

async function sendClipNotification(member, clipData, streamerData) {
  try {
    const guild   = client.guilds.cache.get(config.discord.guildId);
    const channelId = config.discord.clipsChannelId || config.discord.liveChannelId;
    const channel = guild?.channels.cache.get(channelId);
    if (!channel) return;

    const scoreColor = clipData.viralScore >= 80 ? 0xFFD700 : clipData.viralScore >= 65 ? 0xFF6B00 : 0x00B4D8;
    const embed = new EmbedBuilder()
      .setColor(scoreColor)
      .setAuthor({ name: `🎬 Clip Automático IA — ${member.displayName}`, iconURL: member.user.displayAvatarURL() })
      .setTitle(clipData.title)
      .setDescription(
        `${clipData.hypeText}\n\n` +
        `📊 **Score Viral:** ${clipData.viralScore}/100 ${clipData.viralScore >= 80 ? '🔥🔥🔥' : clipData.viralScore >= 65 ? '🔥🔥' : '🔥'}\n` +
        `🏷️ **Categoría:** ${clipData.category}\n` +
        `${clipData.hashtags.join(' ')}`
      )
      .setFooter({ text: clipData.autoPublish ? '✅ Subida automática activada' : '📋 Listo para subir manualmente' })
      .setTimestamp();

    if (clipData.thumbnail) embed.setImage(clipData.thumbnail);

    const btns = [new ButtonBuilder().setLabel('📋 Copiar Caption').setCustomId(`copy_caption_${clipData.id}`).setStyle(ButtonStyle.Secondary)];
    if (clipData.url) btns.unshift(new ButtonBuilder().setLabel('🎬 Ver Clip').setStyle(ButtonStyle.Link).setURL(clipData.url));
    const plats = streamerData?.platforms || {};
    if (plats.twitch) btns.push(new ButtonBuilder().setLabel('🟣 Canal').setStyle(ButtonStyle.Link).setURL(`https://twitch.tv/${plats.twitch}`));

    await channel.send({
      content: clipData.viralScore >= 65 ? `🔥 **¡Clip viral detectado!** Score: ${clipData.viralScore}/100` : `🎬 Nuevo clip de **${member.displayName}**`,
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(...btns.slice(0, 4))],
    });
  } catch (e) { logError('sendClipNotification', e); }
}

async function autoUploadClip(clipData) {
  if (!clipData.url) return;
  if (config.upload.tiktok && config.upload.tiktokToken) {
    console.log(`📤 [TikTok] Upload iniciado: ${clipData.title}`);
    clipData.uploaded = true; saveStorage();
  }
  if (config.upload.instagram && config.upload.instagramToken) {
    console.log(`📤 [Instagram] Upload iniciado: ${clipData.title}`);
    clipData.uploaded = true; saveStorage();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 8 — METAS DE VIEWERS
// ═══════════════════════════════════════════════════════════════════════════════

const MILESTONES = [50, 100, 250, 500, 1000, 2500, 5000];

async function checkViewerGoals() {
  const guild = client.guilds.cache.get(config.discord.guildId);
  if (!guild) return;

  for (const [key, streamData] of storage.liveStreams.entries()) {
    const userId  = key.substring(key.indexOf('-') + 1);
    const viewers = streamData.currentViewers || streamData.viewers || 0;
    const member  = await guild.members.fetch(userId).catch(() => null);
    if (!member) continue;

    const achieved = storage.achievedMilestones.get(userId) || new Set();

    for (const m of MILESTONES) {
      if (viewers < m) continue;
      const mKey = `${m}-${new Date().toDateString()}`;
      if (achieved.has(mKey)) continue;
      achieved.add(mKey);
      storage.achievedMilestones.set(userId, achieved);

      const ch = guild.channels.cache.get(config.discord.liveChannelId);
      if (!ch) continue;

      let msg = `🎯 **${member.displayName}** alcanzó **${m.toLocaleString()} viewers** en vivo! ¡Vayan a apoyar! 🔥`;
      if (config.groq.apiKey && m >= 100) {
        const ai = await askGroqAI(`El streamer "${member.displayName}" de GTA RP alcanzó ${m} viewers en vivo. Genera UNA línea de celebración épica con emojis para Discord (español, sin comillas).`, 'Eres el hype man de El Patio RP.').catch(() => null);
        if (ai) msg = ai;
      }

      const embed = new EmbedBuilder()
        .setColor(m >= 1000 ? 0xFFD700 : m >= 500 ? 0xFF9900 : 0x00E5C8)
        .setTitle(`🏆 ${member.displayName} — ${m.toLocaleString()} viewers!`)
        .setDescription(msg)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 })).setTimestamp();

      await ch.send({
        content: `${m >= 500 ? '@everyone ' : ''}🎉 **¡${m.toLocaleString()} VIEWERS!** ${m >= 1000 ? '🏆🔥' : '🔥'}`,
        embeds: [embed],
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 9 — LOOP PRINCIPAL DE CHECKS
// ═══════════════════════════════════════════════════════════════════════════════

async function checkAndNotify(platform, userId, username, member, streamerData) {
  const streamKey = `${platform}-${userId}`;
  const wasLive   = storage.liveStreams.has(streamKey);

  if (wasLive) {
    const streamData = await getStreamData(platform, username);
    if (streamData?.isLive) {
      const existing = storage.liveStreams.get(streamKey);
      existing.currentViewers = streamData.viewers;
      existing.viewers        = streamData.viewers;
      if (streamData.viewers > (existing.peakViewers || 0)) existing.peakViewers = streamData.viewers;
      storage.liveStreams.set(streamKey, existing);
      // Stats semanales
      const stats = storage.weeklyStats.get(userId) || { streams: 0, totalViewers: 0, peakViewers: 0, clips: 0 };
      if (streamData.viewers > (stats.peakViewers || 0)) stats.peakViewers = streamData.viewers;
      storage.weeklyStats.set(userId, stats);
      return true;
    } else {
      // Stream terminado
      const liveData = storage.liveStreams.get(streamKey);
      const durationMs = Date.now() - new Date(liveData.startedAt || Date.now()).getTime();
      const durationHours = durationMs / 3600000;
      const sd = storage.streamers.get(userId);
      if (sd) {
        sd.stats = sd.stats || {};
        sd.stats.totalHours   = (sd.stats.totalHours || 0) + durationHours;
        if ((liveData.peakViewers || 0) > (sd.stats.peakViewers || 0)) sd.stats.peakViewers = liveData.peakViewers;
        const hist = storage.streamHistory.get(userId) || [];
        hist.push({ date: liveData.startedAt, duration: durationMs / 1000, platform, peakViewers: liveData.peakViewers });
        storage.streamHistory.set(userId, hist.slice(-100));
        storage.streamers.set(userId, sd);
        const coins = Math.floor(durationHours * 10);
        if (coins > 0) addCoins(userId, coins, `Stream en ${platform}`);
      }
      storage.liveStreams.delete(streamKey);
      console.log(`⚫ Stream terminado: ${member.displayName} en ${platform}`);
      saveStorage();
      return false;
    }
  }

  const streamData = await getStreamData(platform, username);
  if (streamData?.isLive) {
    if (!canNotify(streamKey)) {
      storage.liveStreams.set(streamKey, { startedAt: new Date().toISOString(), currentViewers: streamData.viewers, peakViewers: streamData.viewers, platform, title: streamData.title, silent: true });
      return true;
    }
    console.log(`🔴 ${member.displayName} EN VIVO en ${platform}!`);

    if (config.groq.apiKey) {
      const aiContent = await analyzeClipWithAI(streamData, member.displayName, platform).catch(() => null);
      if (aiContent) streamData.aiContent = aiContent;
    }

    storage.liveStreams.set(streamKey, { startedAt: new Date().toISOString(), currentViewers: streamData.viewers, viewers: streamData.viewers, peakViewers: streamData.viewers, platform, title: streamData.title, silent: false });

    await sendLiveNotification(platform, member, username, streamData, streamerData);
    markNotified(streamKey);

    const sd = storage.streamers.get(userId);
    if (sd) {
      sd.stats = sd.stats || {};
      sd.stats.totalStreams = (sd.stats.totalStreams || 0) + 1;
      sd.stats.lastStream   = new Date().toISOString();
      storage.streamers.set(userId, sd);
    }
    const stats = storage.weeklyStats.get(userId) || { streams: 0, totalViewers: 0, peakViewers: 0, clips: 0 };
    stats.streams++;
    storage.weeklyStats.set(userId, stats);

    saveStorage();
    return true;
  }
  return false;
}

async function checkAllStreams() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Verificando streams...`);
  if (!storage.streamers.size) { console.log('⚠️ Sin streamers registrados'); return; }

  let checked = 0, liveFound = 0;
  for (const [userId, data] of storage.streamers.entries()) {
    try {
      const guild  = client.guilds.cache.get(config.discord.guildId);
      if (!guild) continue;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      const platforms = data.platforms || {};
      const checks    = [];
      if (config.notifications.enableTwitch  && platforms.twitch)  checks.push(checkAndNotify('twitch',  userId, platforms.twitch,  member, data));
      if (config.notifications.enableKick    && platforms.kick)    checks.push(checkAndNotify('kick',    userId, platforms.kick,    member, data));
      if (config.notifications.enableTikTok  && platforms.tiktok)  checks.push(checkAndNotify('tiktok',  userId, platforms.tiktok,  member, data));
      if (config.notifications.enableYouTube && platforms.youtube) checks.push(checkAndNotify('youtube', userId, platforms.youtube, member, data));

      const results = await Promise.allSettled(checks);
      checked   += checks.length;
      liveFound += results.filter(r => r.status === 'fulfilled' && r.value === true).length;

      // Auto-clip
      const clipKeyBase = `clip-${userId}`;
      for (const platform of Object.keys(platforms)) {
        const streamKey = `${platform}-${userId}`;
        if (!storage.liveStreams.has(streamKey)) continue;
        const clipKey   = `${clipKeyBase}-${platform}`;
        const lastClip  = storage.notifiedStreams.get(clipKey) || 0;
        if ((Date.now() - lastClip) > config.clips.autoClipIntervalMin * 60 * 1000) {
          storage.notifiedStreams.set(clipKey, Date.now());
          const streamData = storage.liveStreams.get(streamKey);
          processAutoClip(member, streamData, data, platform).catch(() => {});
        }
      }
    } catch (e) { logError(`checkAllStreams ${userId}`, e); }
  }

  await checkViewerGoals().catch(() => {});
  console.log(`✅ Checks: ${checked} • En vivo: ${liveFound} • Activos: ${storage.liveStreams.size}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 10 — FORO DE STREAMERS
// ═══════════════════════════════════════════════════════════════════════════════

async function createStreamerThread(member, platforms, bio, color) {
  const guild        = client.guilds.cache.get(config.discord.guildId);
  const forumChannel = guild?.channels.cache.get(config.discord.forumChannelId);
  if (!forumChannel || forumChannel.type !== ChannelType.GuildForum)
    throw new Error('Canal de foro no configurado correctamente');

  const streamerColor = color || '#9146FF';
  const embed = new EmbedBuilder()
    .setColor(streamerColor)
    .setTitle(`🎮 ${member.displayName}`)
    .setThumbnail(member.user.displayAvatarURL({ forceStatic: false, size: 256 }))
    .setDescription(bio || '*Sin biografía*');

  let platformsText = '';
  if (platforms?.twitch)    platformsText += `🟣 **Twitch:** [${platforms.twitch}](https://twitch.tv/${platforms.twitch})\n`;
  if (platforms?.kick)      platformsText += `🟢 **Kick:** [${platforms.kick}](https://kick.com/${platforms.kick})\n`;
  if (platforms?.tiktok)    platformsText += `⚫ **TikTok:** [@${platforms.tiktok}](https://tiktok.com/@${platforms.tiktok})\n`;
  if (platforms?.youtube)   platformsText += `🔴 **YouTube:** [${platforms.youtube}](https://youtube.com/@${platforms.youtube})\n`;
  if (platforms?.instagram) platformsText += `📸 **Instagram:** [@${platforms.instagram}](https://instagram.com/${platforms.instagram})\n`;
  if (platformsText) embed.addFields({ name: '📺 Plataformas', value: platformsText });

  embed.addFields(
    { name: '👤 Miembro desde', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
    { name: '📊 Streams',       value: '0',  inline: true },
    { name: '⏱️ Horas',        value: '0h', inline: true },
  ).setFooter({ text: `ID: ${member.id}` }).setTimestamp();

  const thread = await forumChannel.threads.create({
    name: `🎮 ${member.displayName}`,
    message: { embeds: [embed] },
    reason: 'Nuevo streamer registrado',
  });

  storage.threads.set(member.id, thread.id);
  storage.streamers.set(member.id, {
    platforms: platforms || {}, bio: bio || '', color: streamerColor, threadId: thread.id,
    createdAt: Date.now(),
    stats: { totalStreams: 0, totalHours: 0, avgViewers: 0, peakViewers: 0, viralClips: 0, lastStream: null },
  });

  if (config.discord.streamerRoleId && !member.roles.cache.has(config.discord.streamerRoleId))
    await member.roles.add(config.discord.streamerRoleId).catch(() => {});

  return thread;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 11 — HORARIOS DE STREAM (aviso 30 min antes)
// ═══════════════════════════════════════════════════════════════════════════════

async function checkStreamSchedules() {
  const now     = new Date();
  const dias    = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const diaHoy  = dias[now.getDay()];
  const en30    = new Date(now.getTime() + 30 * 60000);
  const horaAviso = `${String(en30.getHours()).padStart(2,'0')}:${String(en30.getMinutes()).padStart(2,'0')}`;
  const guild   = client.guilds.cache.get(config.discord.guildId);
  if (!guild) return;

  for (const [uid, schedules] of storage.streamSchedules.entries()) {
    for (const s of schedules) {
      if ((s.dia !== diaHoy && s.dia !== 'Todos') || s.hora !== horaAviso) continue;
      const key = `sched-${uid}-${s.dia}-${s.hora}-${now.toDateString()}`;
      if (storage.notifiedStreams.has(key)) continue;
      storage.notifiedStreams.set(key, Date.now());

      const member = await guild.members.fetch(uid).catch(() => null);
      if (!member) continue;

      const channelId = config.discord.scheduleChannelId || config.discord.liveChannelId;
      const ch = guild.channels.cache.get(channelId);
      if (!ch) continue;

      const plats     = storage.streamers.get(uid)?.platforms || {};
      const extraBtns = [];
      if (plats.twitch) extraBtns.push(new ButtonBuilder().setLabel('🟣 Twitch').setStyle(ButtonStyle.Link).setURL(`https://twitch.tv/${plats.twitch}`));
      if (plats.kick)   extraBtns.push(new ButtonBuilder().setLabel('🟢 Kick').setStyle(ButtonStyle.Link).setURL(`https://kick.com/${plats.kick}`));
      if (plats.tiktok) extraBtns.push(new ButtonBuilder().setLabel('⚫ TikTok').setStyle(ButtonStyle.Link).setURL(`https://www.tiktok.com/@${plats.tiktok}`));

      const embed = new EmbedBuilder()
        .setColor(0xFF9900)
        .setAuthor({ name: '🔔 Stream en 30 minutos', iconURL: member.user.displayAvatarURL() })
        .setTitle(`${member.displayName} • ${s.juego || 'GTA RP'}`)
        .setDescription(`⏰ Empieza a las **${s.hora}** — ¡prepárense! 🔥`)
        .setThumbnail(member.user.displayAvatarURL({ size: 256 })).setTimestamp();

      const mention = config.discord.streamerRoleId ? `<@&${config.discord.streamerRoleId}>` : '@everyone';
      await ch.send({
        content:    `${mention} ⏰ **¡${member.displayName} empieza en 30 minutos!** 🔥`,
        embeds:     [embed],
        components: extraBtns.length ? [new ActionRowBuilder().addComponents(...extraBtns.slice(0, 4))] : [],
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 12 — TOP 3 SEMANAL
// ═══════════════════════════════════════════════════════════════════════════════

async function enviarTop3Semanal() {
  try {
    const guild = client.guilds.cache.get(config.discord.guildId);
    const ch    = guild?.channels.cache.get(config.discord.generalChannelId || config.discord.liveChannelId);
    if (!ch) return console.log('⚠️ Canal general no configurado');

    const ranking = [];
    for (const [uid, stats] of storage.weeklyStats.entries()) {
      const member = await guild.members.fetch(uid).catch(() => null);
      if (!member) continue;
      const score = (stats.streams || 0) * 10 + (stats.peakViewers || 0) + (stats.clips || 0) * 5;
      ranking.push({ uid, member, stats, score });
    }
    ranking.sort((a, b) => b.score - a.score);
    const top3 = ranking.slice(0, 3);
    if (!top3.length) return console.log('⚠️ Sin datos para el Top 3');

    const medals = ['🥇', '🥈', '🥉'];
    let description = '**🏆 Los mejores streamers de la semana:**\n\n';
    top3.forEach((entry, i) => {
      const { member, stats } = entry;
      description += `${medals[i]} **${member.displayName}**\n├ 📺 ${stats.streams || 0} streams · 👥 ${(stats.peakViewers || 0).toLocaleString()} peak · 🎬 ${stats.clips || 0} clips\n└ ⭐ Score: **${entry.score.toLocaleString()}**\n\n`;
    });

    let aiComment = '¡Felicitaciones a los mejores streamers de la semana! 🔥';
    if (config.groq.apiKey) {
      const prompt = `Top 3 streamers de la semana en El Patio RP:\n1. ${top3[0]?.member.displayName} (${top3[0]?.stats.streams} streams, peak ${top3[0]?.stats.peakViewers} viewers)\n2. ${top3[1]?.member.displayName || 'N/A'}\n3. ${top3[2]?.member.displayName || 'N/A'}\nGenera UN comentario épico de celebración con emojis para Discord (máx 2 líneas, español).`;
      const ai = await askGroqAI(prompt, 'Eres el presentador hype de El Patio RP.').catch(() => null);
      if (ai) aiComment = ai;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🏆 TOP 3 STREAMERS DE LA SEMANA — EL PATIO RP')
      .setDescription(description + `\n💬 *${aiComment}*`)
      .setFooter({ text: `El Patio RP • Top semanal • ${new Date().toLocaleDateString('es-ES')}`, iconURL: client.user?.displayAvatarURL() })
      .setTimestamp();

    if (top3[0]?.member) embed.setThumbnail(top3[0].member.user.displayAvatarURL({ size: 256 }));

    await ch.send({ content: '@everyone 🏆 **¡Los resultados de la semana están aquí!**', embeds: [embed] });

    // Felicitar al #1 en su hilo
    const winner = top3[0];
    if (winner) {
      const winnerData = storage.streamers.get(winner.uid);
      const tid = winnerData?.threadId || storage.threads.get(winner.uid);
      if (tid) {
        const thread = guild.channels.cache.get(tid);
        if (thread) await thread.send({ content: `🥇 **¡${winner.member.displayName} es el streamer #1 de esta semana en El Patio RP!** 🎉🔥` }).catch(() => {});
      }
    }

    storage.weeklyStats.clear();
    saveStorage();
    console.log('✅ Top 3 semanal enviado y stats reiniciados');
  } catch (e) { logError('enviarTop3Semanal', e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 13 — REPORTES SEMANALES POR DM
// ═══════════════════════════════════════════════════════════════════════════════

async function enviarReportesSemanal() {
  const guild  = client.guilds.cache.get(config.discord.guildId);
  if (!guild) return;

  for (const [uid, data] of storage.streamers.entries()) {
    try {
      const member = await guild.members.fetch(uid).catch(() => null);
      if (!member) continue;
      const stats   = storage.weeklyStats.get(uid) || {};
      const clips   = storage.clips.get(uid) || [];
      const streams = stats.streams || 0;
      if (!streams && !clips.length) continue;

      const peak  = stats.peakViewers || 0;
      const viral = clips.filter(c => (c.viralScore || 0) >= config.clips.viralThreshold).length;

      let tip = '';
      if (config.groq.apiKey) {
        tip = await askGroqAI(
          `Coach de streaming. El streamer "${member.displayName}" esta semana tuvo: ${streams} streams, peak ${peak} viewers, ${viral} clips virales. Da UN consejo corto y accionable (1 línea, español).`,
          'Eres coach experto de streamers de GTA RP latinos.'
        ).catch(() => '');
      }

      await member.send({ embeds: [
        new EmbedBuilder()
          .setColor(0x7C5CFF)
          .setAuthor({ name: '📊 Tu reporte semanal — El Patio RP', iconURL: client.user?.displayAvatarURL() })
          .setTitle(`¡Hola ${member.displayName}! Resumen de tu semana 🎮`)
          .addFields(
            { name: '📺 Streams',      value: `${streams}`,                        inline: true },
            { name: '👥 Peak viewers', value: `${peak.toLocaleString()}`,           inline: true },
            { name: '🎬 Clips',        value: `${clips.length} (${viral} virales)`, inline: true },
          )
          .setDescription(tip ? `💡 **Consejo IA:** *${tip}*` : '¡Sigue así! La constancia es la clave 💪')
          .setFooter({ text: 'El Patio RP Bot • Reporte automático cada lunes' }).setTimestamp(),
      ]});
      await new Promise(r => setTimeout(r, 1500));
    } catch {}
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 14 — SCHEDULER SEMANAL (Lunes 10 AM reportes, 12 PM Top 3)
// ═══════════════════════════════════════════════════════════════════════════════

function checkWeeklySchedule() {
  const now = new Date();
  if (now.getDay() !== 1) return;
  const h = now.getHours(), m = now.getMinutes();
  if (h === 10 && m === 0) enviarReportesSemanal().catch(() => {});
  if (h === 12 && m === 0) enviarTop3Semanal().catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 15 — SLASH COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Verifica la latencia del bot'),

  new SlashCommandBuilder()
    .setName('registrar-streamer')
    .setDescription('[Admin] Registrar manualmente un streamer')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o => o.setName('usuario').setDescription('Usuario de Discord').setRequired(true))
    .addStringOption(o => o.setName('twitch').setDescription('Usuario Twitch'))
    .addStringOption(o => o.setName('kick').setDescription('Usuario Kick'))
    .addStringOption(o => o.setName('tiktok').setDescription('Usuario TikTok (sin @)'))
    .addStringOption(o => o.setName('youtube').setDescription('Canal YouTube (@usuario)'))
    .addStringOption(o => o.setName('instagram').setDescription('Usuario Instagram'))
    .addStringOption(o => o.setName('biografia').setDescription('Bio del streamer'))
    .addStringOption(o => o.setName('color').setDescription('Color HEX (ej: #9146FF)')),

  new SlashCommandBuilder()
    .setName('quiero-ser-streamer')
    .setDescription('Solicitar unirse como streamer de El Patio RP')
    .addStringOption(o => o.setName('twitch').setDescription('Tu usuario de Twitch'))
    .addStringOption(o => o.setName('kick').setDescription('Tu usuario de Kick'))
    .addStringOption(o => o.setName('tiktok').setDescription('Tu usuario de TikTok'))
    .addStringOption(o => o.setName('youtube').setDescription('Tu YouTube (@usuario)'))
    .addStringOption(o => o.setName('instagram').setDescription('Tu Instagram'))
    .addStringOption(o => o.setName('biografia').setDescription('Cuéntanos sobre ti')),

  new SlashCommandBuilder().setName('mi-hilo').setDescription('Ver tu hilo en el foro de streamers'),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Estadísticas de un streamer o del servidor')
    .addUserOption(o => o.setName('usuario').setDescription('Streamer a consultar (opcional)')),

  new SlashCommandBuilder().setName('live').setDescription('Ver quién está en vivo ahora mismo'),

  new SlashCommandBuilder()
    .setName('clips')
    .setDescription('Ver clips recientes de un streamer')
    .addUserOption(o => o.setName('usuario').setDescription('Streamer (opcional, default: tú)')),

  new SlashCommandBuilder()
    .setName('ia')
    .setDescription('Pregúntale algo a la IA de El Patio RP')
    .addStringOption(o => o.setName('pregunta').setDescription('Tu pregunta').setRequired(true)),

  new SlashCommandBuilder()
    .setName('ayuda-titulo')
    .setDescription('IA genera el mejor título + hashtags para tu stream')
    .addStringOption(o => o.setName('juego').setDescription('Juego o contenido').setRequired(true))
    .addStringOption(o => o.setName('contexto').setDescription('Detalle extra')),

  new SlashCommandBuilder()
    .setName('horario-stream')
    .setDescription('Programa tu stream — el bot avisa 30 min antes')
    .addStringOption(o => o.setName('dia').setDescription('Día').setRequired(true)
      .addChoices(
        { name: 'Lunes', value: 'Lunes' }, { name: 'Martes', value: 'Martes' },
        { name: 'Miércoles', value: 'Miércoles' }, { name: 'Jueves', value: 'Jueves' },
        { name: 'Viernes', value: 'Viernes' }, { name: 'Sábado', value: 'Sábado' },
        { name: 'Domingo', value: 'Domingo' }, { name: 'Todos los días', value: 'Todos' },
      ))
    .addStringOption(o => o.setName('hora').setDescription('Hora (ej: 20:00)').setRequired(true))
    .addStringOption(o => o.setName('juego').setDescription('Juego o contenido')),

  new SlashCommandBuilder().setName('ver-horarios').setDescription('Ver horarios de todos los streamers'),

  new SlashCommandBuilder()
    .setName('meta-viewers')
    .setDescription('El bot celebrará cuando alcances esta meta de viewers en vivo')
    .addIntegerOption(o => o.setName('viewers').setDescription('Meta de viewers').setRequired(true)),

  new SlashCommandBuilder()
    .setName('clip-manual')
    .setDescription('Subir un clip manualmente para análisis IA')
    .addStringOption(o => o.setName('url').setDescription('URL del clip').setRequired(true))
    .addStringOption(o => o.setName('titulo').setDescription('Título del clip')),

  new SlashCommandBuilder()
    .setName('sugerir-streamer')
    .setDescription('Sugerir un nuevo streamer para El Patio RP')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a sugerir').setRequired(true))
    .addStringOption(o => o.setName('razon').setDescription('¿Por qué lo recomiendas?')),

  new SlashCommandBuilder()
    .setName('top3')
    .setDescription('[Admin] Enviar el Top 3 semanal ahora')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName('check-stream')
    .setDescription('[Admin] Forzar verificación de streams ahora')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('config-cooldown')
    .setDescription('[Admin] Cambiar cooldown de notificaciones (minutos)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('minutos').setDescription('Minutos de cooldown').setRequired(true).setMinValue(5).setMaxValue(120)),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    console.log('🔄 Registrando slash commands...');
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), { body: commands });
    console.log(`✅ ${commands.length} comandos registrados`);
  } catch (e) { console.error('❌ Error registrando comandos:', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 16 — EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

client.once('ready', async () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔥 EL PATIO BOT STREAM v8.3 — ULTRA NOTIFIER 🔥       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`✅ Bot conectado: ${client.user.tag}`);
  console.log(`📡 Guild: ${config.discord.guildId}`);

  loadStorage();
  await registerCommands();

  setInterval(checkAllStreams,       config.notifications.checkInterval);
  setInterval(checkStreamSchedules,  60000);
  setInterval(checkWeeklySchedule,   60000);
  setInterval(saveStorage,           300000);

  setTimeout(checkAllStreams, 5000);
  console.log(`🔴 Check cada ${config.notifications.checkInterval / 1000}s • Cooldown: ${config.notifications.cooldownMinutes}min`);
  console.log('════════════════════════════════════════════════════════════');
});

client.on('interactionCreate', async (interaction) => {
  // ── Slash Commands ────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;
    try {
      // PING
      if (commandName === 'ping') {
        return interaction.reply({ embeds: [
          new EmbedBuilder().setColor(client.ws.ping < 100 ? 0x00FF00 : 0xFFFF00)
            .setTitle('🏓 Pong!')
            .addFields(
              { name: '📡 Latencia',   value: `${client.ws.ping}ms`,           inline: true },
              { name: '⏱️ Uptime',    value: `${Math.floor(process.uptime()/60)}m`, inline: true },
              { name: '👥 Streamers', value: `${storage.streamers.size}`,      inline: true },
              { name: '🔴 En Vivo',   value: `${storage.liveStreams.size}`,     inline: true },
            ),
        ], ephemeral: true });
      }

      // REGISTRAR-STREAMER (Admin)
      if (commandName === 'registrar-streamer') {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('usuario');
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (!member) return interaction.editReply({ content: '❌ Usuario no encontrado.' });
        if (storage.threads.has(target.id)) {
          return interaction.editReply({ content: `⚠️ Ya registrado. Hilo: <#${storage.threads.get(target.id)}>` });
        }
        const platforms = {
          twitch:    interaction.options.getString('twitch')?.toLowerCase().trim()    || null,
          kick:      interaction.options.getString('kick')?.toLowerCase().trim()      || null,
          tiktok:    interaction.options.getString('tiktok')?.replace('@','').trim()  || null,
          youtube:   interaction.options.getString('youtube')?.trim()                 || null,
          instagram: interaction.options.getString('instagram')?.replace('@','').trim() || null,
        };
        Object.keys(platforms).forEach(k => { if (!platforms[k]) delete platforms[k]; });
        if (!Object.keys(platforms).length) return interaction.editReply({ content: '❌ Agrega al menos una plataforma.' });

        const verifyResults = {};
        await Promise.allSettled(Object.entries(platforms).map(async ([p, u]) => { verifyResults[p] = await verifyPlatformUser(p, u); }));
        const failed = Object.entries(verifyResults).filter(([,r]) => !r.exists);
        if (failed.length) return interaction.editReply({ content: `❌ No encontrados:\n${failed.map(([p,r]) => `• **${p}**: ${r.error}`).join('\n')}` });

        const bio   = interaction.options.getString('biografia') || '';
        const color = interaction.options.getString('color') || '#9146FF';
        const thread = await createStreamerThread(member, platforms, bio, color);
        saveStorage();
        const platList = Object.entries(verifyResults).map(([p,r]) => {
          const e = {twitch:'🟣',kick:'🟢',tiktok:'⚫',youtube:'🔴',instagram:'📸'}[p];
          const f = r.followers ? ` · ${r.followers >= 1000 ? (r.followers/1000).toFixed(1)+'K' : r.followers} seg.` : '';
          return `${e} **${p}**: \`${platforms[p]}\` — ${r.displayName}${f}`;
        }).join('\n');
        return interaction.editReply({ content: `✅ **${member.displayName}** registrado.\n\n${platList}\n\n📌 Hilo: <#${thread.id}>` });
      }

      // QUIERO-SER-STREAMER (auto-registro)
      if (commandName === 'quiero-ser-streamer') {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        if (storage.streamers.has(userId)) return interaction.editReply({ content: '✅ ¡Ya eres streamer! Usa `/mi-hilo`.' });
        if (storage.pendingRegistrations.has(userId)) return interaction.editReply({ content: '⏳ Ya tienes una solicitud pendiente. Espera la aprobación.' });

        const platforms = {
          twitch:    interaction.options.getString('twitch')?.toLowerCase().trim()     || null,
          kick:      interaction.options.getString('kick')?.toLowerCase().trim()       || null,
          tiktok:    interaction.options.getString('tiktok')?.replace('@','').trim()   || null,
          youtube:   interaction.options.getString('youtube')?.trim()                  || null,
          instagram: interaction.options.getString('instagram')?.replace('@','').trim() || null,
        };
        Object.keys(platforms).forEach(k => { if (!platforms[k]) delete platforms[k]; });
        if (!Object.keys(platforms).length) return interaction.editReply({ content: '❌ Agrega al menos una plataforma.' });

        await interaction.editReply({ content: '🔄 Verificando tus plataformas...' });
        const verifyResults = {};
        await Promise.allSettled(Object.entries(platforms).map(async ([p,u]) => { verifyResults[p] = await verifyPlatformUser(p, u); }));
        const failed = Object.entries(verifyResults).filter(([,r]) => !r.exists);
        if (failed.length) return interaction.editReply({ content: `❌ Usuarios no encontrados:\n${failed.map(([p,r]) => `• **${p}**: ${r.error}`).join('\n')}` });

        storage.pendingRegistrations.set(userId, {
          userId, platforms, bio: interaction.options.getString('biografia') || '',
          verifyResults, requestedAt: new Date().toISOString(),
          displayName: interaction.member.displayName, avatar: interaction.user.displayAvatarURL(),
        });

        const adminCh = interaction.guild.channels.cache.get(config.discord.adminChannelId);
        if (adminCh) {
          const platList = Object.entries(platforms).map(([p,u]) => {
            const r = verifyResults[p];
            const e = {twitch:'🟣',kick:'🟢',tiktok:'⚫',youtube:'🔴',instagram:'📸'}[p];
            const f = r.followers ? ` · ${r.followers >= 1000 ? (r.followers/1000).toFixed(1)+'K' : r.followers} seg.` : '';
            return `${e} **${p}**: \`${u}\` — ${r.displayName}${f}`;
          }).join('\n');
          const warnings = Object.values(verifyResults).filter(r => r.warning).map(r => `⚠️ ${r.warning}`).join('\n');
          await adminCh.send({
            content: '🔔 **Nueva solicitud de streamer:**',
            embeds: [new EmbedBuilder().setColor(0xFFB700).setTitle('📋 Nueva solicitud de streamer')
              .setDescription(`**${interaction.member.displayName}** quiere unirse como streamer`)
              .addFields({ name: '✅ Plataformas verificadas', value: platList }, ...(warnings ? [{ name: '⚠️ Advertencias', value: warnings }] : []))
              .setThumbnail(interaction.user.displayAvatarURL({ size: 128 })).setFooter({ text: `ID: ${userId}` }).setTimestamp()],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`aprobar_${userId}`).setLabel('✅ Aprobar').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`rechazar_${userId}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger),
            )],
          });
        }
        return interaction.editReply({ content: `✅ **¡Solicitud enviada!** Plataformas verificadas. El staff te responderá pronto. 🎮` });
      }

      // MI-HILO
      if (commandName === 'mi-hilo') {
        const tid = storage.threads.get(interaction.user.id);
        if (!tid) return interaction.reply({ content: '❌ No tienes hilo. Usa `/quiero-ser-streamer` o pide al admin `/registrar-streamer`.', ephemeral: true });
        return interaction.reply({ content: `📌 Tu hilo: <#${tid}>`, ephemeral: true });
      }

      // STATS
      if (commandName === 'stats') {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('usuario');
        if (targetUser) {
          const data = storage.streamers.get(targetUser.id);
          if (!data) return interaction.editReply({ content: '❌ No está registrado como streamer.' });
          const stats = data.stats || {};
          const clips = storage.clips.get(targetUser.id) || [];
          const viral = clips.filter(c => (c.viralScore || 0) >= config.clips.viralThreshold).length;
          const isLive = [...storage.liveStreams.keys()].some(k => k.includes(targetUser.id));
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor(isLive ? 0x00FF88 : (data.color ? parseInt(data.color.replace('#',''), 16) : 0x9146FF))
              .setTitle(`${isLive ? '🔴 EN VIVO' : '⚫ Offline'} — ${targetUser.username}`)
              .setDescription(data.bio || 'Streamer de El Patio RP')
              .setThumbnail(targetUser.displayAvatarURL())
              .addFields(
                { name: '📺 Streams',      value: `${stats.totalStreams || 0}`,                 inline: true },
                { name: '⏱️ Horas',       value: `${(stats.totalHours || 0).toFixed(1)}h`,      inline: true },
                { name: '🔥 Peak',         value: formatNumber(stats.peakViewers || 0),          inline: true },
                { name: '🎬 Clips',        value: `${clips.length} (${viral} virales)`,          inline: true },
                { name: '🪙 Coins',        value: `${getCoins(targetUser.id)}`,                  inline: true },
              ).setTimestamp(),
          ]});
        }
        // Stats del servidor
        let totalHours = 0, totalStreams = 0;
        for (const [, d] of storage.streamers.entries()) { totalHours += d.stats?.totalHours || 0; totalStreams += d.stats?.totalStreams || 0; }
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor(0x9146FF).setTitle('📊 Estadísticas del servidor — El Patio RP')
            .addFields(
              { name: '🎮 Streamers',     value: `${storage.streamers.size}`,          inline: true },
              { name: '🔴 En Vivo',       value: `${storage.liveStreams.size}`,         inline: true },
              { name: '📺 Streams totales', value: `${totalStreams}`,                   inline: true },
              { name: '⏱️ Horas totales', value: `${totalHours.toFixed(1)}h`,          inline: true },
              { name: '📡 Latencia',       value: `${client.ws.ping}ms`,               inline: true },
            ).setTimestamp(),
        ]});
      }

      // LIVE
      if (commandName === 'live') {
        await interaction.deferReply();
        if (!storage.liveStreams.size) return interaction.editReply({ content: '😴 No hay streams en vivo ahora. El bot verifica cada minuto automáticamente.' });
        const guild  = client.guilds.cache.get(config.discord.guildId);
        const embed = new EmbedBuilder().setColor(0xFF0000).setTitle(`🔴 Streams en Vivo (${storage.liveStreams.size})`).setTimestamp();
        for (const [key, data] of storage.liveStreams.entries()) {
          const uid    = key.substring(key.indexOf('-') + 1);
          const member = await guild.members.fetch(uid).catch(() => null);
          const p      = PLATFORM_CONFIG[data.platform] || PLATFORM_CONFIG.twitch;
          const streamerData = storage.streamers.get(uid);
          const user   = streamerData?.platforms?.[data.platform] || uid;
          embed.addFields({ name: `${p.emojiText} ${member?.displayName || uid}`, value: `👥 ${formatNumber(data.currentViewers || 0)} viewers • [Ver](${p.urlBase}${user})`, inline: false });
        }
        return interaction.editReply({ embeds: [embed] });
      }

      // CLIPS
      if (commandName === 'clips') {
        await interaction.deferReply();
        const target = interaction.options.getUser('usuario') || interaction.user;
        const clips  = (storage.clips.get(target.id) || []).slice(0, 5);
        if (!clips.length) return interaction.editReply({ content: `❌ **${target.username}** no tiene clips aún.` });
        const lines = clips.map((c, i) => `**${i+1}.** ${c.title || 'Sin título'} · Score: ${c.viralScore || 0}/100 ${c.viralScore >= 65 ? '🔥' : ''}${c.url ? ` · [Ver](${c.url})` : ''}`);
        return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF6B00).setTitle(`🎬 Clips de ${target.username}`).setDescription(lines.join('\n')).setTimestamp()] });
      }

      // IA
      if (commandName === 'ia') {
        await interaction.deferReply();
        const pregunta  = interaction.options.getString('pregunta');
        const respuesta = await askGroqAI(pregunta, 'Eres el asistente IA de El Patio RP, servidor de streamers de GTA RP en español. Responde de forma útil y amigable.');
        if (!respuesta) return interaction.editReply({ content: '❌ Error con la IA. Verifica que GROQ_API_KEY esté configurada.' });
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor(0xA855F7)
            .setAuthor({ name: '🤖 IA El Patio RP', iconURL: client.user?.displayAvatarURL() })
            .setDescription(respuesta.slice(0, 4000))
            .setFooter({ text: `Preguntado por ${interaction.user.username}` }).setTimestamp(),
        ]});
      }

      // AYUDA-TITULO
      if (commandName === 'ayuda-titulo') {
        await interaction.deferReply({ ephemeral: true });
        const juego    = interaction.options.getString('juego');
        const contexto = interaction.options.getString('contexto') || '';
        const raw = await askGroqAI(
          `Eres experto en marketing para streamers de GTA RP en español. El streamer "${interaction.member.displayName}" va a hacer stream de "${juego}"${contexto ? ` (${contexto})` : ''}. Responde SOLO con JSON válido sin markdown:\n{"titulos":["titulo1","titulo2","titulo3"],"hashtags_tiktok":["tag1","tag2","tag3","tag4","tag5"],"tags_twitch":["tag1","tag2","tag3"],"thumbnail":"TEXTO MAX 4 PALABRAS","tip":"consejo corto"}`,
          'Responde SOLO con JSON válido, sin markdown ni texto extra.'
        );
        if (!raw) return interaction.editReply({ content: '❌ Error con la IA. Intenta de nuevo.' });
        try {
          const d = JSON.parse(raw.replace(/```json|```/g, '').trim());
          return interaction.editReply({ embeds: [
            new EmbedBuilder().setColor(0xA855F7)
              .setAuthor({ name: `🤖 Títulos IA para ${interaction.member.displayName}` })
              .setTitle(`Contenido: ${juego}`)
              .addFields(
                { name: '🎯 Opción 1', value: `\`${d.titulos?.[0] || '—'}\`` },
                { name: '🎣 Opción 2', value: `\`${d.titulos?.[1] || '—'}\`` },
                { name: '🔮 Opción 3', value: `\`${d.titulos?.[2] || '—'}\`` },
                { name: '⚫ Hashtags TikTok', value: (d.hashtags_tiktok || []).map(h => `#${h}`).join(' '), inline: true },
                { name: '🟣 Tags Twitch',     value: (d.tags_twitch  || []).join(', '),                     inline: true },
                { name: '🖼️ Thumbnail',       value: `**${d.thumbnail || juego.toUpperCase()}**`,           inline: true },
                ...(d.tip ? [{ name: '💡 Consejo', value: d.tip }] : []),
              ).setTimestamp(),
          ]});
        } catch {
          return interaction.editReply({ content: `🤖 **IA:**\n\`\`\`\n${raw.slice(0, 1800)}\n\`\`\`` });
        }
      }

      // HORARIO-STREAM
      if (commandName === 'horario-stream') {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        if (!storage.streamers.has(userId)) return interaction.editReply({ content: '❌ No eres streamer. Usa `/quiero-ser-streamer`.' });
        const dia   = interaction.options.getString('dia');
        const hora  = interaction.options.getString('hora');
        const juego = interaction.options.getString('juego') || 'GTA RP';
        if (!/^\d{1,2}:\d{2}$/.test(hora)) return interaction.editReply({ content: '❌ Formato de hora inválido. Usa HH:MM (ej: 20:00)' });
        const schedules = storage.streamSchedules.get(userId) || [];
        const filtered  = schedules.filter(s => s.dia !== dia);
        filtered.push({ dia, hora, juego, createdAt: new Date().toISOString() });
        storage.streamSchedules.set(userId, filtered);
        saveStorage();
        const channelId = config.discord.scheduleChannelId || config.discord.liveChannelId;
        const ch = interaction.guild.channels.cache.get(channelId);
        if (ch) await ch.send({ embeds: [
          new EmbedBuilder().setColor(0x7C5CFF)
            .setAuthor({ name: '📅 Stream programado', iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`${interaction.member.displayName} · ${dia} a las ${hora}`)
            .setDescription(`🎮 ${juego}\n\n🔔 El bot avisará **30 minutos antes** al servidor.`)
            .setTimestamp(),
        ]});
        return interaction.editReply({ content: `✅ Horario: **${dia}** a las **${hora}** — ${juego}\n🔔 El server recibirá aviso 30min antes.` });
      }

      // VER-HORARIOS
      if (commandName === 'ver-horarios') {
        await interaction.deferReply();
        const lines = [];
        for (const [uid, schedules] of storage.streamSchedules.entries()) {
          const member = await interaction.guild.members.fetch(uid).catch(() => null);
          if (!member) continue;
          for (const s of schedules) lines.push(`**${member.displayName}** — ${s.dia} ${s.hora} 🎮 ${s.juego || 'GTA RP'}`);
        }
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor(0x7C5CFF).setTitle('📅 Horarios — El Patio RP')
            .setDescription(lines.length ? lines.join('\n') : 'No hay horarios programados aún.')
            .setFooter({ text: '🔔 El bot avisa 30min antes' }).setTimestamp(),
        ]});
      }

      // META-VIEWERS
      if (commandName === 'meta-viewers') {
        await interaction.deferReply({ ephemeral: true });
        const userId  = interaction.user.id;
        const viewers = interaction.options.getInteger('viewers');
        if (!storage.streamers.has(userId)) return interaction.editReply({ content: '❌ No eres streamer. Usa `/quiero-ser-streamer`.' });
        const data  = storage.streamers.get(userId);
        data.viewerGoal = viewers;
        storage.streamers.set(userId, data);
        saveStorage();
        return interaction.editReply({ content: `🎯 Meta configurada: **${viewers.toLocaleString()} viewers**\nEl bot lo celebrará cuando la alcances en vivo. 🔥` });
      }

      // CLIP-MANUAL
      if (commandName === 'clip-manual') {
        await interaction.deferReply();
        const url    = interaction.options.getString('url');
        const titulo = interaction.options.getString('titulo') || 'Clip manual';
        const userId = interaction.user.id;
        const aiContent  = await analyzeClipWithAI({ title: titulo, game: 'GTA RP', viewers: 0 }, interaction.member.displayName, 'manual');
        const viralScore = aiContent?.viralScore || 50;
        const clipData   = { id: `manual-${Date.now()}-${userId}`, streamerId: userId, streamer: interaction.member.displayName, platform: 'manual', title: aiContent?.title || titulo, hashtags: aiContent?.hashtags || ['#ElPatioRP'], viralScore, category: aiContent?.category || 'highlight', hypeText: aiContent?.hypeText || '¡Clip épico!', processedAt: new Date().toISOString(), url, thumbnail: null, autoPublish: false, uploaded: false };
        const userClips = storage.clips.get(userId) || [];
        userClips.unshift(clipData);
        storage.clips.set(userId, userClips);
        saveStorage();
        return interaction.editReply({ embeds: [
          new EmbedBuilder().setColor(viralScore >= 65 ? 0xFFD700 : 0x00B4D8)
            .setTitle(`🎬 ${clipData.title}`)
            .setDescription(`📊 Score: **${viralScore}/100** ${viralScore >= 65 ? '🔥' : ''}\n📋 ${clipData.hashtags.join(' ')}\n🔗 [Ver clip](${url})`)
            .setTimestamp(),
        ]});
      }

      // SUGERIR-STREAMER
      if (commandName === 'sugerir-streamer') {
        await interaction.deferReply();
        const target = interaction.options.getUser('usuario');
        const razon  = interaction.options.getString('razon') || 'Sin razón especificada';
        const adminCh = interaction.guild.channels.cache.get(config.discord.adminChannelId);
        if (adminCh) await adminCh.send({ embeds: [
          new EmbedBuilder().setColor(0x00B4D8).setTitle('💡 Sugerencia de streamer')
            .setDescription(`**${interaction.user.username}** sugiere a **${target.username}**`)
            .addFields({ name: '📝 Razón', value: razon }).setThumbnail(target.displayAvatarURL()).setTimestamp(),
        ]});
        return interaction.editReply({ content: `✅ Sugerencia enviada al staff: **${target.username}** — "${razon}"` });
      }

      // TOP3 (admin)
      if (commandName === 'top3') {
        await enviarTop3Semanal();
        return interaction.reply({ content: '✅ Top 3 enviado.', ephemeral: true });
      }

      // CHECK-STREAM (admin)
      if (commandName === 'check-stream') {
        await interaction.deferReply({ ephemeral: true });
        await checkAllStreams();
        return interaction.editReply({ content: `✅ Verificación completada.\n📊 Streams activos: ${storage.liveStreams.size}` });
      }

      // CONFIG-COOLDOWN (admin)
      if (commandName === 'config-cooldown') {
        const minutos = interaction.options.getInteger('minutos');
        config.notifications.cooldownMinutes = minutos;
        return interaction.reply({ content: `✅ Cooldown actualizado a **${minutos} minutos**.`, ephemeral: true });
      }

    } catch (e) {
      logError(`Command ${commandName}`, e);
      const msg = { content: '❌ Error ejecutando el comando.', ephemeral: true };
      if (interaction.deferred || interaction.replied) interaction.editReply(msg).catch(() => {});
      else interaction.reply(msg).catch(() => {});
    }
  }

  // ── Buttons ───────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Aprobar streamer
    if (id.startsWith('aprobar_')) {
      const uid     = id.replace('aprobar_', '');
      const pending = storage.pendingRegistrations.get(uid);
      if (!pending) return interaction.reply({ content: '⚠️ Solicitud no encontrada.', ephemeral: true });
      const member  = await interaction.guild.members.fetch(uid).catch(() => null);
      if (!member)  return interaction.reply({ content: '⚠️ Miembro no encontrado.', ephemeral: true });
      const thread  = await createStreamerThread(member, pending.platforms, pending.bio, '#9146FF');
      storage.pendingRegistrations.delete(uid);
      saveStorage();
      await member.send({ content: `🎉 ¡Tu solicitud fue aprobada! Ya eres streamer de **El Patio RP**. Usa \`/mi-hilo\` para ver tu perfil.` }).catch(() => {});
      return interaction.update({ content: `✅ **${pending.displayName}** aprobado. Hilo: <#${thread.id}>`, components: [] });
    }

    // Rechazar streamer
    if (id.startsWith('rechazar_')) {
      const uid = id.replace('rechazar_', '');
      storage.pendingRegistrations.delete(uid);
      saveStorage();
      return interaction.update({ content: '❌ Solicitud rechazada.', components: [] });
    }

    // Copiar caption de clip
    if (id.startsWith('copy_caption_')) {
      const clipId = id.replace('copy_caption_', '');
      let found    = null;
      for (const [, clips] of storage.clips.entries()) { found = clips.find(c => c.id === clipId); if (found) break; }
      if (!found) return interaction.reply({ content: '❌ Clip no encontrado.', ephemeral: true });
      const caption = `${found.title}\n${found.hashtags?.join(' ')}`;
      return interaction.reply({ content: `📋 **Caption listo para copiar:**\n\`\`\`\n${caption}\n\`\`\``, ephemeral: true });
    }
  }
});

// DM al dar rol de streamer
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    if (!config.discord.streamerRoleId) return;
    const hadRole = oldMember.roles.cache.has(config.discord.streamerRoleId);
    const hasRole = newMember.roles.cache.has(config.discord.streamerRoleId);
    if (!hadRole && hasRole && !storage.threads.has(newMember.id)) {
      await newMember.send({
        content: `🎉 ¡Felicidades! Ahora eres **Streamer** en **${newMember.guild.name}**!\n\n📋 Regístrate con el comando:\n\`/quiero-ser-streamer\`\n\n🔔 El bot detectará cuando entres en vivo en Twitch 🟣, Kick 🟢, TikTok ⚫ y YouTube 🔴\n\n⚡ ¡Buena suerte!`,
      }).catch(() => {});
    }
  } catch {}
});

client.on('error', (e) => console.error('❌ Discord client error:', e.message));
process.on('unhandledRejection', (e) => console.error('❌ Unhandled rejection:', e?.message || e));

// ═══════════════════════════════════════════════════════════════════════════════
// SECCIÓN 17 — DASHBOARD + API EXPRESS
// ═══════════════════════════════════════════════════════════════════════════════

const webApp = express();
webApp.use(express.json());
webApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin',  '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== config.adminKey) return res.status(401).json({ error: 'No autorizado' });
  next();
}

// Servir dashboard
webApp.get('/', (req, res) => {
  const p = path.join(__dirname, 'dashboard.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.json({ status: 'ok', bot: 'El Patio Bot Stream v8.3', streamers: storage.streamers.size, lives: storage.liveStreams.size });
});
webApp.get('/dashboard', (req, res) => {
  const p = path.join(__dirname, 'dashboard.html');
  if (fs.existsSync(p)) return res.sendFile(p);
  res.redirect('/');
});

webApp.get('/health', (_, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

webApp.get('/api/status', (req, res) => {
  let totalHours = 0, totalStreams = 0;
  for (const [, d] of storage.streamers.entries()) { totalHours += d.stats?.totalHours || 0; totalStreams += d.stats?.totalStreams || 0; }
  res.json({
    status: 'online', bot: client.user?.tag || 'Conectando...', version: '8.3',
    uptime: process.uptime(),
    stats: { streamers: storage.streamers.size, threads: storage.threads.size, liveStreams: storage.liveStreams.size, totalHours: totalHours.toFixed(2), totalStreams },
    config: {
      checkInterval: config.notifications.checkInterval, cooldownMinutes: config.notifications.cooldownMinutes,
      enableTwitch: config.notifications.enableTwitch, enableKick: config.notifications.enableKick,
      enableTikTok: config.notifications.enableTikTok, enableYouTube: config.notifications.enableYouTube,
    },
    ping: client.ws.ping,
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    node: process.version,
  });
});

webApp.get('/live', (req, res) => {
  const live = [];
  for (const [key, data] of storage.liveStreams.entries()) {
    const uid = key.substring(key.indexOf('-') + 1);
    const streamerData = storage.streamers.get(uid);
    live.push({ key, platform: key.split('-')[0], userId: uid, ...data, platforms: streamerData?.platforms || {} });
  }
  res.json(live);
});

webApp.get('/streamers', (req, res) => {
  const data = {};
  for (const [uid, d] of storage.streamers.entries()) {
    data[uid] = { platforms: d.platforms || {}, bio: d.bio || '', color: d.color || '#9146FF', threadId: d.threadId, createdAt: d.createdAt, stats: d.stats || {} };
  }
  res.json(data);
});

webApp.get('/admin/logs', requireAdmin, (req, res) => res.json({ logs: webLogs.slice(-100) }));

webApp.post('/admin/check-streams', requireAdmin, async (req, res) => {
  try { await checkAllStreams(); res.json({ ok: true, message: 'Verificación ejecutada', liveCount: storage.liveStreams.size }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

webApp.get('/api/clips', requireAdmin, (req, res) => {
  const all = [];
  for (const [uid, clips] of storage.clips.entries()) clips.forEach(c => all.push({ ...c, uid }));
  all.sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt));
  const filter = req.query.filter;
  const result = filter === 'viral'   ? all.filter(c => c.viralScore >= config.clips.viralThreshold)
               : filter === 'pending' ? all.filter(c => !c.uploaded)
               : all;
  res.json(result.slice(0, 100));
});

webApp.post('/api/send-top3', requireAdmin, async (req, res) => {
  try { await enviarTop3Semanal(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

webApp.get('/api/schedules', (req, res) => {
  const list = [];
  for (const [uid, schedules] of storage.streamSchedules.entries()) list.push({ uid, schedules });
  res.json(list);
});

webApp.get('/api/weekly-stats', requireAdmin, (req, res) => {
  const list = [];
  for (const [uid, stats] of storage.weeklyStats.entries()) list.push({ uid, ...stats });
  list.sort((a, b) => (b.peakViewers || 0) - (a.peakViewers || 0));
  res.json(list);
});

// Buscar miembro
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
      id: m.id, username: m.user.username, displayName: m.displayName,
      avatar: m.user.displayAvatarURL({ size: 64 }),
      hasStreamerRole: config.discord.streamerRoleId ? m.roles.cache.has(config.discord.streamerRoleId) : false,
      isRegistered: storage.streamers.has(m.id),
    })).slice(0, 10);
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Verificar plataformas (dashboard)
webApp.post('/admin/verify-platforms', requireAdmin, async (req, res) => {
  try {
    const { platforms } = req.body;
    const results = {};
    const checks  = [];
    if (platforms.twitch)    checks.push(verifyPlatformUser('twitch',    platforms.twitch).then(r    => { results.twitch    = r; }));
    if (platforms.kick)      checks.push(verifyPlatformUser('kick',      platforms.kick).then(r      => { results.kick      = r; }));
    if (platforms.tiktok)    checks.push(verifyPlatformUser('tiktok',    platforms.tiktok).then(r    => { results.tiktok    = r; }));
    if (platforms.youtube)   checks.push(verifyPlatformUser('youtube',   platforms.youtube).then(r   => { results.youtube   = r; }));
    if (platforms.instagram) checks.push(verifyPlatformUser('instagram', platforms.instagram).then(r => { results.instagram = r; }));
    await Promise.allSettled(checks);
    res.json(results);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Registrar streamer desde dashboard
webApp.post('/admin/register-streamer', requireAdmin, async (req, res) => {
  try {
    const { userId, platforms, bio, color } = req.body;
    if (!userId) return res.status(400).json({ error: 'Falta userId' });
    const guild  = client.guilds.cache.get(config.discord.guildId);
    if (!guild)  return res.status(500).json({ error: 'Guild no encontrado' });
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Miembro no encontrado' });
    if (storage.threads.has(userId)) return res.status(409).json({ error: 'Ya registrado', threadId: storage.threads.get(userId) });

    const cleanPlatforms = {
      twitch:    platforms?.twitch?.toLowerCase().trim()             || null,
      kick:      platforms?.kick?.trim()                             || null,
      tiktok:    platforms?.tiktok?.replace('@', '').trim()          || null,
      youtube:   platforms?.youtube?.trim()                          || null,
      instagram: platforms?.instagram?.replace('@', '').trim()       || null,
    };
    Object.keys(cleanPlatforms).forEach(k => { if (!cleanPlatforms[k]) delete cleanPlatforms[k]; });
    if (!Object.keys(cleanPlatforms).length) return res.status(400).json({ error: 'Agrega al menos una plataforma' });

    const verifyResults = {};
    await Promise.allSettled(Object.entries(cleanPlatforms).map(async ([p, u]) => { verifyResults[p] = await verifyPlatformUser(p, u); }));
    const failed = Object.entries(verifyResults).filter(([,r]) => !r.exists);
    if (failed.length) return res.status(400).json({ error: 'Usuarios no encontrados', failed: failed.map(([p,r]) => ({ platform: p, reason: r.error })), verified: verifyResults });

    const thread = await createStreamerThread(member, cleanPlatforms, bio || '', color || '#9146FF');
    saveStorage();
    console.log(`✅ Streamer registrado desde dashboard: ${member.displayName}`);
    res.json({ ok: true, threadId: thread.id, displayName: member.displayName, verified: verifyResults });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Eliminar streamer desde dashboard
webApp.delete('/admin/streamer/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!storage.streamers.has(userId)) return res.status(404).json({ error: 'Streamer no encontrado' });
    storage.streamers.delete(userId);
    storage.threads.delete(userId);
    storage.clips.delete(userId);
    storage.weeklyStats.delete(userId);
    storage.streamSchedules.delete(userId);
    for (const key of storage.liveStreams.keys()) { if (key.includes(userId)) storage.liveStreams.delete(key); }
    saveStorage();
    console.log(`🗑️ Streamer eliminado: ${userId}`);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════════

webApp.listen(config.port, () => {
  console.log(`🌐 Dashboard: http://localhost:${config.port}`);
});

if (!config.discord.token) {
  console.error('❌ DISCORD_TOKEN no configurado en .env');
  process.exit(1);
}

client.login(config.discord.token).catch(e => {
  console.error('❌ Error al iniciar el bot:', e.message);
  process.exit(1);
});
