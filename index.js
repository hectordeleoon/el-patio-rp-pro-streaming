// ═══════════════════════════════════════════════════════════════════════════════
//            🔥 EL PATIO BOT STREAM v9.1 — ULTRA NOTIFIER COMPLETO
//   Twitch · Kick · TikTok · YouTube · IA Groq · Clips · Top 3 · Torneos
//   Apuestas · Tienda Coins · Recompensas · Portal Streamers · Roles Staff
// ═══════════════════════════════════════════════════════════════════════════════
'use strict';
require('dotenv').config();

const {
  Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder,
  ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  PermissionFlagsBits, Partials, REST, Routes, ThreadAutoArchiveDuration,
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
    forumChannelId:         process.env.FORUM_CHANNEL_ID || process.env.DISCORD_FORUM_CHANNEL_ID,
    streamerRoleId:         process.env.STREAMER_ROLE_ID,
    staffRoleId:            process.env.STAFF_ROLE_ID || '',
    notificationsChannelId: process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    liveChannelId:          process.env.DISCORD_LIVE_CHANNEL_ID     || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    postsChannelId:         process.env.DISCORD_POSTS_CHANNEL_ID    || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    clipsChannelId:         process.env.DISCORD_CLIPS_CHANNEL_ID    || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    generalChannelId:       process.env.DISCORD_GENERAL_CHANNEL_ID  || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    adminChannelId:         process.env.DISCORD_ADMIN_CHANNEL_ID    || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
    scheduleChannelId:      process.env.DISCORD_SCHEDULE_CHANNEL_ID || process.env.DISCORD_NOTIFICATIONS_CHANNEL_ID,
  },
  twitch:  { clientId: process.env.TWITCH_CLIENT_ID, clientSecret: process.env.TWITCH_CLIENT_SECRET },
  youtube: { apiKey:   process.env.YOUTUBE_API_KEY },
  groq:    { apiKey:   process.env.GROQ_API_KEY, model: 'llama-3.1-70b-versatile' },
  notifications: {
    checkInterval:   parseInt(process.env.CHECK_INTERVAL)        || 60000,
    cooldownMinutes: parseInt(process.env.NOTIFICATION_COOLDOWN) || 30,
    retryAttempts: 3, retryDelay: 5000,
    enableTwitch:  process.env.ENABLE_TWITCH  !== 'false',
    enableKick:    process.env.ENABLE_KICK    !== 'false',
    enableTikTok:  process.env.ENABLE_TIKTOK  !== 'false',
    enableYouTube: process.env.ENABLE_YOUTUBE === 'true',
  },
  clips: {
    viralThreshold:      parseInt(process.env.VIRAL_SCORE_AUTO_PUBLISH_THRESHOLD || '70'),
    autoClipIntervalMin: parseInt(process.env.AUTO_CLIP_INTERVAL_MIN || '20'),
    minViewers:          parseInt(process.env.MIN_VIEWERS_TO_CLIP    || '10'),
    autoGeneration:      process.env.FEATURE_AUTO_CLIP_GENERATION === 'true',
  },
  port:     parseInt(process.env.PORT || '3000'),
  adminKey: process.env.DASHBOARD_ADMIN_KEY || 'Leoon272113',
  staffKey: process.env.DASHBOARD_STAFF_KEY || 'staff-elpatio-2026',
  shopVipRoleId: process.env.SHOP_VIP_ROLE_ID || '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLATAFORMAS Y TIENDA
// ═══════════════════════════════════════════════════════════════════════════════
const PLATFORM_CONFIG = {
  twitch:  { color:0x9146FF, emoji:'🟣', name:'Twitch',  icon:'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c1.png', watchLabel:'Ver en Twitch',  liveLabel:'🔴 EN VIVO EN TWITCH',  urlBase:'https://twitch.tv/',         thumb:(u)=>`https://static-cdn.jtvnw.net/previews-ttv/live_user_${u}-1280x720.jpg?t=${Date.now()}` },
  kick:    { color:0x53FC18, emoji:'🟢', name:'Kick',    icon:'https://kick.com/favicon.ico',                                        watchLabel:'Ver en Kick',    liveLabel:'🔴 EN VIVO EN KICK',    urlBase:'https://kick.com/',          thumb:()=>null },
  tiktok:  { color:0xFF0050, emoji:'⚫', name:'TikTok',  icon:'https://www.tiktok.com/favicon.ico',                                  watchLabel:'Ver en TikTok',  liveLabel:'🔴 EN VIVO EN TIKTOK',  urlBase:'https://www.tiktok.com/@',   thumb:()=>null },
  youtube: { color:0xFF0000, emoji:'🔴', name:'YouTube', icon:'https://www.youtube.com/favicon.ico',                                 watchLabel:'Ver en YouTube', liveLabel:'🔴 EN VIVO EN YOUTUBE', urlBase:'https://youtube.com/@',      thumb:()=>null },
};

const SHOP_ITEMS = [
  { id:'vip_role',     name:'⭐ Rol VIP',            price:500, description:'Rol VIP especial por 30 días',          type:'role' },
  { id:'mention',      name:'📣 Mención especial',   price:200, description:'El bot te menciona en el próximo live', type:'mention' },
  { id:'top_boost',    name:'🚀 Boost al Top 3',     price:150, description:'+50 puntos en el ranking semanal',      type:'boost' },
  { id:'custom_color', name:'🎨 Color personalizado',price:100, description:'Cambia el color de tu perfil',          type:'cosmetic' },
];

const REWARD_MILESTONES = [
  { id:'first_stream',   name:'🎮 Primer Stream',          coins:50,  desc:'¡Completaste tu primer stream!',            condition:(s)=>s.totalStreams>=1 },
  { id:'streams_10',     name:'📺 10 Streams',             coins:100, desc:'¡10 streams completados!',                  condition:(s)=>s.totalStreams>=10 },
  { id:'streams_50',     name:'🔥 50 Streams',             coins:300, desc:'¡50 streams, increíble constancia!',        condition:(s)=>s.totalStreams>=50 },
  { id:'hours_10',       name:'⏱️ 10 Horas de Stream',    coins:75,  desc:'¡10 horas acumuladas streamando!',          condition:(s)=>s.totalHours>=10 },
  { id:'hours_100',      name:'⌚ 100 Horas',              coins:500, desc:'¡100 horas! Leyenda del stream.',           condition:(s)=>s.totalHours>=100 },
  { id:'peak_100',       name:'👥 100 Viewers',            coins:150, desc:'¡Alcanzaste 100 viewers simultáneos!',      condition:(s)=>s.peakViewers>=100 },
  { id:'peak_500',       name:'🚀 500 Viewers',            coins:400, desc:'¡500 viewers simultáneos!',                 condition:(s)=>s.peakViewers>=500 },
  { id:'viral_clip',     name:'🎬 Primer Clip Viral',      coins:100, desc:'¡Tu primer clip viral!',                    condition:(s)=>s.viralClips>=1 },
  { id:'viral_clips_10', name:'🎬 10 Clips Virales',      coins:250, desc:'¡10 clips virales!',                        condition:(s)=>s.viralClips>=10 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// STORAGE
// ═══════════════════════════════════════════════════════════════════════════════
const STORAGE_FILE = path.join(__dirname, 'storage.json');
const storage = {
  streamers:            new Map(),
  threads:              new Map(),
  liveStreams:          new Map(),
  notifiedStreams:      new Map(),
  clips:                new Map(),
  achievements:         new Map(),
  economy:              new Map(),
  streamHistory:        new Map(),
  lastContentCheck:     new Map(),
  pendingRegistrations: new Map(),
  streamSchedules:      new Map(),
  achievedMilestones:   new Map(),
  weeklyStats:          new Map(),
  tournaments:          new Map(),
  shop:                 new Map(),
  bets:                 new Map(),
  activeBets:           new Map(),
  rewards:              new Map(),
  posts:                [],
};

function saveStorage() {
  try {
    const d = {
      streamers:           Object.fromEntries(storage.streamers),
      threads:             Object.fromEntries(storage.threads),
      liveStreams:         Object.fromEntries(storage.liveStreams),
      notifiedStreams:     Object.fromEntries(storage.notifiedStreams),
      achievements:        Object.fromEntries(storage.achievements),
      economy:             Object.fromEntries(storage.economy),
      streamHistory:       Object.fromEntries([...storage.streamHistory.entries()].map(([k,v])=>[k,v.slice(-100)])),
      lastContentCheck:    Object.fromEntries(storage.lastContentCheck),
      clips:               Object.fromEntries(storage.clips),
      streamSchedules:     Object.fromEntries(storage.streamSchedules),
      weeklyStats:         Object.fromEntries(storage.weeklyStats),
      tournaments:         Object.fromEntries(storage.tournaments),
      shop:                Object.fromEntries(storage.shop),
      bets:                Object.fromEntries(storage.bets),
      rewards:             Object.fromEntries(storage.rewards),
      posts:               (storage.posts||[]).slice(0,100),
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(d, null, 2));
  } catch(e) { console.error('❌ Error guardando storage:', e.message); }
}

function loadStorage() {
  try {
    if (!fs.existsSync(STORAGE_FILE)) return console.log('⚠️ Sin storage previo, empezando limpio');
    const d = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
    const load = (map, obj) => { if (obj && typeof obj==='object') Object.entries(obj).forEach(([k,v])=>map.set(k,v)); };
    load(storage.streamers,        d.streamers);
    load(storage.threads,          d.threads);
    load(storage.liveStreams,       d.liveStreams);
    load(storage.notifiedStreams,   d.notifiedStreams);
    load(storage.achievements,     d.achievements);
    load(storage.economy,          d.economy);
    load(storage.streamHistory,    d.streamHistory);
    load(storage.lastContentCheck, d.lastContentCheck);
    load(storage.clips,            d.clips);
    load(storage.streamSchedules,  d.streamSchedules);
    load(storage.weeklyStats,      d.weeklyStats);
    load(storage.tournaments,      d.tournaments);
    load(storage.shop,             d.shop);
    load(storage.bets,             d.bets);
    load(storage.rewards,          d.rewards || {});
    if (d.posts) storage.posts = d.posts;
    // Migrar threadId desde streamers si threads está vacío
    if (storage.threads.size === 0) {
      for (const [uid,sd] of storage.streamers.entries()) {
        if (sd.threadId) storage.threads.set(uid, sd.threadId);
      }
    }
    console.log(`✅ Storage cargado: ${storage.streamers.size} streamers, ${storage.bets.size} apuestas`);
  } catch(e) { console.error('❌ Error cargando storage:', e.message); }
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
  if (!n && n!==0) return '0';
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000)    return (n/1000).toFixed(1)+'K';
  return String(n);
}
function getCoins(uid) { return (storage.economy.get(uid)||{}).coins||0; }
function addCoins(uid, amount, reason='') {
  const ec = storage.economy.get(uid) || { coins:0, transactions:[] };
  ec.coins  = (ec.coins||0) + amount;
  ec.transactions = ec.transactions||[];
  ec.transactions.push({ amount, reason, date:new Date().toISOString() });
  if (ec.transactions.length>100) ec.transactions=ec.transactions.slice(-100);
  storage.economy.set(uid, ec);
  return ec.coins;
}
function logError(ctx, e) { console.error(`[${new Date().toISOString().substring(11,19)}] ${ctx}: ${e?.message||e}`); }
function fmtUptime(sec) { const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; }
function fmtMem() { const m=process.memoryUsage().heapUsed/1024/1024; return `${m.toFixed(1)} MB`; }

// Web logs
const webLogs = [];
const _origLog=console.log, _origErr=console.error;
console.log = (...a)=>{ const m=a.join(' '); webLogs.push({type:'info',msg:m,time:new Date().toISOString()}); if(webLogs.length>500)webLogs.shift(); _origLog(...a); };
console.error= (...a)=>{ const m=a.join(' '); webLogs.push({type:'error',msg:m,time:new Date().toISOString()}); if(webLogs.length>500)webLogs.shift(); _origErr(...a); };

// ═══════════════════════════════════════════════════════════════════════════════
// TWITCH TOKEN
// ═══════════════════════════════════════════════════════════════════════════════
let twitchToken=null, twitchTokenExpiry=0;
async function getTwitchToken() {
  if (!config.twitch.clientId||config.twitch.clientId==='tu_twitch_client_id') return null;
  if (twitchToken && Date.now()<twitchTokenExpiry) return twitchToken;
  try {
    const r = await axios.post('https://id.twitch.tv/oauth2/token',null,{
      params:{ client_id:config.twitch.clientId, client_secret:config.twitch.clientSecret, grant_type:'client_credentials' },
      timeout:10000,
    });
    twitchToken      = r.data.access_token;
    twitchTokenExpiry= Date.now()+(r.data.expires_in-300)*1000;
    console.log('✅ Token Twitch renovado');
    return twitchToken;
  } catch(e) { logError('TwitchToken',e); return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACCIÓN DE USERNAME DESDE URL O STRING
// ═══════════════════════════════════════════════════════════════════════════════
function extractUsername(platform, input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  const patterns = {
    twitch:    [/twitch\.tv\/([^/?&#\s]+)/i],
    kick:      [/kick\.com\/([^/?&#\s]+)/i],
    tiktok:    [/tiktok\.com\/@?([^/?&#\s]+)/i],
    youtube:   [/youtube\.com\/@([^/?&#\s]+)/i,/youtube\.com\/channel\/([^/?&#\s]+)/i,/youtube\.com\/c\/([^/?&#\s]+)/i,/youtube\.com\/user\/([^/?&#\s]+)/i],
    instagram: [/instagram\.com\/([^/?&#\s]+)/i],
  };
  for (const pat of (patterns[platform]||[])) {
    const m = s.match(pat);
    if (m?.[1]) return m[1].replace(/\/$/, '').replace(/^@/, '').trim();
  }
  // Si no matchea URL, devolver limpio
  return s.replace(/^https?:\/\//i,'').replace(/^www\./i,'').replace(/^@/,'').split('?')[0].split('/').filter(Boolean).pop()?.trim()||s;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICACIÓN DE PLATAFORMAS
// ═══════════════════════════════════════════════════════════════════════════════
async function verifyPlatformUser(platform, rawInput) {
  const username = extractUsername(platform, rawInput);
  if (!username||username.length<1) return { exists:false, error:'Usuario vacío' };
  const clean = username.replace(/^@/,'').toLowerCase().trim();

  try {
    // ── TWITCH ────────────────────────────────────────────────────────────────
    if (platform === 'twitch') {
      const token = await getTwitchToken();
      if (!token) return { exists:false, error:'Sin credenciales Twitch (configura TWITCH_CLIENT_ID y SECRET)' };
      const r = await axios.get('https://api.twitch.tv/helix/users',{
        headers:{ 'Client-ID':config.twitch.clientId, 'Authorization':`Bearer ${token}` },
        params:{ login:clean }, timeout:8000,
      });
      const u = r.data?.data?.[0];
      if (!u) return { exists:false, error:`"${username}" no existe en Twitch` };
      return { exists:true, displayName:u.display_name, avatar:u.profile_image_url, verified:true, resolvedUsername:u.login, method:'Twitch API' };
    }

    // ── KICK ──────────────────────────────────────────────────────────────────
    if (platform === 'kick') {
      const r = await axios.get(`https://kick.com/api/v2/channels/${clean}`,{
        timeout:8000, headers:{ 'User-Agent':'Mozilla/5.0','Accept':'application/json' },
      });
      const d = r.data?.data || r.data;
      if (!d?.id) return { exists:false, error:`"${username}" no existe en Kick` };
      return { exists:true, displayName:d.user?.username||clean, avatar:d.user?.profile_pic||null, followers:d.followers_count||0, isLive:!!d.livestream, verified:true, resolvedUsername:clean, method:'Kick API' };
    }

    // ── TIKTOK ────────────────────────────────────────────────────────────────
    if (platform === 'tiktok') {
      const UAs = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      ];
      for (const ua of UAs) {
        try {
          const r = await axios.get(`https://www.tiktok.com/@${clean}`,{
            timeout:15000,
            headers:{
              'User-Agent':ua,
              'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language':'es-ES,es;q=0.9,en;q=0.8',
              'Referer':'https://www.tiktok.com/',
              'sec-fetch-dest':'document','sec-fetch-mode':'navigate',
            },
            maxRedirects:5,
          });
          const html = r.data||'';
          if (r.status===404||html.includes('"statusCode":10202')||html.includes("Couldn't find this account")||html.includes('"statusCode":10221'))
            return { exists:false, error:`@${username} no existe en TikTok` };
          const positive = html.includes('"uniqueId"')||html.includes('"userInfo"')||html.includes('"nickname"')||html.includes('"followerCount"');
          if (!positive && html.length < 3000) continue;
          const nameM    = html.match(/"uniqueId":"([^"]+)"[^}]{0,200}"nickname":"([^"]+)"/);
          const followM  = html.match(/"followerCount":(\d+)/);
          const avatarM  = html.match(/"avatarThumb":"([^"]+)"/);
          const resolved = nameM?.[1]||clean;
          return {
            exists:true,
            displayName: nameM?.[2]||`@${clean}`,
            avatar:      avatarM?.[1]?.replace(/\\/g,'')||null,
            followers:   followM?parseInt(followM[1]):0,
            resolvedUsername: resolved,
            verified:true, method:'TikTok Perfil',
          };
        } catch(e2) {
          if (e2.response?.status===404) return { exists:false, error:`@${username} no existe en TikTok` };
          if (e2.response?.status===429) return { exists:true, displayName:`@${clean}`, resolvedUsername:clean, warning:'⚠️ TikTok limitó la verificación, revisar manualmente', method:'Rate limited' };
        }
      }
      return { exists:true, displayName:`@${clean}`, resolvedUsername:clean, warning:'⚠️ TikTok no respondió — se asume válido, verifica manualmente', method:'Sin verificar' };
    }

    // ── YOUTUBE ───────────────────────────────────────────────────────────────
    if (platform === 'youtube') {
      const handle = clean.startsWith('@')?clean.slice(1):clean;
      if (config.youtube.apiKey&&config.youtube.apiKey!=='tu_youtube_api_key') {
        const r = await axios.get('https://www.googleapis.com/youtube/v3/channels',{
          params:{ part:'snippet,statistics', forHandle:handle, key:config.youtube.apiKey }, timeout:8000,
        });
        const ch = r.data?.items?.[0];
        if (!ch) return { exists:false, error:`@${username} no encontrado en YouTube` };
        return { exists:true, displayName:ch.snippet?.title, avatar:ch.snippet?.thumbnails?.default?.url, followers:parseInt(ch.statistics?.subscriberCount||0), verified:true, resolvedUsername:handle, method:'YouTube API' };
      }
      try {
        const r = await axios.get(`https://www.youtube.com/@${handle}`,{timeout:10000,headers:{'User-Agent':'Mozilla/5.0'}});
        if (r.status===404) return { exists:false, error:`${username} no existe en YouTube` };
        const nm = r.data?.match(/"title":"([^"]{2,80})"/);
        return { exists:true, displayName:nm?nm[1]:clean, resolvedUsername:handle, warning:'Verificación básica — agrega YOUTUBE_API_KEY para mejor verificación', method:'YouTube scraping' };
      } catch(e2) {
        if (e2.response?.status===404) return { exists:false, error:`${username} no existe en YouTube` };
        return { exists:true, displayName:clean, resolvedUsername:handle, warning:'No verificado', method:'Sin verificar' };
      }
    }

    // ── INSTAGRAM ─────────────────────────────────────────────────────────────
    if (platform === 'instagram') {
      try {
        const r = await axios.get(`https://www.instagram.com/${clean}/`,{
          timeout:10000, headers:{ 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept-Language':'es-ES,es;q=0.9' },
        });
        const html = r.data||'';
        if (html.includes('"errorPage"')||html.length<500) return { exists:false, error:`@${username} no existe en Instagram` };
        const nm = html.match(/"full_name":"([^"]{1,50})"/);
        const fw = html.match(/"edge_followed_by":\{"count":(\d+)\}/);
        const pr = html.match(/"is_private":(true|false)/);
        return { exists:true, displayName:nm?nm[1]:`@${clean}`, followers:fw?parseInt(fw[1]):0, isPrivate:pr?.[1]==='true', resolvedUsername:clean, warning:pr?.[1]==='true'?'⚠️ Cuenta privada':null, method:'Instagram Perfil' };
      } catch(e2) {
        if (e2.response?.status===404) return { exists:false, error:`@${username} no existe en Instagram` };
        return { exists:true, displayName:`@${clean}`, resolvedUsername:clean, warning:'No verificado', method:'Sin verificar' };
      }
    }

    return { exists:true, displayName:username, resolvedUsername:clean, warning:'Sin verificación para esta plataforma' };
  } catch(e) {
    if (e.response?.status===404) return { exists:false, error:`"${username}" no existe en ${platform}` };
    return { exists:true, displayName:username, resolvedUsername:clean, warning:`Error de red: ${e.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTORES DE STREAM EN VIVO
// ═══════════════════════════════════════════════════════════════════════════════
async function checkTwitchStream(username, retries=0) {
  const token = await getTwitchToken();
  if (!token) return null;
  try {
    const r = await axios.get('https://api.twitch.tv/helix/streams',{
      headers:{ 'Client-ID':config.twitch.clientId, 'Authorization':`Bearer ${token}` },
      params:{ user_login:username.toLowerCase() }, timeout:10000,
    });
    if (!r.data.data?.length) return null;
    const s = r.data.data[0];
    return { isLive:true, title:s.title||'Sin título', game:s.game_name||'Sin categoría', viewers:s.viewer_count||0,
      thumbnailUrl:s.thumbnail_url?.replace('{width}','1280').replace('{height}','720')+`?t=${Date.now()}`,
      startedAt:new Date(s.started_at), streamUrl:`https://twitch.tv/${username}`, platform:'twitch' };
  } catch(e) {
    if (retries<config.notifications.retryAttempts) { await new Promise(r=>setTimeout(r,config.notifications.retryDelay)); return checkTwitchStream(username,retries+1); }
    return null;
  }
}

async function checkKickStream(username, retries=0) {
  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${username}/livestream`,{
      timeout:10000, headers:{ 'User-Agent':'Mozilla/5.0','Accept':'application/json' },
    });
    if (!r.data?.data?.id&&!r.data?.id) return null;
    const d = r.data.data||r.data;
    return { isLive:true, title:d.session_title||d.title||'Sin título', game:d.categories?.[0]?.name||'Sin categoría',
      viewers:d.viewer_count||d.viewers_count||0, thumbnailUrl:d.thumbnail?.url||null,
      startedAt:new Date(d.created_at||Date.now()), streamUrl:`https://kick.com/${username}`, platform:'kick' };
  } catch(e) {
    if (retries<config.notifications.retryAttempts) { await new Promise(r=>setTimeout(r,config.notifications.retryDelay)); return checkKickStream(username,retries+1); }
    return null;
  }
}

async function checkTikTokLive(username) {
  const clean = username.replace('@','').trim();
  try {
    const r = await axios.get(`https://www.tiktok.com/@${clean}/live`,{
      timeout:15000,
      headers:{ 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36','Accept':'text/html','Referer':'https://www.tiktok.com/' },
    });
    const html = r.data||'';
    const isLive = ['"isLiving":true','"liveStatus":1','"status":2','"roomStatus":2','"living":true'].some(s=>html.includes(s));
    if (!isLive) return null;
    const vM = html.match(/"user_count":(\d+)/)||html.match(/"viewerCount":(\d+)/);
    const tM = html.match(/"title":"([^"]{5,100})"/) || html.match(/"live_title":"([^"]{5,100})"/);
    return { isLive:true, title:tM?tM[1].replace(/\\u0026/g,'&'):`${clean} está en vivo en TikTok!`,
      game:'TikTok Live', viewers:vM?parseInt(vM[1]):0, thumbnailUrl:null,
      startedAt:new Date(), streamUrl:`https://www.tiktok.com/@${clean}/live`, platform:'tiktok' };
  } catch { return null; }
}

async function checkYouTubeLive(channelHandle) {
  if (!config.youtube.apiKey||config.youtube.apiKey==='tu_youtube_api_key') return null;
  try {
    const h = channelHandle.replace('@','').trim();
    const sr = await axios.get('https://www.googleapis.com/youtube/v3/search',{
      params:{ part:'snippet', q:h, type:'channel', key:config.youtube.apiKey, maxResults:1 }, timeout:10000,
    });
    if (!sr.data.items?.length) return null;
    const cid = sr.data.items[0].id.channelId;
    const lr  = await axios.get('https://www.googleapis.com/youtube/v3/search',{
      params:{ part:'snippet', channelId:cid, eventType:'live', type:'video', key:config.youtube.apiKey, maxResults:1 }, timeout:10000,
    });
    if (!lr.data.items?.length) return null;
    const live = lr.data.items[0];
    return { isLive:true, title:live.snippet.title, game:'YouTube Live', viewers:0,
      thumbnailUrl:live.snippet.thumbnails?.high?.url||null,
      startedAt:new Date(live.snippet.publishedAt), streamUrl:`https://youtube.com/watch?v=${live.id.videoId}`, platform:'youtube' };
  } catch { return null; }
}

async function getStreamData(platform, username) {
  switch(platform) {
    case 'twitch':  return checkTwitchStream(username);
    case 'kick':    return checkKickStream(username);
    case 'tiktok':  return checkTikTokLive(username);
    case 'youtube': return checkYouTubeLive(username);
    default:        return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// IA GROQ
// ═══════════════════════════════════════════════════════════════════════════════
async function askGroqAI(userPrompt, systemPrompt='Eres el asistente de El Patio RP. Responde en español.') {
  if (!config.groq.apiKey||config.groq.apiKey==='gsk_tu_groq_api_key') return null;
  try {
    const r = await axios.post('https://api.groq.com/openai/v1/chat/completions',
      { model:config.groq.model, max_tokens:500, messages:[{role:'system',content:systemPrompt},{role:'user',content:userPrompt}] },
      { headers:{ Authorization:`Bearer ${config.groq.apiKey}`,'Content-Type':'application/json' }, timeout:15000 }
    );
    return r.data.choices?.[0]?.message?.content?.trim()||null;
  } catch(e) { console.error('❌ Groq error:',e.response?.data?.error?.message||e.message); return null; }
}

async function analyzeClipWithAI(streamData, streamerName, platform) {
  try {
    const raw = await askGroqAI(
      `Analiza este momento de stream de "${streamerName}" en ${platform}:\nJuego: ${streamData.game||'GTA RP'}\nTítulo: ${streamData.title||'Sin título'}\nViewers: ${streamData.viewers||0}\nResponde SOLO JSON sin markdown:\n{"viralScore":75,"category":"epic","title":"Título corto","hashtags":["#GTARP","#clip"],"hypeText":"Texto hype","autoPublish":true}`,
      'Eres experto en viralidad de clips para streamers latinos de GTA RP. Responde SOLO JSON válido.'
    );
    if (!raw) return null;
    return JSON.parse(raw.replace(/```json|```/g,'').trim());
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDAR STREAMER EN EL SERVIDOR DE EL PATIO RP
// ═══════════════════════════════════════════════════════════════════════════════
async function validateStreamerInGuild(userId) {
  try {
    const guild  = client.guilds.cache.get(config.discord.guildId);
    if (!guild) return false;
    const member = await guild.members.fetch(userId).catch(()=>null);
    if (!member) {
      console.log(`⚠️ Usuario ${userId} NO está en el servidor El Patio RP — notificación cancelada`);
      return false;
    }
    // Debe tener rol de streamer O estar registrado en el bot
    const hasRole = config.discord.streamerRoleId ? member.roles.cache.has(config.discord.streamerRoleId) : false;
    const isReg   = storage.streamers.has(userId);
    if (!hasRole && !isReg) {
      console.log(`⚠️ ${member.displayName} no tiene rol streamer ni está registrado — skip`);
      return false;
    }
    return true;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANTI-SPAM
// ═══════════════════════════════════════════════════════════════════════════════
function canNotify(streamKey) {
  const last = storage.notifiedStreams.get(streamKey);
  if (!last) return true;
  return (Date.now()-last) >= config.notifications.cooldownMinutes*60*1000;
}
function markNotified(streamKey) {
  storage.notifiedStreams.set(streamKey, Date.now());
  const cutoff = Date.now()-24*60*60*1000;
  for (const [k,t] of storage.notifiedStreams.entries()) { if (t<cutoff) storage.notifiedStreams.delete(k); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIAR NOTIFICACIÓN DE LIVE — estilo Nekotina
// ═══════════════════════════════════════════════════════════════════════════════
async function sendLiveNotification(platform, member, username, streamData, streamerData) {
  try {
    // Validar que el streamer es del servidor
    const valid = await validateStreamerInGuild(member.id);
    if (!valid) return;

    const guild   = client.guilds.cache.get(config.discord.guildId);
    const channel = guild?.channels.cache.get(config.discord.liveChannelId);
    if (!channel) return console.error(`❌ Canal de lives no encontrado: ${config.discord.liveChannelId}`);

    const p        = PLATFORM_CONFIG[platform]||PLATFORM_CONFIG.twitch;
    const streamUrl= `${p.urlBase}${username}`;
    const thumbUrl = p.thumb(username);
    const ai       = streamData.aiContent;
    const plats    = streamerData?.platforms||{};

    const embed = new EmbedBuilder()
      .setColor(p.color)
      .setAuthor({ name:p.liveLabel, iconURL:p.icon })
      .setTitle(member.displayName)
      .setURL(streamUrl)
      .setDescription(`**${streamData.title||'¡En vivo!'}**`+(ai?.hypeText?`\n> *${ai.hypeText}*`:''))
      .setThumbnail(member.user.displayAvatarURL({size:256}))
      .setFooter({ text:`El Patio RP • ${p.name} • @${username}`, iconURL:client.user?.displayAvatarURL() })
      .setTimestamp();

    const fields=[];
    if (streamData.game)    fields.push({name:'🎮 Juego',        value:streamData.game,                                              inline:true});
    fields.push(             {name:'👥 Espectadores', value:streamData.viewers>0?formatNumber(streamData.viewers):'Iniciando...',    inline:true});
    if (ai?.viralScore)     fields.push({name:'🤖 Score IA',    value:`${ai.viralScore}/100`,                                        inline:true});
    embed.addFields(fields);
    if (thumbUrl) embed.setImage(thumbUrl);

    const mainBtn   = new ButtonBuilder().setLabel(`${p.emoji} ${p.watchLabel}`).setStyle(ButtonStyle.Link).setURL(streamUrl);
    const extraBtns = [];
    if (platform!=='twitch'  && plats.twitch)    extraBtns.push(new ButtonBuilder().setLabel('🟣 Twitch').setStyle(ButtonStyle.Link).setURL(`https://twitch.tv/${plats.twitch}`));
    if (platform!=='kick'    && plats.kick)      extraBtns.push(new ButtonBuilder().setLabel('🟢 Kick').setStyle(ButtonStyle.Link).setURL(`https://kick.com/${plats.kick}`));
    if (platform!=='tiktok'  && plats.tiktok)    extraBtns.push(new ButtonBuilder().setLabel('⚫ TikTok').setStyle(ButtonStyle.Link).setURL(`https://www.tiktok.com/@${plats.tiktok}`));
    if (platform!=='youtube' && plats.youtube)   extraBtns.push(new ButtonBuilder().setLabel('🔴 YouTube').setStyle(ButtonStyle.Link).setURL(`https://youtube.com/@${plats.youtube}`));

    const components=[new ActionRowBuilder().addComponents(mainBtn)];
    if (extraBtns.length) components.push(new ActionRowBuilder().addComponents(...extraBtns.slice(0,4)));

    const mention = config.discord.streamerRoleId ? `<@&${config.discord.streamerRoleId}>` : '@everyone';
    await channel.send({ content:`${mention} ¡**${member.displayName}** está en vivo en **${p.name}**! ${p.emoji}`, embeds:[embed], components });

    // Notificar también en el hilo del streamer
    const threadId = storage.threads.get(member.id);
    if (threadId) {
      const thread = guild.channels.cache.get(threadId);
      if (thread) await thread.send({ content:`🔴 ¡Estoy en vivo en ${p.name}!`, embeds:[embed] }).catch(()=>{});
    }
    console.log(`✅ Notificación enviada: ${member.displayName} en ${platform}`);
  } catch(e) { logError('sendLiveNotification', e); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOMPENSAS
// ═══════════════════════════════════════════════════════════════════════════════
async function checkAndGrantRewards(userId) {
  const streamerData = storage.streamers.get(userId);
  if (!streamerData) return;
  const stats    = streamerData.stats || {};
  const granted  = storage.rewards.get(userId) || [];
  const gIds     = granted.map(r=>r.id);
  const guild    = client.guilds.cache.get(config.discord.guildId);
  const member   = await guild?.members.fetch(userId).catch(()=>null);

  for (const m of REWARD_MILESTONES) {
    if (gIds.includes(m.id)) continue;
    if (!m.condition(stats)) continue;
    addCoins(userId, m.coins, `Logro: ${m.name}`);
    granted.push({ id:m.id, name:m.name, coins:m.coins, grantedAt:new Date().toISOString() });
    storage.rewards.set(userId, granted);
    if (member) {
      await member.send({ embeds:[new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`🏆 ¡Logro desbloqueado! ${m.name}`)
        .setDescription(`${m.desc}\n\n💰 **+${m.coins} coins** añadidos\nSaldo actual: **${getCoins(userId)} coins**`)
        .setFooter({text:'El Patio RP • Sistema de Recompensas'}).setTimestamp()
      ]}).catch(()=>{});
    }
    console.log(`🏆 Recompensa: ${member?.displayName||userId} → ${m.name} (+${m.coins})`);
  }
  saveStorage();
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-CLIPS
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchTwitchClips(username) {
  const token = await getTwitchToken();
  if (!token) return [];
  try {
    const ur = await axios.get('https://api.twitch.tv/helix/users',{
      headers:{ 'Client-ID':config.twitch.clientId,'Authorization':`Bearer ${token}` }, params:{login:username.toLowerCase()},
    });
    const bid = ur.data?.data?.[0]?.id;
    if (!bid) return [];
    const startDate = new Date(Date.now()-config.clips.autoClipIntervalMin*60*1000).toISOString();
    const cr = await axios.get('https://api.twitch.tv/helix/clips',{
      headers:{ 'Client-ID':config.twitch.clientId,'Authorization':`Bearer ${token}` },
      params:{ broadcaster_id:bid, started_at:startDate, first:5 },
    });
    return cr.data?.data||[];
  } catch { return []; }
}

async function processAutoClip(member, streamData, streamerData, platform) {
  if ((streamData.viewers||streamData.currentViewers||0)<config.clips.minViewers) return;
  const clips     = platform==='twitch'?await fetchTwitchClips(streamerData.platforms?.twitch||''):[];
  const aiContent = await analyzeClipWithAI(streamData, member.displayName, platform);
  const score     = aiContent?.viralScore||Math.floor(Math.random()*30+40);

  const clipData = {
    id:`clip-${Date.now()}-${member.id}`, streamerId:member.id, streamer:member.displayName, platform,
    title:aiContent?.title||streamData.title||'Clip automático',
    hashtags:aiContent?.hashtags||['#ElPatioRP','#GTARP'],
    viralScore:score, category:aiContent?.category||'highlight',
    hypeText:aiContent?.hypeText||'¡Momento épico!',
    processedAt:new Date().toISOString(), url:clips[0]?.url||null, thumbnail:clips[0]?.thumbnail_url||null,
    autoPublish:score>=config.clips.viralThreshold, uploaded:false,
  };

  const userClips = storage.clips.get(member.id)||[];
  userClips.unshift(clipData);
  if (userClips.length>50) userClips.pop();
  storage.clips.set(member.id, userClips);

  if (score>=config.clips.viralThreshold) {
    const sd=storage.streamers.get(member.id);
    if (sd) { sd.stats=sd.stats||{}; sd.stats.viralClips=(sd.stats.viralClips||0)+1; storage.streamers.set(member.id,sd); }
    await checkAndGrantRewards(member.id);
  }
  const ws=storage.weeklyStats.get(member.id)||{streams:0,totalViewers:0,peakViewers:0,clips:0};
  ws.clips=(ws.clips||0)+1; storage.weeklyStats.set(member.id,ws);
  saveStorage();

  // Notificar en canal de clips
  try {
    const guild=client.guilds.cache.get(config.discord.guildId);
    const ch=guild?.channels.cache.get(config.discord.clipsChannelId);
    if (!ch) return;
    const c=clipData.viralScore>=80?0xFFD700:clipData.viralScore>=65?0xFF6B00:0x00B4D8;
    const embed=new EmbedBuilder().setColor(c).setAuthor({name:`🎬 Clip IA — ${member.displayName}`,iconURL:member.user.displayAvatarURL()}).setTitle(clipData.title).setDescription(`${clipData.hypeText}\n\n📊 **Score:** ${clipData.viralScore}/100\n🏷️ ${clipData.hashtags.join(' ')}`).setFooter({text:clipData.autoPublish?'✅ Subida automática activada':'📋 Listo para subir'}).setTimestamp();
    if (clipData.thumbnail) embed.setImage(clipData.thumbnail);
    const btns=[new ButtonBuilder().setLabel('📋 Copiar Caption').setCustomId(`copy_caption_${clipData.id}`).setStyle(ButtonStyle.Secondary)];
    if (clipData.url) btns.unshift(new ButtonBuilder().setLabel('🎬 Ver Clip').setStyle(ButtonStyle.Link).setURL(clipData.url));
    await ch.send({ content:score>=65?`🔥 **¡Clip viral!** Score: ${score}/100`:`🎬 Clip de **${member.displayName}**`, embeds:[embed], components:[new ActionRowBuilder().addComponents(...btns.slice(0,4))] });
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// METAS DE VIEWERS
// ═══════════════════════════════════════════════════════════════════════════════
const VIEW_MILESTONES=[50,100,250,500,1000,2500,5000];
async function checkViewerGoals() {
  const guild=client.guilds.cache.get(config.discord.guildId);
  if (!guild) return;
  for (const [key,sData] of storage.liveStreams.entries()) {
    const uid     = key.substring(key.indexOf('-')+1);
    const viewers = sData.currentViewers||sData.viewers||0;
    const member  = await guild.members.fetch(uid).catch(()=>null);
    if (!member) continue;
    const achieved = storage.achievedMilestones.get(uid)||new Set();
    for (const m of VIEW_MILESTONES) {
      if (viewers<m) continue;
      const mk=`${m}-${new Date().toDateString()}`;
      if (achieved.has(mk)) continue;
      achieved.add(mk); storage.achievedMilestones.set(uid,achieved);
      const ch=guild.channels.cache.get(config.discord.liveChannelId);
      if (!ch) continue;
      let msg=`🎯 **${member.displayName}** alcanzó **${m.toLocaleString()} viewers**! 🔥`;
      if (config.groq.apiKey&&config.groq.apiKey!=='gsk_tu_groq_api_key'&&m>=100) {
        const ai=await askGroqAI(`El streamer "${member.displayName}" de GTA RP alcanzó ${m} viewers. Genera UNA línea de celebración épica con emojis (español, sin comillas).`,'Eres el hype man de El Patio RP.').catch(()=>null);
        if (ai) msg=ai;
      }
      await ch.send({ content:`${m>=500?'@everyone ':''}🎉 **¡${m.toLocaleString()} VIEWERS!**`,
        embeds:[new EmbedBuilder().setColor(m>=1000?0xFFD700:m>=500?0xFF9900:0x00E5C8).setTitle(`🏆 ${member.displayName} — ${m.toLocaleString()} viewers!`).setDescription(msg).setThumbnail(member.user.displayAvatarURL({size:256})).setTimestamp()] });
      addCoins(uid, Math.floor(m/10), `Peak de ${m} viewers`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// APUESTAS
// ═══════════════════════════════════════════════════════════════════════════════
async function resolveBets(streamKey, finalViewers) {
  const betId = storage.activeBets.get(streamKey);
  if (!betId) return;
  const bet = storage.bets.get(betId);
  if (!bet||bet.resolved) return;
  bet.resolved=true; bet.finalViewers=finalViewers;
  storage.bets.set(betId,bet); storage.activeBets.delete(streamKey);
  const won=(finalViewers>bet.startViewers);
  const guild=client.guilds.cache.get(config.discord.guildId);
  const ch=guild?.channels.cache.get(config.discord.generalChannelId);
  if (won&&bet.totalPool>0) {
    Object.entries(bet.participants).forEach(([uid,data])=>{ const share=Math.floor((data.amount/bet.totalPool)*bet.totalPool*1.9); addCoins(uid,share,`Apuesta ganada — pool ${bet.totalPool}`); });
    if (ch) await ch.send({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🎲 ¡Apuesta resuelta — GANARON!').setDescription(`${bet.startViewers} → ${finalViewers} viewers. Los ${Object.keys(bet.participants).length} apostadores reciben su parte del pool de **${bet.totalPool} 🪙**!`).setTimestamp()]});
  } else if (ch) {
    await ch.send({embeds:[new EmbedBuilder().setColor(0xFF4444).setTitle('🎲 Apuesta resuelta — perdieron').setDescription(`${bet.startViewers} → ${finalViewers} viewers. Pool de **${bet.totalPool} 🪙** perdido.`).setTimestamp()]});
  }
  saveStorage();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TORNEOS
// ═══════════════════════════════════════════════════════════════════════════════
async function checkTournaments() {
  for (const [tid,t] of storage.tournaments.entries()) {
    if (t.status!=='active'||new Date(t.endsAt).getTime()>Date.now()) continue;
    t.status='finished';
    for (const uid of Object.keys(t.participants)) {
      const ws=storage.weeklyStats.get(uid)||{};
      t.participants[uid].score=t.metrica==='viewers'?(ws.peakViewers||0):t.metrica==='streams'?(ws.streams||0):(ws.clips||0);
    }
    const sorted=Object.entries(t.participants).sort(([,a],[,b])=>b.score-a.score);
    const winnerId=sorted[0]?.[0];
    t.winnerId=winnerId; storage.tournaments.set(tid,t);
    if (winnerId) {
      addCoins(winnerId,t.premio,`Ganador torneo: ${t.nombre}`);
      const guild=client.guilds.cache.get(config.discord.guildId);
      const ch=guild?.channels.cache.get(config.discord.generalChannelId);
      const winner=await guild?.members.fetch(winnerId).catch(()=>null);
      if (ch) await ch.send({ content:'@everyone 🏆 **¡Torneo finalizado!**', embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle(`🏆 Ganador: ${t.nombre}`).setDescription(`🥇 **${winner?.displayName||winnerId}** ganó **${t.premio} 🪙** con score **${sorted[0][1].score}**!\n\nTop 3:\n${sorted.slice(0,3).map(([uid,d],i)=>`${['🥇','🥈','🥉'][i]} <@${uid}> — ${d.score}`).join('\n')}`).setTimestamp()] });
    }
    saveStorage();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HORARIOS
// ═══════════════════════════════════════════════════════════════════════════════
async function checkStreamSchedules() {
  const now=new Date();
  const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const diaHoy=dias[now.getDay()];
  const en30=new Date(now.getTime()+30*60000);
  const horaAviso=`${String(en30.getHours()).padStart(2,'0')}:${String(en30.getMinutes()).padStart(2,'0')}`;
  const guild=client.guilds.cache.get(config.discord.guildId);
  if (!guild) return;
  for (const [uid,schedules] of storage.streamSchedules.entries()) {
    for (const s of schedules) {
      if ((s.dia!==diaHoy&&s.dia!=='Todos')||s.hora!==horaAviso) continue;
      const key=`sched-${uid}-${s.dia}-${s.hora}-${now.toDateString()}`;
      if (storage.notifiedStreams.has(key)) continue;
      storage.notifiedStreams.set(key,Date.now());
      const member=await guild.members.fetch(uid).catch(()=>null);
      if (!member) continue;
      const ch=guild.channels.cache.get(config.discord.scheduleChannelId);
      if (!ch) continue;
      const plats=storage.streamers.get(uid)?.platforms||{};
      const btns=[];
      if (plats.twitch) btns.push(new ButtonBuilder().setLabel('🟣 Twitch').setStyle(ButtonStyle.Link).setURL(`https://twitch.tv/${plats.twitch}`));
      if (plats.kick)   btns.push(new ButtonBuilder().setLabel('🟢 Kick').setStyle(ButtonStyle.Link).setURL(`https://kick.com/${plats.kick}`));
      if (plats.tiktok) btns.push(new ButtonBuilder().setLabel('⚫ TikTok').setStyle(ButtonStyle.Link).setURL(`https://www.tiktok.com/@${plats.tiktok}`));
      await ch.send({
        content:`<@&${config.discord.streamerRoleId||''}> ⏰ **¡${member.displayName} empieza en 30 minutos!** 🔥`,
        embeds:[new EmbedBuilder().setColor(0xFF9900).setAuthor({name:'🔔 Stream en 30 minutos',iconURL:member.user.displayAvatarURL()}).setTitle(`${member.displayName} • ${s.juego||'GTA RP'}`).setDescription(`⏰ Empieza a las **${s.hora}**`).setThumbnail(member.user.displayAvatarURL({size:256})).setTimestamp()],
        components:btns.length?[new ActionRowBuilder().addComponents(...btns.slice(0,4))]:[],
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP 3 SEMANAL
// ═══════════════════════════════════════════════════════════════════════════════
async function enviarTop3Semanal() {
  try {
    const guild=client.guilds.cache.get(config.discord.guildId);
    const ch=guild?.channels.cache.get(config.discord.generalChannelId);
    if (!ch) return console.error('❌ Canal general no configurado para Top 3');
    const ranking=[];
    for (const [uid,stats] of storage.weeklyStats.entries()) {
      const member=await guild.members.fetch(uid).catch(()=>null);
      if (!member) continue;
      const score=(stats.streams||0)*10+(stats.peakViewers||0)+(stats.clips||0)*5+(stats.boostPoints||0);
      ranking.push({uid,member,stats,score});
    }
    ranking.sort((a,b)=>b.score-a.score);
    if (!ranking.length) return;
    const top3=ranking.slice(0,3);
    const medals=['🥇','🥈','🥉'];
    let desc='**🏆 Los mejores streamers de la semana:**\n\n';
    top3.forEach((e,i)=>{ desc+=`${medals[i]} **${e.member.displayName}**\n├ 📺 ${e.stats.streams||0} streams · 👥 ${(e.stats.peakViewers||0).toLocaleString()} peak · 🎬 ${e.stats.clips||0} clips\n└ ⭐ Score: **${e.score.toLocaleString()}**\n\n`; });
    let aiComment='¡Felicitaciones a los mejores de la semana! 🔥';
    if (config.groq.apiKey&&config.groq.apiKey!=='gsk_tu_groq_api_key') {
      const ai=await askGroqAI(`Top 3 de El Patio RP esta semana:\n1.${top3[0]?.member.displayName}\n2.${top3[1]?.member.displayName||'N/A'}\n3.${top3[2]?.member.displayName||'N/A'}\nGenera UN comentario épico de celebración (máx 2 líneas, español, emojis).`,'Presentador hype de El Patio RP.').catch(()=>null);
      if (ai) aiComment=ai;
    }
    const embed=new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 TOP 3 STREAMERS DE LA SEMANA — EL PATIO RP').setDescription(desc+`\n💬 *${aiComment}*`).setFooter({text:`El Patio RP • Top semanal • ${new Date().toLocaleDateString('es-ES')}`,iconURL:client.user?.displayAvatarURL()}).setTimestamp();
    if (top3[0]?.member) embed.setThumbnail(top3[0].member.user.displayAvatarURL({size:256}));
    await ch.send({content:'@everyone 🏆 **¡Resultados de la semana!**',embeds:[embed]});
    if (top3[0]) {
      addCoins(top3[0].uid,200,'Premio #1 semanal');
      const tid=storage.threads.get(top3[0].uid);
      if (tid) { const t=guild.channels.cache.get(tid); if (t) await t.send({content:'🥇 **¡Eres el streamer #1 de esta semana!** +200 🪙'}).catch(()=>{}); }
    }
    storage.weeklyStats.clear(); saveStorage();
    console.log('✅ Top 3 semanal enviado');
  } catch(e) { logError('enviarTop3Semanal',e); }
}

async function enviarReportesSemanal() {
  const guild=client.guilds.cache.get(config.discord.guildId);
  if (!guild) return;
  for (const [uid] of storage.streamers.entries()) {
    try {
      const member=await guild.members.fetch(uid).catch(()=>null);
      if (!member) continue;
      const stats=storage.weeklyStats.get(uid)||{};
      const clips=storage.clips.get(uid)||[];
      if (!stats.streams&&!clips.length) continue;
      const viral=clips.filter(c=>(c.viralScore||0)>=config.clips.viralThreshold).length;
      let tip='';
      if (config.groq.apiKey&&config.groq.apiKey!=='gsk_tu_groq_api_key') {
        tip=await askGroqAI(`"${member.displayName}" esta semana: ${stats.streams||0} streams, peak ${stats.peakViewers||0} viewers, ${viral} clips virales. Da UN consejo corto (1 línea, español).`,'Coach experto de streamers GTA RP.').catch(()=>'');
      }
      await member.send({embeds:[new EmbedBuilder().setColor(0x7C5CFF).setAuthor({name:'📊 Tu reporte semanal — El Patio RP',iconURL:client.user?.displayAvatarURL()}).setTitle(`¡Hola ${member.displayName}! Resumen de tu semana 🎮`).addFields({name:'📺 Streams',value:`${stats.streams||0}`,inline:true},{name:'👥 Peak',value:`${stats.peakViewers||0}`,inline:true},{name:'🎬 Clips',value:`${clips.length} (${viral} virales)`,inline:true}).setDescription(tip?`💡 **Consejo IA:** *${tip}*`:'¡Sigue así! La constancia es la clave 💪').setFooter({text:'El Patio RP • Reporte automático cada lunes'}).setTimestamp()]});
      await new Promise(r=>setTimeout(r,1500));
    } catch {}
  }
}

function checkWeeklySchedule() {
  const now=new Date();
  if (now.getDay()!==1) return;
  if (now.getHours()===10&&now.getMinutes()===0) enviarReportesSemanal().catch(()=>{});
  if (now.getHours()===12&&now.getMinutes()===0) enviarTop3Semanal().catch(()=>{});
}

// ═══════════════════════════════════════════════════════════════════════════════
// CREAR HILO DE FORO
// ═══════════════════════════════════════════════════════════════════════════════
async function createStreamerThread(member, platforms, bio, color) {
  const guild        = client.guilds.cache.get(config.discord.guildId);
  const forumChannel = guild?.channels.cache.get(config.discord.forumChannelId);

  if (!forumChannel) {
    throw new Error(`Canal de foro no encontrado. ID: "${config.discord.forumChannelId}". Verifica FORUM_CHANNEL_ID o DISCORD_FORUM_CHANNEL_ID en tu .env`);
  }
  if (forumChannel.type !== ChannelType.GuildForum) {
    throw new Error(`El canal "${config.discord.forumChannelId}" (${forumChannel.name}) no es de tipo Foro. En Discord crea un canal tipo "Foro" y pon su ID en FORUM_CHANNEL_ID`);
  }

  const streamerColor = color||'#9146FF';
  const embed = new EmbedBuilder()
    .setColor(streamerColor)
    .setTitle(`🎮 ${member.displayName}`)
    .setThumbnail(member.user.displayAvatarURL({forceStatic:false,size:256}))
    .setDescription(bio||'*Streamer de El Patio RP*');

  let platText='';
  if (platforms?.twitch)    platText+=`🟣 **Twitch:** [${platforms.twitch}](https://twitch.tv/${platforms.twitch})\n`;
  if (platforms?.kick)      platText+=`🟢 **Kick:** [${platforms.kick}](https://kick.com/${platforms.kick})\n`;
  if (platforms?.tiktok)    platText+=`⚫ **TikTok:** [@${platforms.tiktok}](https://tiktok.com/@${platforms.tiktok})\n`;
  if (platforms?.youtube)   platText+=`🔴 **YouTube:** [${platforms.youtube}](https://youtube.com/@${platforms.youtube})\n`;
  if (platforms?.instagram) platText+=`📸 **Instagram:** [@${platforms.instagram}](https://instagram.com/${platforms.instagram})\n`;
  if (platText) embed.addFields({name:'📺 Plataformas',value:platText});
  embed.addFields(
    {name:'👤 Miembro desde',value:`<t:${Math.floor((member.joinedTimestamp||Date.now())/1000)}:R>`,inline:true},
    {name:'📊 Streams',      value:'0', inline:true},
    {name:'⏱️ Horas',       value:'0h',inline:true},
  ).setFooter({text:`ID: ${member.id}`}).setTimestamp();

  const thread = await forumChannel.threads.create({
    name:`🎮 ${member.displayName}`,
    message:{ embeds:[embed] },
    reason:'Nuevo streamer registrado en El Patio RP',
  });

  storage.threads.set(member.id, thread.id);
  storage.streamers.set(member.id, {
    platforms:platforms||{}, bio:bio||'', color:streamerColor, threadId:thread.id,
    createdAt:Date.now(),
    stats:{ totalStreams:0, totalHours:0, avgViewers:0, peakViewers:0, viralClips:0, lastStream:null },
  });

  // Asignar rol de streamer automáticamente
  if (config.discord.streamerRoleId) {
    await member.roles.add(config.discord.streamerRoleId).catch(e=>console.error('❌ Error asignando rol streamer:',e.message));
    console.log(`✅ Rol streamer asignado a ${member.displayName}`);
  }

  return thread;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOOP PRINCIPAL DE VERIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════
async function checkAndNotify(platform, userId, username, member, streamerData) {
  const streamKey = `${platform}-${userId}`;
  const wasLive   = storage.liveStreams.has(streamKey);

  if (wasLive) {
    const streamData = await getStreamData(platform, username);
    if (streamData?.isLive) {
      const existing = storage.liveStreams.get(streamKey);
      existing.currentViewers = streamData.viewers;
      if (streamData.viewers>(existing.peakViewers||0)) existing.peakViewers=streamData.viewers;
      storage.liveStreams.set(streamKey,existing);
      const ws=storage.weeklyStats.get(userId)||{streams:0,totalViewers:0,peakViewers:0,clips:0};
      if (streamData.viewers>(ws.peakViewers||0)) ws.peakViewers=streamData.viewers;
      storage.weeklyStats.set(userId,ws);
      return true;
    } else {
      const liveData      = storage.liveStreams.get(streamKey);
      const durationHours = (Date.now()-new Date(liveData.startedAt||Date.now()).getTime())/3600000;
      const sd = storage.streamers.get(userId);
      if (sd) {
        sd.stats=sd.stats||{};
        sd.stats.totalHours=(sd.stats.totalHours||0)+durationHours;
        if ((liveData.peakViewers||0)>(sd.stats.peakViewers||0)) sd.stats.peakViewers=liveData.peakViewers;
        const hist=storage.streamHistory.get(userId)||[];
        hist.push({date:liveData.startedAt,duration:(Date.now()-new Date(liveData.startedAt||Date.now()).getTime())/1000,platform,peakViewers:liveData.peakViewers});
        storage.streamHistory.set(userId,hist.slice(-100));
        storage.streamers.set(userId,sd);
        const coins=Math.floor(durationHours*10);
        if (coins>0) addCoins(userId,coins,`Stream en ${platform} (${durationHours.toFixed(1)}h)`);
        await checkAndGrantRewards(userId);
      }
      await resolveBets(streamKey, liveData.currentViewers||0);
      storage.liveStreams.delete(streamKey);
      console.log(`⚫ Stream terminado: ${member.displayName} en ${platform}`);
      saveStorage();
      return false;
    }
  }

  const streamData = await getStreamData(platform, username);
  if (!streamData?.isLive) return false;

  if (!canNotify(streamKey)) {
    storage.liveStreams.set(streamKey,{startedAt:new Date().toISOString(),currentViewers:streamData.viewers,peakViewers:streamData.viewers,platform,title:streamData.title,silent:true});
    return true;
  }

  console.log(`🔴 ${member.displayName} EN VIVO en ${platform}!`);
  if (config.groq.apiKey&&config.groq.apiKey!=='gsk_tu_groq_api_key') {
    const aiContent=await analyzeClipWithAI(streamData,member.displayName,platform).catch(()=>null);
    if (aiContent) streamData.aiContent=aiContent;
  }
  storage.liveStreams.set(streamKey,{startedAt:new Date().toISOString(),currentViewers:streamData.viewers,viewers:streamData.viewers,peakViewers:streamData.viewers,platform,title:streamData.title,silent:false});
  await sendLiveNotification(platform,member,username,streamData,streamerData);
  markNotified(streamKey);

  const sd=storage.streamers.get(userId);
  if (sd) { sd.stats=sd.stats||{}; sd.stats.totalStreams=(sd.stats.totalStreams||0)+1; sd.stats.lastStream=new Date().toISOString(); storage.streamers.set(userId,sd); }
  const ws=storage.weeklyStats.get(userId)||{streams:0,totalViewers:0,peakViewers:0,clips:0};
  ws.streams=(ws.streams||0)+1; storage.weeklyStats.set(userId,ws);
  await checkAndGrantRewards(userId);
  saveStorage();
  return true;
}

async function checkAllStreams() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Verificando ${storage.streamers.size} streamers...`);
  if (!storage.streamers.size) return;
  let liveFound=0;
  for (const [userId,data] of storage.streamers.entries()) {
    try {
      const guild=client.guilds.cache.get(config.discord.guildId);
      if (!guild) continue;
      const member=await guild.members.fetch(userId).catch(()=>null);
      if (!member) continue;
      const plats=data.platforms||{};
      const checks=[];
      if (config.notifications.enableTwitch  && plats.twitch)  checks.push(checkAndNotify('twitch', userId,plats.twitch, member,data));
      if (config.notifications.enableKick    && plats.kick)    checks.push(checkAndNotify('kick',   userId,plats.kick,   member,data));
      if (config.notifications.enableTikTok  && plats.tiktok)  checks.push(checkAndNotify('tiktok', userId,plats.tiktok, member,data));
      if (config.notifications.enableYouTube && plats.youtube) checks.push(checkAndNotify('youtube',userId,plats.youtube,member,data));
      const results=await Promise.allSettled(checks);
      liveFound+=results.filter(r=>r.status==='fulfilled'&&r.value===true).length;
      // Auto-clips
      if (config.clips.autoGeneration) {
        for (const [platform] of Object.entries(plats)) {
          const sk=`${platform}-${userId}`;
          if (!storage.liveStreams.has(sk)) continue;
          const ck=`clip-${userId}-${platform}`;
          const lastClip=storage.notifiedStreams.get(ck)||0;
          if ((Date.now()-lastClip)>config.clips.autoClipIntervalMin*60*1000) {
            storage.notifiedStreams.set(ck,Date.now());
            const sd=storage.liveStreams.get(sk);
            processAutoClip(member,sd,data,platform).catch(()=>{});
          }
        }
      }
    } catch(e) { logError(`check ${userId}`,e); }
  }
  await checkViewerGoals().catch(()=>{});
  console.log(`✅ En vivo activos: ${storage.liveStreams.size}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLASH COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Verifica latencia del bot'),
  new SlashCommandBuilder().setName('live').setDescription('Ver quién está en vivo ahora'),
  new SlashCommandBuilder().setName('stats').setDescription('Estadísticas de un streamer o del servidor').addUserOption(o=>o.setName('usuario').setDescription('Streamer a consultar')),
  new SlashCommandBuilder().setName('mi-hilo').setDescription('Ver tu hilo en el foro de streamers'),
  new SlashCommandBuilder().setName('mis-recompensas').setDescription('Ver tus logros y recompensas desbloqueadas'),
  new SlashCommandBuilder().setName('recompensas').setDescription('Ver todas las recompensas disponibles y sus requisitos'),
  new SlashCommandBuilder().setName('mis-coins').setDescription('Ver tu saldo de coins y últimas transacciones'),
  new SlashCommandBuilder().setName('clips').setDescription('Ver clips recientes').addUserOption(o=>o.setName('usuario').setDescription('Streamer (opcional)')),
  new SlashCommandBuilder().setName('mis-apuestas').setDescription('Ver historial de tus apuestas'),
  new SlashCommandBuilder().setName('unirse-torneo').setDescription('Unirte al torneo activo como competidor'),
  new SlashCommandBuilder().setName('ver-torneo').setDescription('Ver el estado del torneo activo y el ranking'),
  new SlashCommandBuilder().setName('ver-horarios').setDescription('Ver horarios de todos los streamers'),
  new SlashCommandBuilder().setName('meta-viewers').setDescription('El bot celebrará cuando alcances esta meta').addIntegerOption(o=>o.setName('viewers').setDescription('Meta de viewers').setRequired(true)),
  new SlashCommandBuilder().setName('clip-manual').setDescription('Subir un clip manualmente para análisis IA').addStringOption(o=>o.setName('url').setDescription('URL del clip').setRequired(true)).addStringOption(o=>o.setName('titulo').setDescription('Título del clip')),
  new SlashCommandBuilder().setName('sugerir-streamer').setDescription('Sugerir un nuevo streamer para El Patio RP').addUserOption(o=>o.setName('usuario').setDescription('Usuario a sugerir').setRequired(true)).addStringOption(o=>o.setName('razon').setDescription('¿Por qué lo recomiendas?')),
  new SlashCommandBuilder().setName('ia').setDescription('Pregúntale algo a la IA de El Patio RP').addStringOption(o=>o.setName('pregunta').setDescription('Tu pregunta').setRequired(true)),
  new SlashCommandBuilder().setName('ayuda-titulo').setDescription('IA genera el mejor título + hashtags para tu stream').addStringOption(o=>o.setName('juego').setDescription('Juego o contenido').setRequired(true)).addStringOption(o=>o.setName('contexto').setDescription('Detalle extra')),
  new SlashCommandBuilder().setName('horario-stream').setDescription('Programa tu stream — el bot avisa 30 min antes')
    .addStringOption(o=>o.setName('dia').setDescription('Día').setRequired(true).addChoices({name:'Lunes',value:'Lunes'},{name:'Martes',value:'Martes'},{name:'Miércoles',value:'Miércoles'},{name:'Jueves',value:'Jueves'},{name:'Viernes',value:'Viernes'},{name:'Sábado',value:'Sábado'},{name:'Domingo',value:'Domingo'},{name:'Todos los días',value:'Todos'}))
    .addStringOption(o=>o.setName('hora').setDescription('Hora ej: 20:00').setRequired(true))
    .addStringOption(o=>o.setName('juego').setDescription('Juego o contenido')),
  new SlashCommandBuilder().setName('quiero-ser-streamer').setDescription('Solicitar unirte como streamer de El Patio RP')
    .addStringOption(o=>o.setName('twitch').setDescription('Tu usuario o URL de Twitch'))
    .addStringOption(o=>o.setName('kick').setDescription('Tu usuario o URL de Kick'))
    .addStringOption(o=>o.setName('tiktok').setDescription('Tu usuario o URL de TikTok'))
    .addStringOption(o=>o.setName('youtube').setDescription('Tu YouTube (usuario o URL)'))
    .addStringOption(o=>o.setName('instagram').setDescription('Tu Instagram (usuario o URL)'))
    .addStringOption(o=>o.setName('biografia').setDescription('Cuéntanos sobre ti')),
  new SlashCommandBuilder().setName('tienda').setDescription('Ver o comprar items con tus coins')
    .addStringOption(o=>o.setName('item').setDescription('Item a comprar').addChoices(
      {name:'⭐ Rol VIP (500 🪙)',value:'vip_role'},
      {name:'📣 Mención especial (200 🪙)',value:'mention'},
      {name:'🚀 Boost al Top 3 (150 🪙)',value:'top_boost'},
      {name:'🎨 Color personalizado (100 🪙)',value:'custom_color'},
    )),
  new SlashCommandBuilder().setName('apostar').setDescription('Apuesta coins a que un streamer sube de viewers')
    .addUserOption(o=>o.setName('streamer').setDescription('Streamer al que apostar').setRequired(true))
    .addIntegerOption(o=>o.setName('coins').setDescription('Cuántos coins apostar (mínimo 10)').setRequired(true).setMinValue(10)),
  new SlashCommandBuilder().setName('crear-torneo').setDescription('[Admin] Crear un torneo entre streamers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o=>o.setName('nombre').setDescription('Nombre del torneo').setRequired(true))
    .addStringOption(o=>o.setName('metrica').setDescription('¿Qué se mide?').setRequired(true).addChoices({name:'👥 Más peak viewers',value:'viewers'},{name:'📺 Más streams',value:'streams'},{name:'🎬 Más clips virales',value:'clips'}))
    .addIntegerOption(o=>o.setName('duracion_horas').setDescription('Duración en horas').setMinValue(1).setMaxValue(168))
    .addIntegerOption(o=>o.setName('premio_coins').setDescription('Premio en coins').setMinValue(50))
    .addStringOption(o=>o.setName('descripcion').setDescription('Descripción')),
  new SlashCommandBuilder().setName('registrar-streamer').setDescription('[Admin] Registrar manualmente un streamer')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(o=>o.setName('usuario').setDescription('Usuario de Discord').setRequired(true))
    .addStringOption(o=>o.setName('twitch').setDescription('Usuario o URL de Twitch'))
    .addStringOption(o=>o.setName('kick').setDescription('Usuario o URL de Kick'))
    .addStringOption(o=>o.setName('tiktok').setDescription('Usuario o URL de TikTok'))
    .addStringOption(o=>o.setName('youtube').setDescription('Canal YouTube (usuario o URL)'))
    .addStringOption(o=>o.setName('instagram').setDescription('Usuario o URL de Instagram'))
    .addStringOption(o=>o.setName('biografia').setDescription('Bio del streamer'))
    .addStringOption(o=>o.setName('color').setDescription('Color HEX ej: #9146FF')),
  new SlashCommandBuilder().setName('top3').setDescription('[Admin] Enviar el Top 3 semanal ahora').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('check-stream').setDescription('[Admin] Forzar verificación de streams').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('config-cooldown').setDescription('[Admin] Cambiar cooldown de notificaciones').setDefaultMemberPermissions(PermissionFlagsBits.Administrator).addIntegerOption(o=>o.setName('minutos').setDescription('Minutos').setRequired(true).setMinValue(5).setMaxValue(120)),
].map(cmd=>cmd.toJSON());

async function registerCommands() {
  try {
    const rest=new REST({version:'10'}).setToken(config.discord.token);
    console.log('🔄 Registrando slash commands...');
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId,config.discord.guildId),{body:commands});
    console.log(`✅ ${commands.length} comandos registrados`);
  } catch(e) { console.error('❌ Error registrando comandos:',e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIONS
// ═══════════════════════════════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
  // ── Botones ────────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const cid = interaction.customId;
    if (cid.startsWith('aprobar_')) {
      const uid     = cid.replace('aprobar_','');
      const pending = storage.pendingRegistrations.get(uid);
      if (!pending) return interaction.reply({content:'❌ Solicitud no encontrada o ya procesada.',ephemeral:true});
      try {
        await interaction.deferReply({ephemeral:true});
        const member=await interaction.guild.members.fetch(uid).catch(()=>null);
        if (!member) return interaction.editReply({content:'❌ El usuario ya no está en el server.'});
        const thread=await createStreamerThread(member,pending.platforms,pending.bio,'#9146FF');
        storage.pendingRegistrations.delete(uid); saveStorage();
        await member.send({content:`🎉 ¡Tu solicitud fue **aprobada**! Ya eres streamer de **El Patio RP**. Hilo: <#${thread.id}>. ¡Mucho éxito!`}).catch(()=>{});
        await interaction.editReply({content:`✅ **${member.displayName}** aprobado y registrado. Hilo: <#${thread.id}>`});
        await interaction.message.edit({components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('done').setLabel('✅ Aprobado').setStyle(ButtonStyle.Success).setDisabled(true))]}).catch(()=>{});
      } catch(e) { await interaction.editReply({content:`❌ Error: ${e.message}`}).catch(()=>{}); }
      return;
    }
    if (cid.startsWith('rechazar_')) {
      const uid=cid.replace('rechazar_','');
      storage.pendingRegistrations.delete(uid); saveStorage();
      await interaction.reply({content:'🗑️ Solicitud rechazada.',ephemeral:true});
      await interaction.message.edit({components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('done').setLabel('❌ Rechazado').setStyle(ButtonStyle.Danger).setDisabled(true))]}).catch(()=>{});
      return;
    }
  }

  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  try {
    // ── PING ──────────────────────────────────────────────────────────────────
    if (commandName==='ping') {
      return interaction.reply({embeds:[new EmbedBuilder().setColor(client.ws.ping<100?0x00FF00:0xFFFF00).setTitle('🏓 Pong!').addFields({name:'📡 Latencia',value:`${client.ws.ping}ms`,inline:true},{name:'⏱️ Uptime',value:fmtUptime(process.uptime()),inline:true},{name:'🎮 Streamers',value:`${storage.streamers.size}`,inline:true},{name:'🔴 En Vivo',value:`${storage.liveStreams.size}`,inline:true}).setTimestamp()],ephemeral:true});
    }

    // ── REGISTRAR-STREAMER ────────────────────────────────────────────────────
    if (commandName==='registrar-streamer') {
      await interaction.deferReply({ephemeral:true});
      const target = interaction.options.getUser('usuario');
      const member = await interaction.guild.members.fetch(target.id).catch(()=>null);
      if (!member) return interaction.editReply({content:'❌ Usuario no encontrado en el servidor.'});
      if (storage.streamers.has(target.id)) return interaction.editReply({content:`⚠️ Ya registrado. Hilo: <#${storage.threads.get(target.id)}>`});
      const rawPlatforms={
        twitch:    interaction.options.getString('twitch')    ||null,
        kick:      interaction.options.getString('kick')      ||null,
        tiktok:    interaction.options.getString('tiktok')    ||null,
        youtube:   interaction.options.getString('youtube')   ||null,
        instagram: interaction.options.getString('instagram') ||null,
      };
      Object.keys(rawPlatforms).forEach(k=>{ if (!rawPlatforms[k]) delete rawPlatforms[k]; });
      if (!Object.keys(rawPlatforms).length) return interaction.editReply({content:'❌ Agrega al menos una plataforma. Puedes pegar URLs completas.'});
      await interaction.editReply({content:'🔍 Verificando plataformas...'});
      const vRes={};
      await Promise.allSettled(Object.entries(rawPlatforms).map(async([p,u])=>{ vRes[p]=await verifyPlatformUser(p,u); }));
      const failed=Object.entries(vRes).filter(([,r])=>!r.exists);
      if (failed.length) return interaction.editReply({content:`❌ No encontrados:\n${failed.map(([p,r])=>`• **${p}**: ${r.error}`).join('\n')}\n\nPuedes pegar el URL completo del perfil.`});
      const platforms={};
      for (const [p,r] of Object.entries(vRes)) platforms[p]=r.resolvedUsername||extractUsername(p,rawPlatforms[p]);
      const bio=interaction.options.getString('biografia')||'';
      const color=interaction.options.getString('color')||'#9146FF';
      try {
        const thread=await createStreamerThread(member,platforms,bio,color);
        saveStorage();
        const platList=Object.entries(vRes).map(([p,r])=>{ const e={twitch:'🟣',kick:'🟢',tiktok:'⚫',youtube:'🔴',instagram:'📸'}[p]||'📡'; const f=r.followers?` · ${r.followers>=1000?(r.followers/1000).toFixed(1)+'K':r.followers} seg.`:''; const w=r.warning?` ⚠️`:''; return `${e} **${p}**: \`${platforms[p]}\` — ${r.displayName||platforms[p]}${f}${w}`; }).join('\n');
        return interaction.editReply({content:`✅ **${member.displayName}** registrado y rol asignado.\n\n${platList}\n\n📌 Hilo: <#${thread.id}>`});
      } catch(e) { return interaction.editReply({content:`❌ Error creando hilo: ${e.message}`}); }
    }

    // ── QUIERO-SER-STREAMER ───────────────────────────────────────────────────
    if (commandName==='quiero-ser-streamer') {
      await interaction.deferReply({ephemeral:true});
      const userId=interaction.user.id;
      if (storage.streamers.has(userId)) return interaction.editReply({content:'✅ ¡Ya eres streamer! Usa `/mi-hilo` para ver tu perfil.'});
      if (storage.pendingRegistrations.has(userId)) return interaction.editReply({content:'⏳ Ya tienes una solicitud pendiente. El staff te responderá pronto.'});
      const rawPlatforms={
        twitch:    interaction.options.getString('twitch')    ||null,
        kick:      interaction.options.getString('kick')      ||null,
        tiktok:    interaction.options.getString('tiktok')    ||null,
        youtube:   interaction.options.getString('youtube')   ||null,
        instagram: interaction.options.getString('instagram') ||null,
      };
      Object.keys(rawPlatforms).forEach(k=>{ if (!rawPlatforms[k]) delete rawPlatforms[k]; });
      if (!Object.keys(rawPlatforms).length) return interaction.editReply({content:'❌ Agrega al menos una plataforma. Puedes pegar URLs completas.'});
      await interaction.editReply({content:'🔍 Verificando tus plataformas...'});
      const vRes={};
      await Promise.allSettled(Object.entries(rawPlatforms).map(async([p,u])=>{ vRes[p]=await verifyPlatformUser(p,u); }));
      const failed=Object.entries(vRes).filter(([,r])=>!r.exists);
      if (failed.length) return interaction.editReply({content:`❌ Plataformas no encontradas:\n${failed.map(([p,r])=>`• **${p}**: ${r.error}`).join('\n')}\n\n💡 Intenta pegar el URL completo de tu perfil.`});
      const platforms={};
      for (const [p,r] of Object.entries(vRes)) platforms[p]=r.resolvedUsername||extractUsername(p,rawPlatforms[p]);
      storage.pendingRegistrations.set(userId,{userId,platforms,bio:interaction.options.getString('biografia')||'',verifyResults:vRes,requestedAt:new Date().toISOString(),displayName:interaction.member.displayName,avatar:interaction.user.displayAvatarURL()});
      saveStorage();
      const adminCh=interaction.guild.channels.cache.get(config.discord.adminChannelId);
      if (adminCh) {
        const platList=Object.entries(platforms).map(([p,u])=>{ const r=vRes[p]; const e={twitch:'🟣',kick:'🟢',tiktok:'⚫',youtube:'🔴',instagram:'📸'}[p]||'📡'; const f=r.followers?` · ${r.followers>=1000?(r.followers/1000).toFixed(1)+'K':r.followers} seg.`:''; const w=r.warning?` ⚠️ ${r.warning}`:''; return `${e} **${p}**: \`${u}\` — ${r.displayName||u}${f}${w}`; }).join('\n');
        await adminCh.send({
          content:'🔔 **Nueva solicitud de streamer:**',
          embeds:[new EmbedBuilder().setColor(0xFFB700).setTitle(`📋 Solicitud de ${interaction.member.displayName}`).setDescription(`**${interaction.member.displayName}** quiere unirse como streamer`).addFields({name:'✅ Plataformas verificadas',value:platList}).setThumbnail(interaction.user.displayAvatarURL({size:128})).setFooter({text:`ID: ${userId}`}).setTimestamp()],
          components:[new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprobar_${userId}`).setLabel('✅ Aprobar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rechazar_${userId}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger),
          )],
        });
      }
      return interaction.editReply({content:'✅ **¡Solicitud enviada!** Plataformas verificadas correctamente. El staff revisará tu solicitud y recibirás una respuesta pronto. 🎮'});
    }

    // ── MI-HILO ───────────────────────────────────────────────────────────────
    if (commandName==='mi-hilo') {
      const tid=storage.threads.get(interaction.user.id);
      if (!tid) return interaction.reply({content:'❌ No tienes hilo. Usa `/quiero-ser-streamer` para solicitar o pídele al admin `/registrar-streamer`.',ephemeral:true});
      return interaction.reply({content:`📌 Tu hilo de streamer: <#${tid}>`,ephemeral:true});
    }

    // ── STATS ─────────────────────────────────────────────────────────────────
    if (commandName==='stats') {
      await interaction.deferReply();
      const tu=interaction.options.getUser('usuario');
      if (tu) {
        const data=storage.streamers.get(tu.id);
        if (!data) return interaction.editReply({content:'❌ No está registrado como streamer.'});
        const stats=data.stats||{};
        const clips=storage.clips.get(tu.id)||[];
        const viral=clips.filter(c=>(c.viralScore||0)>=config.clips.viralThreshold).length;
        const isLive=[...storage.liveStreams.keys()].some(k=>k.includes(tu.id));
        const rewards=storage.rewards.get(tu.id)||[];
        return interaction.editReply({embeds:[new EmbedBuilder().setColor(isLive?0x00FF88:(data.color?parseInt((data.color||'#9146FF').replace('#',''),16):0x9146FF)).setTitle(`${isLive?'🔴 EN VIVO':'⚫'} ${tu.username}`).setDescription(data.bio||'Streamer de El Patio RP').setThumbnail(tu.displayAvatarURL()).addFields({name:'📺 Streams',value:`${stats.totalStreams||0}`,inline:true},{name:'⏱️ Horas',value:`${(stats.totalHours||0).toFixed(1)}h`,inline:true},{name:'🔥 Peak',value:formatNumber(stats.peakViewers||0),inline:true},{name:'🎬 Clips',value:`${clips.length} (${viral} 🔥)`,inline:true},{name:'🪙 Coins',value:`${getCoins(tu.id)}`,inline:true},{name:'🏆 Logros',value:`${rewards.length}/${REWARD_MILESTONES.length}`,inline:true}).setTimestamp()]});
      }
      let totalH=0,totalS=0;
      for (const [,d] of storage.streamers.entries()) { totalH+=d.stats?.totalHours||0; totalS+=d.stats?.totalStreams||0; }
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0x9146FF).setTitle('📊 El Patio RP — Estadísticas del Servidor').addFields({name:'🎮 Streamers',value:`${storage.streamers.size}`,inline:true},{name:'🔴 En Vivo',value:`${storage.liveStreams.size}`,inline:true},{name:'📺 Total Streams',value:`${totalS}`,inline:true},{name:'⏱️ Total Horas',value:`${totalH.toFixed(1)}h`,inline:true},{name:'🏟️ Torneos',value:`${storage.tournaments.size}`,inline:true},{name:'📡 Latencia',value:`${client.ws.ping}ms`,inline:true}).setTimestamp()]});
    }

    // ── LIVE ──────────────────────────────────────────────────────────────────
    if (commandName==='live') {
      await interaction.deferReply();
      if (!storage.liveStreams.size) return interaction.editReply({content:'😴 No hay ningún streamer en vivo ahora mismo.'});
      const guild=client.guilds.cache.get(config.discord.guildId);
      const embed=new EmbedBuilder().setColor(0xFF0000).setTitle(`🔴 Streams en Vivo (${storage.liveStreams.size})`).setTimestamp();
      for (const [key,data] of storage.liveStreams.entries()) {
        const uid=key.substring(key.indexOf('-')+1);
        const member=await guild.members.fetch(uid).catch(()=>null);
        const p=PLATFORM_CONFIG[data.platform]||PLATFORM_CONFIG.twitch;
        const sd=storage.streamers.get(uid);
        const user=sd?.platforms?.[data.platform]||uid;
        embed.addFields({name:`${p.emoji} ${member?.displayName||uid}`,value:`👥 ${formatNumber(data.currentViewers||0)} viewers • 🎮 ${data.title?.substring(0,40)||'—'} • [Ver](${p.urlBase}${user})`,inline:false});
      }
      return interaction.editReply({embeds:[embed]});
    }

    // ── CLIPS ─────────────────────────────────────────────────────────────────
    if (commandName==='clips') {
      await interaction.deferReply();
      const target=interaction.options.getUser('usuario')||interaction.user;
      const clips=(storage.clips.get(target.id)||[]).slice(0,5);
      if (!clips.length) return interaction.editReply({content:`❌ **${target.username}** no tiene clips aún.`});
      const lines=clips.map((c,i)=>`**${i+1}.** ${c.title||'Sin título'} · Score: ${c.viralScore||0}/100${(c.viralScore||0)>=65?' 🔥':''}${c.url?` · [Ver](${c.url})`:''}`);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFF6B00).setTitle(`🎬 Clips de ${target.username}`).setDescription(lines.join('\n')).setTimestamp()]});
    }

    // ── MIS-RECOMPENSAS ───────────────────────────────────────────────────────
    if (commandName==='mis-recompensas') {
      await interaction.deferReply({ephemeral:true});
      const uid=interaction.user.id;
      const granted=storage.rewards.get(uid)||[];
      const coins=getCoins(uid);
      if (!granted.length) return interaction.editReply({content:`❌ Aún no has desbloqueado ningún logro. ¡Sigue streamando! 💪\n💰 Tienes **${coins} coins**.`});
      const lines=granted.map(r=>`🏆 **${r.name}** — +${r.coins} 🪙 (${new Date(r.grantedAt).toLocaleDateString('es')})`);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Tus Logros Desbloqueados').setDescription(lines.join('\n')).addFields({name:'💰 Coins actuales',value:`${coins}`,inline:true},{name:'🏆 Progreso',value:`${granted.length}/${REWARD_MILESTONES.length}`,inline:true}).setTimestamp()]});
    }

    // ── RECOMPENSAS ───────────────────────────────────────────────────────────
    if (commandName==='recompensas') {
      await interaction.deferReply();
      const uid=interaction.user.id;
      const granted=(storage.rewards.get(uid)||[]).map(r=>r.id);
      const lines=REWARD_MILESTONES.map(m=>`${granted.includes(m.id)?'✅':'⬜'} **${m.name}** — ${m.coins} 🪙\n└ *${m.desc}*`);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🏆 Sistema de Recompensas — El Patio RP').setDescription(lines.join('\n\n')).setFooter({text:'✅ = Desbloqueado · ⬜ = Pendiente'}).setTimestamp()]});
    }

    // ── MIS-COINS ─────────────────────────────────────────────────────────────
    if (commandName==='mis-coins') {
      await interaction.deferReply({ephemeral:true});
      const coins=getCoins(interaction.user.id);
      const ec=storage.economy.get(interaction.user.id)||{transactions:[]};
      const last5=(ec.transactions||[]).slice(-5).reverse();
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🪙 Tus Coins — El Patio RP').setDescription(`💰 Saldo actual: **${coins} coins**`).addFields(last5.length?[{name:'📋 Últimas transacciones',value:last5.map(t=>`\`${t.amount>0?'+':''}${t.amount}\` ${t.reason}`).join('\n')}]:[]).setFooter({text:'Ganas coins streamando, logrando metas y ganando torneos'}).setTimestamp()]});
    }

    // ── TIENDA ────────────────────────────────────────────────────────────────
    if (commandName==='tienda') {
      await interaction.deferReply({ephemeral:true});
      const uid=interaction.user.id;
      const item=interaction.options.getString('item');
      const coins=getCoins(uid);
      if (!item) {
        return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🛒 Tienda — El Patio RP').setDescription(`💰 Tus coins: **${coins}**\nGana coins streamando y desbloqueando logros.\nUsa \`/tienda item:<nombre>\` para comprar.`).addFields(SHOP_ITEMS.map(i=>({name:`${i.name} — ${i.price} 🪙`,value:i.description,inline:true}))).setTimestamp()]});
      }
      const shopItem=SHOP_ITEMS.find(i=>i.id===item);
      if (!shopItem) return interaction.editReply({content:'❌ Item no encontrado.'});
      if (coins<shopItem.price) return interaction.editReply({content:`❌ Necesitas **${shopItem.price} 🪙** y tienes **${coins}**.`});
      addCoins(uid,-shopItem.price,`Compra: ${shopItem.name}`);
      const purchases=storage.shop.get(uid)||{purchases:[]};
      purchases.purchases.push({item:shopItem.id,date:new Date().toISOString(),price:shopItem.price});
      storage.shop.set(uid,purchases);
      if (shopItem.type==='role'&&config.shopVipRoleId) {
        const member=await interaction.guild.members.fetch(uid).catch(()=>null);
        if (member) { await member.roles.add(config.shopVipRoleId).catch(()=>{}); setTimeout(async()=>{ await member.roles.remove(config.shopVipRoleId).catch(()=>{}); },30*24*60*60*1000); }
      }
      if (shopItem.type==='boost') { const ws=storage.weeklyStats.get(uid)||{streams:0,totalViewers:0,peakViewers:0,clips:0}; ws.boostPoints=(ws.boostPoints||0)+50; storage.weeklyStats.set(uid,ws); }
      saveStorage();
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('✅ ¡Compra exitosa!').setDescription(`Compraste **${shopItem.name}** por **${shopItem.price} 🪙**\n${shopItem.description}\n\n💰 Coins restantes: **${getCoins(uid)}**`).setTimestamp()]});
    }

    // ── APOSTAR ───────────────────────────────────────────────────────────────
    if (commandName==='apostar') {
      await interaction.deferReply({ephemeral:true});
      const uid=interaction.user.id;
      const targetId=interaction.options.getUser('streamer').id;
      const amount=interaction.options.getInteger('coins');
      const coins=getCoins(uid);
      if (coins<amount) return interaction.editReply({content:`❌ Tienes **${coins} 🪙** y apuestas **${amount}**.`});
      const liveKey=[...storage.liveStreams.keys()].find(k=>k.includes(targetId));
      if (!liveKey) return interaction.editReply({content:'❌ Ese streamer no está en vivo ahora mismo. Solo puedes apostar a streamers en vivo.'});
      let betId=storage.activeBets.get(liveKey);
      if (!betId) {
        betId=`bet-${Date.now()}-${targetId}`;
        storage.activeBets.set(liveKey,betId);
        storage.bets.set(betId,{id:betId,streamKey:liveKey,streamerId:targetId,startViewers:storage.liveStreams.get(liveKey)?.currentViewers||0,participants:{},totalPool:0,startedAt:new Date().toISOString(),resolved:false});
      }
      const bet=storage.bets.get(betId);
      if (bet.resolved) return interaction.editReply({content:'❌ Esta apuesta ya cerró.'});
      if (bet.participants[uid]) return interaction.editReply({content:'⚠️ Ya apostaste en este stream. Solo una apuesta por stream.'});
      addCoins(uid,-amount,`Apuesta en stream de ${targetId}`);
      bet.participants[uid]={amount,placedAt:new Date().toISOString()};
      bet.totalPool+=amount;
      storage.bets.set(betId,bet); saveStorage();
      const guild=client.guilds.cache.get(config.discord.guildId);
      const target=await guild.members.fetch(targetId).catch(()=>null);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFF9900).setTitle('🎲 ¡Apuesta registrada!').setDescription(`Apostaste **${amount} 🪙** a que **${target?.displayName||'el streamer'}** sube viewers.\n\nPool total: **${bet.totalPool} 🪙** con ${Object.keys(bet.participants).length} apostadores.`).setTimestamp()]});
    }

    // ── MIS-APUESTAS ──────────────────────────────────────────────────────────
    if (commandName==='mis-apuestas') {
      await interaction.deferReply({ephemeral:true});
      const uid=interaction.user.id;
      const myBets=[...storage.bets.values()].filter(b=>b.participants[uid]);
      if (!myBets.length) return interaction.editReply({content:'❌ No tienes apuestas registradas aún.'});
      const lines=myBets.map(b=>{ const won=b.resolved&&b.finalViewers>b.startViewers; const amt=b.participants[uid]?.amount||0; const state=b.resolved?(won?'✅ Ganaste':'❌ Perdiste'):'⏳ En curso'; return `${state} — **${amt} 🪙** en stream de <@${b.streamerId||'—'}>`; }).slice(-10);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFF9900).setTitle('🎲 Mis Apuestas').setDescription(lines.join('\n')).setTimestamp()]});
    }

    // ── CREAR-TORNEO ──────────────────────────────────────────────────────────
    if (commandName==='crear-torneo') {
      await interaction.deferReply({ephemeral:true});
      const nombre=interaction.options.getString('nombre');
      const metrica=interaction.options.getString('metrica');
      const duracion=interaction.options.getInteger('duracion_horas')||24;
      const premio=interaction.options.getInteger('premio_coins')||500;
      const desc=interaction.options.getString('descripcion')||'';
      const tourneyId=`torneo-${Date.now()}`;
      const endsAt=new Date(Date.now()+duracion*3600000).toISOString();
      storage.tournaments.set(tourneyId,{id:tourneyId,nombre,desc,metrica,premio,endsAt,createdBy:interaction.user.id,participants:{},status:'active',createdAt:new Date().toISOString()});
      saveStorage();
      const guild=client.guilds.cache.get(config.discord.guildId);
      const ch=guild?.channels.cache.get(config.discord.generalChannelId);
      const metricaLabel={viewers:'👥 Más viewers',streams:'📺 Más streams',clips:'🎬 Más clips'}[metrica]||metrica;
      if (ch) await ch.send({content:'@everyone 🏟️ **¡Nuevo torneo en El Patio RP!**',embeds:[new EmbedBuilder().setColor(0xFF6B00).setTitle(`🏟️ ¡NUEVO TORNEO — ${nombre}!`).setDescription(desc||'¡El torneo ha comenzado!').addFields({name:'🎯 Métrica',value:metricaLabel,inline:true},{name:'🪙 Premio',value:`${premio} coins`,inline:true},{name:'⏰ Duración',value:`${duracion}h`,inline:false}).setFooter({text:'Usa /unirse-torneo para participar'}).setTimestamp()]});
      return interaction.editReply({content:`✅ Torneo **${nombre}** creado. ID: \`${tourneyId}\``});
    }

    // ── UNIRSE-TORNEO ─────────────────────────────────────────────────────────
    if (commandName==='unirse-torneo') {
      await interaction.deferReply({ephemeral:true});
      const uid=interaction.user.id;
      if (!storage.streamers.has(uid)) return interaction.editReply({content:'❌ Solo streamers registrados pueden participar en torneos.'});
      const activos=[...storage.tournaments.values()].filter(t=>t.status==='active');
      if (!activos.length) return interaction.editReply({content:'❌ No hay torneos activos ahora mismo.'});
      const torneo=activos[0];
      if (torneo.participants[uid]) return interaction.editReply({content:'✅ Ya estás inscrito en este torneo.'});
      torneo.participants[uid]={joinedAt:new Date().toISOString(),score:0};
      storage.tournaments.set(torneo.id,torneo); saveStorage();
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFF6B00).setTitle(`🏟️ ¡Inscrito en ${torneo.nombre}!`).setDescription(`Métrica: **${torneo.metrica}** · Premio: **${torneo.premio} 🪙**`).setTimestamp()]});
    }

    // ── VER-TORNEO ────────────────────────────────────────────────────────────
    if (commandName==='ver-torneo') {
      await interaction.deferReply();
      const activos=[...storage.tournaments.values()].filter(t=>t.status==='active');
      if (!activos.length) return interaction.editReply({content:'❌ No hay torneos activos.'});
      const t=activos[0];
      const sorted=Object.entries(t.participants).sort(([,a],[,b])=>b.score-a.score);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFF6B00).setTitle(`🏟️ ${t.nombre}`).setDescription(t.desc||'').addFields({name:'🎯 Métrica',value:t.metrica,inline:true},{name:'🪙 Premio',value:`${t.premio} coins`,inline:true},{name:'⏰ Termina',value:`<t:${Math.floor(new Date(t.endsAt).getTime()/1000)}:R>`,inline:true},{name:`📊 Ranking (${sorted.length} participantes)`,value:sorted.slice(0,5).map(([uid,d],i)=>`${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} <@${uid}> — ${d.score}`).join('\n')||'Sin participantes'}).setTimestamp()]});
    }

    // ── IA ────────────────────────────────────────────────────────────────────
    if (commandName==='ia') {
      await interaction.deferReply();
      const pregunta=interaction.options.getString('pregunta');
      const respuesta=await askGroqAI(pregunta,'Eres el asistente de El Patio RP, comunidad de GTA RP. Responde en español de forma amigable y concisa.');
      if (!respuesta) return interaction.editReply({content:'❌ IA no disponible. Configura GROQ_API_KEY en el .env'});
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0x7C5CFF).setTitle('🤖 El Patio IA').setDescription(respuesta).setFooter({text:`Pregunta de ${interaction.user.username}`}).setTimestamp()]});
    }

    // ── AYUDA-TITULO ──────────────────────────────────────────────────────────
    if (commandName==='ayuda-titulo') {
      await interaction.deferReply({ephemeral:true});
      const juego=interaction.options.getString('juego');
      const contexto=interaction.options.getString('contexto')||'';
      const raw=await askGroqAI(`Genera 3 títulos creativos para un stream de GTA RP:\nJuego: ${juego}\n${contexto?'Contexto: '+contexto:''}\nFormato: 1. [Título]\nHashtags: #GTARP #ElPatioRP [2 más relevantes]\nThumbnail text: [3 palabras impactantes]`,'Experto en marketing de streamers latinos de GTA RP.');
      if (!raw) return interaction.editReply({content:'❌ IA no disponible. Configura GROQ_API_KEY en el .env'});
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0x7C5CFF).setTitle(`💡 Títulos IA — ${juego}`).setDescription(raw).setTimestamp()]});
    }

    // ── HORARIO-STREAM ────────────────────────────────────────────────────────
    if (commandName==='horario-stream') {
      await interaction.deferReply({ephemeral:true});
      const uid=interaction.user.id;
      if (!storage.streamers.has(uid)) return interaction.editReply({content:'❌ Solo streamers registrados pueden programar horarios.'});
      const dia=interaction.options.getString('dia');
      const hora=interaction.options.getString('hora');
      const juego=interaction.options.getString('juego')||'GTA RP';
      if (!/^\d{1,2}:\d{2}$/.test(hora)) return interaction.editReply({content:'❌ Formato de hora inválido. Usa HH:MM (ej: 20:00)'});
      const schedules=storage.streamSchedules.get(uid)||[];
      schedules.push({dia,hora,juego,createdAt:new Date().toISOString()});
      storage.streamSchedules.set(uid,schedules); saveStorage();
      return interaction.editReply({content:`✅ Horario programado: **${dia}** a las **${hora}** — 🎮 ${juego}\nEl bot avisará 30 minutos antes.`});
    }

    // ── VER-HORARIOS ──────────────────────────────────────────────────────────
    if (commandName==='ver-horarios') {
      await interaction.deferReply();
      const all=[];
      for (const [uid,schedules] of storage.streamSchedules.entries()) {
        const guild=client.guilds.cache.get(config.discord.guildId);
        const member=await guild?.members.fetch(uid).catch(()=>null);
        schedules.forEach(s=>all.push({name:member?.displayName||uid,...s}));
      }
      if (!all.length) return interaction.editReply({content:'📅 No hay horarios programados.'});
      const lines=all.map(s=>`**${s.name}** — ${s.dia} a las **${s.hora}** 🎮 ${s.juego||'GTA RP'}`);
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0x9146FF).setTitle('📅 Horarios de Streamers — El Patio RP').setDescription(lines.join('\n')).setTimestamp()]});
    }

    // ── META-VIEWERS ──────────────────────────────────────────────────────────
    if (commandName==='meta-viewers') {
      const viewers=interaction.options.getInteger('viewers');
      if (!storage.streamers.has(interaction.user.id)) return interaction.reply({content:'❌ Solo streamers registrados pueden usar este comando.',ephemeral:true});
      const sd=storage.streamers.get(interaction.user.id)||{};
      sd.viewerGoal=viewers; storage.streamers.set(interaction.user.id,sd); saveStorage();
      return interaction.reply({content:`🎯 Meta establecida: **${viewers.toLocaleString()} viewers**. ¡El bot celebrará cuando la alcances!`,ephemeral:true});
    }

    // ── CLIP-MANUAL ───────────────────────────────────────────────────────────
    if (commandName==='clip-manual') {
      await interaction.deferReply({ephemeral:true});
      const uid=interaction.user.id;
      if (!storage.streamers.has(uid)) return interaction.editReply({content:'❌ Solo streamers registrados pueden subir clips.'});
      const url=interaction.options.getString('url');
      const titulo=interaction.options.getString('titulo')||'Clip manual';
      const aiContent=await analyzeClipWithAI({title:titulo,game:'GTA RP',viewers:0},interaction.user.username,'manual');
      const score=aiContent?.viralScore||50;
      const clipData={id:`clip-${Date.now()}-${uid}`,streamerId:uid,streamer:interaction.user.username,platform:'manual',title:aiContent?.title||titulo,hashtags:aiContent?.hashtags||['#ElPatioRP'],viralScore:score,hypeText:aiContent?.hypeText||'¡Gran clip!',processedAt:new Date().toISOString(),url,uploaded:false};
      const userClips=storage.clips.get(uid)||[];
      userClips.unshift(clipData); if (userClips.length>50) userClips.pop();
      storage.clips.set(uid,userClips); saveStorage();
      return interaction.editReply({content:`✅ Clip registrado! Score IA: **${score}/100** ${score>=65?'🔥':''}\n${aiContent?.title?`Título sugerido: *${aiContent.title}*`:''}`});
    }

    // ── SUGERIR-STREAMER ──────────────────────────────────────────────────────
    if (commandName==='sugerir-streamer') {
      const target=interaction.options.getUser('usuario');
      const razon=interaction.options.getString('razon')||'Sin razón especificada';
      const adminCh=interaction.guild.channels.cache.get(config.discord.adminChannelId);
      if (adminCh) await adminCh.send({embeds:[new EmbedBuilder().setColor(0x00B4D8).setTitle('💡 Sugerencia de nuevo streamer').setDescription(`**${interaction.user.displayName}** sugiere a **${target.username}**\n\n📝 *${razon}*`).setThumbnail(target.displayAvatarURL()).setFooter({text:`ID sugerido: ${target.id}`}).setTimestamp()]});
      return interaction.reply({content:`✅ Sugerencia enviada al staff. ¡Gracias!`,ephemeral:true});
    }

    // ── TOP3 ──────────────────────────────────────────────────────────────────
    if (commandName==='top3') {
      await interaction.deferReply({ephemeral:true});
      await enviarTop3Semanal();
      return interaction.editReply({content:'✅ Top 3 enviado al canal general.'});
    }

    // ── CHECK-STREAM ──────────────────────────────────────────────────────────
    if (commandName==='check-stream') {
      await interaction.deferReply({ephemeral:true});
      await checkAllStreams();
      return interaction.editReply({content:`✅ Verificación forzada. En vivo: **${storage.liveStreams.size}**`});
    }

    // ── CONFIG-COOLDOWN ───────────────────────────────────────────────────────
    if (commandName==='config-cooldown') {
      const min=interaction.options.getInteger('minutos');
      config.notifications.cooldownMinutes=min;
      return interaction.reply({content:`✅ Cooldown actualizado a **${min} minutos**.`,ephemeral:true});
    }

  } catch(e) {
    logError(`Command ${commandName}`, e);
    const msg=`❌ Error: ${e.message}`;
    if (interaction.deferred||interaction.replied) await interaction.editReply({content:msg}).catch(()=>{});
    else await interaction.reply({content:msg,ephemeral:true}).catch(()=>{});
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS API
// ═══════════════════════════════════════════════════════════════════════════════
const webApp = express();
webApp.use(express.json());
webApp.use(express.static(path.join(__dirname)));

// Middleware de autenticación
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key']||req.query.key||req.body?.key;
  if (key===config.adminKey) { req.role='admin'; return next(); }
  if (key===config.staffKey) { req.role='staff'; return next(); }
  return res.status(401).json({error:'No autorizado'});
}
function requireAdminOnly(req, res, next) {
  const key = req.headers['x-admin-key']||req.query.key||req.body?.key;
  if (key===config.adminKey) { req.role='admin'; return next(); }
  return res.status(403).json({error:'Solo el admin principal puede hacer esto'});
}

// ── RUTAS PÚBLICAS ─────────────────────────────────────────────────────────────
webApp.get('/api/status', (req,res)=>{
  const streamersList=[];
  for (const [uid,d] of storage.streamers.entries()) {
    const clips=storage.clips.get(uid)||[];
    const ws=storage.weeklyStats.get(uid)||{};
    const rewards=storage.rewards.get(uid)||[];
    streamersList.push({
      id:uid, displayName:d.displayName||uid, platforms:d.platforms||{}, bio:d.bio||'',
      color:d.color||'#9146FF', stats:d.stats||{}, weeklyStats:ws,
      coins:getCoins(uid), threadId:d.threadId||storage.threads.get(uid)||null,
      clipsCount:clips.length, viralClipsCount:clips.filter(c=>(c.viralScore||0)>=config.clips.viralThreshold).length,
      rewardsCount:rewards.length, isLive:[...storage.liveStreams.keys()].some(k=>k.includes(uid)),
    });
  }
  res.json({
    bot:client.user?.tag||'Desconectado',
    status:'online', ping:client.ws.ping, uptime:Math.floor(process.uptime()),
    memory:fmtMem(), node:process.version, version:'9.1',
    stats:{ streamers:storage.streamers.size, liveNow:storage.liveStreams.size, totalStreams:[...storage.streamers.values()].reduce((a,d)=>a+(d.stats?.totalStreams||0),0), totalHours:[...storage.streamers.values()].reduce((a,d)=>a+(d.stats?.totalHours||0),0) },
    config:{ cooldownMinutes:config.notifications.cooldownMinutes, checkInterval:config.notifications.checkInterval, viralThreshold:config.clips.viralThreshold, minViewers:config.clips.minViewers, enableTwitch:config.notifications.enableTwitch, enableKick:config.notifications.enableKick, enableTikTok:config.notifications.enableTikTok, enableYouTube:config.notifications.enableYouTube },
    streamers:streamersList,
    tournaments:[...storage.tournaments.values()],
    weeklyRanking:[...storage.weeklyStats.entries()].map(([uid,ws])=>({ uid, ...ws, score:(ws.streams||0)*10+(ws.peakViewers||0)+(ws.clips||0)*5+(ws.boostPoints||0), displayName:storage.streamers.get(uid)?.displayName||uid })).sort((a,b)=>b.score-a.score),
  });
});

webApp.get('/live', (req,res)=>{
  const list=[];
  for (const [key,data] of storage.liveStreams.entries()) {
    const uid=key.substring(key.indexOf('-')+1);
    const sd=storage.streamers.get(uid)||{};
    list.push({...data, userId:uid, platforms:sd.platforms||{}, displayName:sd.displayName||uid});
  }
  res.json(list);
});

webApp.get('/streamers', (req,res)=>{
  const data={};
  for (const [uid,d] of storage.streamers.entries()) {
    const clips=storage.clips.get(uid)||[];
    data[uid]={...d,
      coins:getCoins(uid),
      rewardsCount:(storage.rewards.get(uid)||[]).length,
      clipsCount:clips.length,
      viralClipsCount:clips.filter(c=>(c.viralScore||0)>=config.clips.viralThreshold).length,
      isLive:[...storage.liveStreams.keys()].some(k=>k.includes(uid)),
    };
  }
  res.json(data);
});

// Portal público de un streamer
webApp.get('/api/streamer/:userId', (req,res)=>{
  const uid=req.params.userId;
  const sd=storage.streamers.get(uid);
  if (!sd) return res.status(404).json({error:'Streamer no encontrado'});
  const clips=(storage.clips.get(uid)||[]).map(c=>({...c, streamerId:undefined}));
  const ws=storage.weeklyStats.get(uid)||{};
  const rewards=storage.rewards.get(uid)||[];
  const ranking=[...storage.weeklyStats.entries()].map(([id,w])=>({id,score:(w.streams||0)*10+(w.peakViewers||0)+(w.clips||0)*5+(w.boostPoints||0)})).sort((a,b)=>b.score-a.score);
  const rankPos=ranking.findIndex(r=>r.id===uid)+1;
  const isLive=[...storage.liveStreams.keys()].some(k=>k.includes(uid));
  const liveData=isLive?[...storage.liveStreams.entries()].filter(([k])=>k.includes(uid)).map(([,v])=>v)[0]:null;
  res.json({
    id:uid, displayName:sd.displayName||uid, bio:sd.bio||'', color:sd.color||'#9146FF',
    platforms:sd.platforms||{}, stats:sd.stats||{}, weeklyStats:ws,
    coins:getCoins(uid), threadId:sd.threadId||storage.threads.get(uid)||null,
    clips:clips.slice(0,10), rewards, rankPosition:rankPos||null, rankTotal:ranking.length,
    isLive, liveData,
  });
});

webApp.get('/api/leaderboard', (req,res)=>{
  const ranking=[];
  for (const [uid,ws] of storage.weeklyStats.entries()) {
    const sd=storage.streamers.get(uid)||{};
    const score=(ws.streams||0)*10+(ws.peakViewers||0)+(ws.clips||0)*5+(ws.boostPoints||0);
    ranking.push({ uid, displayName:sd.displayName||uid, platforms:sd.platforms||{}, color:sd.color||'#9146FF', stats:sd.stats||{}, weeklyStats:ws, score, coins:getCoins(uid), rewardsCount:(storage.rewards.get(uid)||[]).length });
  }
  res.json(ranking.sort((a,b)=>b.score-a.score));
});

// ── RUTAS STAFF (admin o encargado de streamers) ────────────────────────────
webApp.get('/api/clips', requireAdmin, (req,res)=>{
  const filter=req.query.filter||'all';
  const all=[];
  for (const [uid,clips] of storage.clips.entries()) clips.forEach(c=>all.push({...c,streamerId:uid}));
  all.sort((a,b)=>new Date(b.processedAt||0)-new Date(a.processedAt||0));
  let filtered=all;
  if (filter==='viral')   filtered=all.filter(c=>(c.viralScore||0)>=config.clips.viralThreshold);
  if (filter==='pending') filtered=all.filter(c=>!c.uploaded);
  res.json(filtered.slice(0,100));
});

webApp.get('/api/weekly-stats', requireAdmin, (req,res)=>{
  const list=[];
  for (const [uid,ws] of storage.weeklyStats.entries()) {
    const score=(ws.streams||0)*10+(ws.peakViewers||0)+(ws.clips||0)*5+(ws.boostPoints||0);
    list.push({uid,score,...ws});
  }
  res.json(list.sort((a,b)=>b.score-a.score));
});

webApp.get('/api/schedules', requireAdmin, (req,res)=>{
  const list=[];
  for (const [uid,schedules] of storage.streamSchedules.entries()) list.push({uid,schedules});
  res.json(list);
});

webApp.get('/api/tournaments', requireAdmin, (req,res)=>{
  res.json([...storage.tournaments.values()].sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0)));
});

webApp.get('/api/bets', requireAdmin, (req,res)=>{
  res.json([...storage.bets.values()].sort((a,b)=>new Date(b.startedAt||0)-new Date(a.startedAt||0)).slice(0,50));
});

webApp.get('/api/pending-registrations', requireAdmin, (req,res)=>{
  res.json([...storage.pendingRegistrations.entries()].map(([uid,d])=>({uid,...d})));
});

webApp.get('/api/rewards', requireAdmin, (req,res)=>{
  const list=[];
  for (const [uid,rewards] of storage.rewards.entries()) list.push({uid,rewards});
  res.json(list);
});

webApp.get('/admin/logs', requireAdmin, (req,res)=>{
  res.json({logs:webLogs.slice(-200)});
});

webApp.get('/admin/find-member', requireAdmin, async (req,res)=>{
  const q=(req.query.q||'').toLowerCase().trim();
  if (!q) return res.json([]);
  try {
    const guild=client.guilds.cache.get(config.discord.guildId);
    if (!guild) return res.json([]);
    const members=await guild.members.fetch({limit:1000}).catch(()=>new Map());
    const results=[];
    for (const [id,m] of members.entries()) {
      if (results.length>=8) break;
      const dn=m.displayName.toLowerCase(), un=m.user.username.toLowerCase();
      if (dn.includes(q)||un.includes(q)||id===q) {
        results.push({ id, displayName:m.displayName, username:m.user.username, avatar:m.user.displayAvatarURL({size:64}), isRegistered:storage.streamers.has(id), hasStreamerRole:config.discord.streamerRoleId?m.roles.cache.has(config.discord.streamerRoleId):false });
      }
    }
    res.json(results);
  } catch(e) { res.json([]); }
});

webApp.post('/admin/verify-platforms', requireAdmin, async (req,res)=>{
  const {platforms}=req.body||{};
  if (!platforms) return res.status(400).json({error:'Falta platforms'});
  const results={};
  await Promise.allSettled(Object.entries(platforms).map(async([p,u])=>{ if (u) results[p]=await verifyPlatformUser(p,u); }));
  res.json(results);
});

webApp.post('/admin/register-streamer', requireAdmin, async (req,res)=>{
  const {userId,platforms,bio,color}=req.body||{};
  if (!userId) return res.status(400).json({error:'Falta userId'});
  try {
    const guild=client.guilds.cache.get(config.discord.guildId);
    const member=await guild?.members.fetch(userId).catch(()=>null);
    if (!member) return res.status(404).json({error:'Miembro no encontrado en el servidor'});
    if (storage.streamers.has(userId)) return res.status(409).json({error:'Ya está registrado'});
    const thread=await createStreamerThread(member,platforms||{},bio||'',color||'#9146FF');
    saveStorage();
    await member.send({content:`🎉 ¡Has sido registrado como streamer de **El Patio RP** desde el panel! Hilo: <#${thread.id}>`}).catch(()=>{});
    res.json({ok:true,threadId:thread.id,displayName:member.displayName});
  } catch(e) { res.status(500).json({error:e.message}); }
});

webApp.delete('/admin/streamer/:userId', requireAdmin, async (req,res)=>{
  const uid=req.params.userId;
  if (!storage.streamers.has(uid)) return res.status(404).json({error:'No encontrado'});
  storage.streamers.delete(uid);
  storage.threads.delete(uid);
  storage.clips.delete(uid);
  storage.weeklyStats.delete(uid);
  storage.rewards.delete(uid);
  saveStorage();
  // Quitar rol
  try {
    const guild=client.guilds.cache.get(config.discord.guildId);
    const member=await guild?.members.fetch(uid).catch(()=>null);
    if (member&&config.discord.streamerRoleId) await member.roles.remove(config.discord.streamerRoleId).catch(()=>{});
  } catch {}
  res.json({ok:true});
});

// ── RUTAS SOLO ADMIN ────────────────────────────────────────────────────────
webApp.post('/api/approve-registration/:uid', requireAdminOnly, async (req,res)=>{
  try {
    const {uid}=req.params;
    const pending=storage.pendingRegistrations.get(uid);
    if (!pending) return res.status(404).json({error:'Solicitud no encontrada'});
    const guild=client.guilds.cache.get(config.discord.guildId);
    const member=await guild?.members.fetch(uid).catch(()=>null);
    if (!member) return res.status(404).json({error:'Miembro no encontrado en el servidor'});
    const thread=await createStreamerThread(member,pending.platforms,pending.bio,'#9146FF');
    storage.pendingRegistrations.delete(uid); saveStorage();
    await member.send({content:`🎉 ¡Tu solicitud fue aprobada desde el panel! Ya eres streamer de **El Patio RP**. Hilo: <#${thread.id}>`}).catch(()=>{});
    res.json({ok:true,threadId:thread.id,displayName:member.displayName});
  } catch(e) { res.status(500).json({error:e.message}); }
});

webApp.post('/api/reject-registration/:uid', requireAdminOnly, (req,res)=>{
  storage.pendingRegistrations.delete(req.params.uid); saveStorage();
  res.json({ok:true});
});

webApp.post('/api/config', requireAdminOnly, (req,res)=>{
  const {cooldownMinutes,checkInterval,viralThreshold,minViewers}=req.body||{};
  if (cooldownMinutes) config.notifications.cooldownMinutes=parseInt(cooldownMinutes);
  if (checkInterval)   config.notifications.checkInterval=parseInt(checkInterval)*1000;
  if (viralThreshold)  config.clips.viralThreshold=parseInt(viralThreshold);
  if (minViewers)      config.clips.minViewers=parseInt(minViewers);
  res.json({ok:true,config:{cooldownMinutes:config.notifications.cooldownMinutes,checkIntervalSec:config.notifications.checkInterval/1000,viralThreshold:config.clips.viralThreshold,minViewers:config.clips.minViewers}});
});

webApp.post('/api/send-top3', requireAdminOnly, async (req,res)=>{
  await enviarTop3Semanal().catch(()=>{});
  res.json({ok:true});
});

webApp.post('/admin/check-streams', requireAdmin, async (req,res)=>{
  await checkAllStreams().catch(()=>{});
  res.json({ok:true,liveCount:storage.liveStreams.size});
});

webApp.post('/api/add-coins', requireAdminOnly, (req,res)=>{
  const {userId,amount,reason}=req.body||{};
  if (!userId||!amount) return res.status(400).json({error:'Falta userId o amount'});
  const newBalance=addCoins(userId,parseInt(amount),reason||'Admin manual');
  saveStorage();
  res.json({ok:true,newBalance});
});

// ── SERVIR DASHBOARD y PORTAL ──────────────────────────────────────────────
webApp.get('/', (req,res)=>res.sendFile(path.join(__dirname,'dashboard.html')));
webApp.get('/portal', (req,res)=>res.sendFile(path.join(__dirname,'portal.html')));
webApp.get('/portal/:userId', (req,res)=>res.sendFile(path.join(__dirname,'portal.html')));

// ═══════════════════════════════════════════════════════════════════════════════
// ARRANQUE
// ═══════════════════════════════════════════════════════════════════════════════
client.once('ready', async () => {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   🔥 EL PATIO BOT STREAM v9.1 — ULTRA NOTIFIER   ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`✅ Bot: ${client.user.tag}`);
  console.log(`📡 Servidor: ${config.discord.guildId}`);
  console.log(`🏟️  Foro: ${config.discord.forumChannelId}`);
  console.log(`🔔 Canal lives: ${config.discord.liveChannelId}`);
  loadStorage();
  await registerCommands();
  setInterval(checkAllStreams,      config.notifications.checkInterval);
  setInterval(checkStreamSchedules, 60000);
  setInterval(checkWeeklySchedule,  60000);
  setInterval(checkTournaments,     60000);
  setInterval(saveStorage,          300000);
  setTimeout(checkAllStreams, 8000);
  console.log(`✅ Bot listo • Verificando cada ${config.notifications.checkInterval/1000}s`);
});

webApp.listen(config.port, ()=>{
  console.log(`🌐 Dashboard: http://localhost:${config.port}`);
  console.log(`📱 Portal streamers: http://localhost:${config.port}/portal`);
});

if (!config.discord.token) { console.error('❌ DISCORD_TOKEN no configurado en el .env'); process.exit(1); }
client.login(config.discord.token).catch(e=>{ console.error('❌ Error de login Discord:', e.message); process.exit(1); });
// ═══════════════════════════════════════════════════════════════════════════════
// 🔥 PATCH v9.0 — Agregar este bloque ANTES de webApp.listen(config.port, ...)
// Incluye: Torneos/Eventos · Tienda de Coins · Apuestas · Posts de Redes
// ═══════════════════════════════════════════════════════════════════════════════

// ── STORAGE NUEVAS COLECCIONES ───────────────────────────────────────────────
// Agrega estas líneas dentro del objeto `storage` existente:
/*
  tournaments:    new Map(), // id → tournamentObj
  shop:           new Map(), // uid → { purchases: [] }
  bets:           new Map(), // betId → betObj
  activeBets:     new Map(), // streamKey → betId
  posts:          [],        // últimos 50 posts de redes sociales
  pendingSubs:    new Map(), // uid → [streamerIds] (notificaciones personalizadas)
*/
// Y en saveStorage() / loadStorage() agrega los nuevos mapas igual que los demás.

// ══════════════════════════════════════════════════════
// SECCIÓN A — TIENDA DE COINS
// ══════════════════════════════════════════════════════

const SHOP_ITEMS = [
  { id: 'vip_role',    name: '⭐ Rol VIP',           price: 500,  description: 'Rol VIP especial por 30 días', type: 'role' },
  { id: 'mention',     name: '📣 Mención especial',  price: 200,  description: 'El bot te menciona en el próximo live', type: 'mention' },
  { id: 'hilo_banner', name: '🎨 Banner en tu hilo', price: 300,  description: 'Imagen banner en tu hilo de foro', type: 'cosmetic' },
  { id: 'top_boost',   name: '🚀 Boost al Top 3',    price: 150,  description: '+50 puntos en el ranking semanal', type: 'boost' },
  { id: 'custom_color',name: '🎨 Color personalizado',price: 100, description: 'Cambia el color de tu card en el server', type: 'cosmetic' },
];

async function handleShop(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  const item   = interaction.options.getString('item');
  const coins  = getCoins(userId);

  if (!item) {
    // Ver tienda
    const embed = new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🛒 Tienda de El Patio RP')
      .setDescription(`💰 Tus coins: **${coins}**\n\nGana coins haciendo stream (10 coins/hora) y teniendo clips virales.\nUsa \`/tienda comprar <item>\` para comprar.`)
      .addFields(SHOP_ITEMS.map(i => ({
        name: `${i.name} — ${i.price} 🪙`,
        value: i.description,
        inline: true,
      })))
      .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
  }

  const shopItem = SHOP_ITEMS.find(i => i.id === item);
  if (!shopItem) return interaction.editReply({ content: '❌ Item no encontrado.' });
  if (coins < shopItem.price)
    return interaction.editReply({ content: `❌ No tienes suficientes coins. Tienes **${coins}** y necesitas **${shopItem.price}**.` });

  // Realizar compra
  addCoins(userId, -shopItem.price, `Compra: ${shopItem.name}`);
  const purchases = storage.shop.get(userId) || { purchases: [] };
  purchases.purchases.push({ item: shopItem.id, date: new Date().toISOString(), price: shopItem.price });
  storage.shop.set(userId, purchases);

  // Aplicar efecto
  if (shopItem.type === 'role' && process.env.SHOP_VIP_ROLE_ID) {
    const guild  = client.guilds.cache.get(config.discord.guildId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      await member.roles.add(process.env.SHOP_VIP_ROLE_ID).catch(() => {});
      // Remover rol después de 30 días
      setTimeout(async () => {
        await member.roles.remove(process.env.SHOP_VIP_ROLE_ID).catch(() => {});
      }, 30 * 24 * 60 * 60 * 1000);
    }
  }

  if (shopItem.type === 'boost') {
    const ws = storage.weeklyStats.get(userId) || { streams:0, totalViewers:0, peakViewers:0, clips:0 };
    ws.boostPoints = (ws.boostPoints || 0) + 50;
    storage.weeklyStats.set(userId, ws);
  }

  saveStorage();

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('✅ Compra exitosa!')
    .setDescription(`Compraste **${shopItem.name}** por **${shopItem.price} 🪙**\n\n${shopItem.description}\n\n💰 Coins restantes: **${getCoins(userId)}**`)
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════
// SECCIÓN B — SISTEMA DE APUESTAS
// ══════════════════════════════════════════════════════

async function handleApostar(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const userId   = interaction.user.id;
  const targetId = interaction.options.getUser('streamer').id;
  const amount   = interaction.options.getInteger('coins');
  const coins    = getCoins(userId);

  if (amount < 10)   return interaction.editReply({ content: '❌ Apuesta mínima: **10 coins**' });
  if (coins < amount) return interaction.editReply({ content: `❌ No tienes suficientes coins. Tienes **${coins}**.` });

  // Buscar apuesta activa para este streamer
  const liveKey = [...storage.liveStreams.keys()].find(k => k.includes(targetId));
  if (!liveKey) return interaction.editReply({ content: '❌ Ese streamer no está en vivo ahora mismo. Solo puedes apostar a streamers en vivo.' });

  let betId = storage.activeBets.get(liveKey);
  if (!betId) {
    betId = `bet-${Date.now()}-${targetId}`;
    storage.activeBets.set(liveKey, betId);
    storage.bets.set(betId, {
      id: betId, streamKey: liveKey, streamerId: targetId,
      startViewers: storage.liveStreams.get(liveKey)?.currentViewers || 0,
      participants: {}, totalPool: 0,
      startedAt: new Date().toISOString(), resolved: false,
    });
  }

  const bet = storage.bets.get(betId);
  if (bet.resolved) return interaction.editReply({ content: '❌ Esta apuesta ya cerró.' });
  if (bet.participants[userId]) return interaction.editReply({ content: '⚠️ Ya apostaste en este stream. Solo una apuesta por stream.' });

  addCoins(userId, -amount, `Apuesta en ${targetId}`);
  bet.participants[userId] = { amount, placedAt: new Date().toISOString() };
  bet.totalPool += amount;
  storage.bets.set(betId, bet);
  saveStorage();

  const guild  = client.guilds.cache.get(config.discord.guildId);
  const target = await guild.members.fetch(targetId).catch(() => null);

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle('🎲 ¡Apuesta registrada!')
      .setDescription(`Apostaste **${amount} 🪙** a que **${target?.displayName || 'el streamer'}** sube viewers.\n\nPool total: **${bet.totalPool} 🪙** entre ${Object.keys(bet.participants).length} participantes.\n\nSi el streamer sube viewers al terminar, los ganadores se reparten el pool proporcional.`)
      .setTimestamp()],
  });
}

async function resolveBets(streamKey, finalViewers) {
  const betId = storage.activeBets.get(streamKey);
  if (!betId) return;
  const bet = storage.bets.get(betId);
  if (!bet || bet.resolved) return;

  bet.resolved    = true;
  bet.finalViewers = finalViewers;
  const won = finalViewers > bet.startViewers;
  storage.bets.set(betId, bet);
  storage.activeBets.delete(streamKey);

  const guild = client.guilds.cache.get(config.discord.guildId);
  const ch    = guild?.channels.cache.get(config.discord.generalChannelId || config.discord.liveChannelId);

  if (won && bet.totalPool > 0) {
    const winners = Object.entries(bet.participants);
    winners.forEach(([uid, data]) => {
      const share = Math.floor((data.amount / bet.totalPool) * bet.totalPool * 1.9);
      addCoins(uid, share, `Ganaste apuesta — pool ${bet.totalPool}`);
    });
    if (ch) await ch.send({ embeds: [new EmbedBuilder()
      .setColor(0xFFD700)
      .setTitle('🎲 ¡Apuesta resuelta — GANARON!')
      .setDescription(`El streamer subió de **${bet.startViewers}** a **${finalViewers}** viewers.\n✅ Los ${winners.length} participantes reciben su parte del pool de **${bet.totalPool} 🪙**!`)
      .setTimestamp()] });
  } else if (ch) {
    await ch.send({ embeds: [new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle('🎲 Apuesta resuelta — perdieron')
      .setDescription(`El streamer no subió viewers (${bet.startViewers} → ${finalViewers}). Pool de **${bet.totalPool} 🪙** perdido.`)
      .setTimestamp()] });
  }

  saveStorage();
}

// Llama resolveBets() al detectar que un stream terminó.
// En checkAndNotify(), dentro del bloque "Stream terminado", agrega:
// await resolveBets(streamKey, liveData.currentViewers || 0);

// ══════════════════════════════════════════════════════
// SECCIÓN C — TORNEOS / EVENTOS
// ══════════════════════════════════════════════════════

async function handleCrearTorneo(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const nombre    = interaction.options.getString('nombre');
  const desc      = interaction.options.getString('descripcion') || '';
  const duracion  = interaction.options.getInteger('duracion_horas') || 24;
  const premio    = interaction.options.getInteger('premio_coins')   || 500;
  const metrica   = interaction.options.getString('metrica')         || 'viewers';

  const tourneyId = `torneo-${Date.now()}`;
  const endsAt    = new Date(Date.now() + duracion * 3600000).toISOString();

  storage.tournaments.set(tourneyId, {
    id: tourneyId, nombre, desc, metrica, premio, endsAt,
    createdBy: interaction.user.id,
    participants: {},
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  saveStorage();

  const guild = client.guilds.cache.get(config.discord.guildId);
  const ch    = guild?.channels.cache.get(config.discord.generalChannelId || config.discord.liveChannelId);

  const metricaLabel = { viewers: '👥 Más viewers', streams: '📺 Más streams', clips: '🎬 Más clips virales' }[metrica] || metrica;

  const embed = new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle(`🏟️ ¡NUEVO TORNEO — ${nombre}!`)
    .setDescription(desc || '¡El torneo ha comenzado! Que gane el mejor streamer.')
    .addFields(
      { name: '🎯 Métrica', value: metricaLabel, inline: true },
      { name: '🪙 Premio', value: `${premio} coins`, inline: true },
      { name: '⏰ Duración', value: `${duracion}h (termina <t:${Math.floor(new Date(endsAt).getTime()/1000)}:R>)`, inline: false },
    )
    .setFooter({ text: `ID: ${tourneyId} • Usa /unirse-torneo para participar` })
    .setTimestamp();

  if (ch) await ch.send({ content: '@everyone 🏟️ **¡Nuevo torneo en El Patio RP!**', embeds: [embed] });
  return interaction.editReply({ content: `✅ Torneo **${nombre}** creado. ID: \`${tourneyId}\`` });
}

async function handleUnirseTorneo(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  if (!storage.streamers.has(userId))
    return interaction.editReply({ content: '❌ Solo streamers registrados pueden participar en torneos.' });

  const activos = [...storage.tournaments.values()].filter(t => t.status === 'active');
  if (!activos.length) return interaction.editReply({ content: '❌ No hay torneos activos ahora mismo.' });

  const torneo = activos[0]; // Unirse al torneo más reciente activo
  if (torneo.participants[userId]) return interaction.editReply({ content: '✅ Ya estás inscrito en este torneo.' });

  torneo.participants[userId] = { joinedAt: new Date().toISOString(), score: 0 };
  storage.tournaments.set(torneo.id, torneo);
  saveStorage();

  return interaction.editReply({
    embeds: [new EmbedBuilder()
      .setColor(0xFF6B00)
      .setTitle(`🏟️ ¡Inscrito en ${torneo.nombre}!`)
      .setDescription(`Estás participando. La métrica es: **${torneo.metrica}**.\nPremio: **${torneo.premio} 🪙**.\nTermina: <t:${Math.floor(new Date(torneo.endsAt).getTime()/1000)}:R>`)
      .setTimestamp()],
  });
}

async function checkTournaments() {
  const now = Date.now();
  for (const [tid, t] of storage.tournaments.entries()) {
    if (t.status !== 'active') continue;
    if (new Date(t.endsAt).getTime() > now) continue;

    // Torneo terminado — calcular ganador
    t.status = 'finished';

    // Actualizar scores desde weeklyStats
    for (const uid of Object.keys(t.participants)) {
      const ws = storage.weeklyStats.get(uid) || {};
      t.participants[uid].score = t.metrica === 'viewers' ? (ws.peakViewers || 0)
        : t.metrica === 'streams' ? (ws.streams || 0)
        : (ws.clips || 0);
    }

    const sorted = Object.entries(t.participants).sort(([,a],[,b]) => b.score - a.score);
    const winnerId = sorted[0]?.[0];
    t.winnerId = winnerId;
    storage.tournaments.set(tid, t);

    if (winnerId) {
      addCoins(winnerId, t.premio, `Ganador torneo: ${t.nombre}`);
      const guild  = client.guilds.cache.get(config.discord.guildId);
      const ch     = guild?.channels.cache.get(config.discord.generalChannelId || config.discord.liveChannelId);
      const winner = await guild.members.fetch(winnerId).catch(() => null);
      if (ch) await ch.send({
        content: '@everyone 🏆 **¡Torneo finalizado!**',
        embeds: [new EmbedBuilder()
          .setColor(0xFFD700)
          .setTitle(`🏆 Ganador del torneo: ${t.nombre}`)
          .setDescription(`🥇 **${winner?.displayName || winnerId}** ganó **${t.premio} 🪙** con score **${sorted[0][1].score}**!`)
          .addFields({ name: '📊 Top 3', value: sorted.slice(0,3).map(([uid,d],i)=>`${['🥇','🥈','🥉'][i]} ${uid} — ${d.score}`).join('\n') || '—' })
          .setTimestamp()],
      });
    }
    saveStorage();
  }
}
// Agrega al setInterval loop: setInterval(checkTournaments, 60000);

// ══════════════════════════════════════════════════════
// SECCIÓN D — POSTS DE REDES SOCIALES (detector)
// ══════════════════════════════════════════════════════

async function checkSocialPosts() {
  for (const [userId, data] of storage.streamers.entries()) {
    const plats = data.platforms || {};

    // TikTok — verificar últimos videos
    if (plats.tiktok) {
      try {
        const r = await axios.get(`https://www.tiktok.com/@${plats.tiktok}`, {
          timeout: 12000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept-Language': 'es-ES,es;q=0.9' },
        });
        const html = r.data || '';
        // Extraer últimos videos del JSON embebido
        const itemMatch = html.match(/"ItemList":\{"Feed":\{"list":\[([^\]]+)\]/);
        if (itemMatch) {
          const videoMatches = [...html.matchAll(/"id":"(\d+)","desc":"([^"]{0,100})"/g)];
          for (const [, vid, desc] of videoMatches.slice(0, 3)) {
            const postKey = `tiktok-${userId}-${vid}`;
            if (storage.lastContentCheck.get(postKey)) continue;
            storage.lastContentCheck.set(postKey, Date.now());

            const postObj = {
              id: postKey, platform: 'tiktok', userId,
              streamer: data.displayName || userId,
              content: desc, url: `https://tiktok.com/@${plats.tiktok}/video/${vid}`,
              detectedAt: new Date().toISOString(),
            };
            if (!storage.posts) storage.posts = [];
            storage.posts.unshift(postObj);
            if (storage.posts.length > 100) storage.posts.pop();

            await sendPostNotification(userId, postObj, data);
          }
        }
      } catch { /* silencioso */ }
    }
    await new Promise(r => setTimeout(r, 2000)); // rate limit gentil
  }
}

async function sendPostNotification(userId, post, streamerData) {
  try {
    const guild   = client.guilds.cache.get(config.discord.guildId);
    const ch      = guild?.channels.cache.get(config.discord.postsChannelId || config.discord.notificationsChannelId);
    if (!ch) return;
    const member  = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const pColor = post.platform === 'tiktok' ? 0xFF0050 : 0xE1306C;
    const pEmoji = post.platform === 'tiktok' ? '⚫' : '📸';
    const pName  = post.platform === 'tiktok' ? 'TikTok' : 'Instagram';

    const embed = new EmbedBuilder()
      .setColor(pColor)
      .setAuthor({ name: `${pEmoji} Nueva publicación en ${pName}`, iconURL: member.user.displayAvatarURL() })
      .setTitle(member.displayName)
      .setURL(post.url)
      .setDescription(post.content || '¡Nueva publicación!')
      .setFooter({ text: `El Patio RP • ${pName}`, iconURL: client.user?.displayAvatarURL() })
      .setTimestamp();

    const btn = new ButtonBuilder().setLabel(`${pEmoji} Ver en ${pName}`).setStyle(ButtonStyle.Link).setURL(post.url);
    const plats = streamerData?.platforms || {};
    const components = [new ActionRowBuilder().addComponents(btn)];
    if (plats.twitch) components[0].addComponents(new ButtonBuilder().setLabel('🟣 Twitch').setStyle(ButtonStyle.Link).setURL(`https://twitch.tv/${plats.twitch}`));

    await ch.send({ content: `${pEmoji} **${member.displayName}** publicó algo nuevo en **${pName}**!`, embeds: [embed], components });
    console.log(`📱 Post detectado: ${member.displayName} en ${pName}`);
  } catch (e) { logError('sendPostNotification', e); }
}
// Agregar al bot: setInterval(checkSocialPosts, 15 * 60 * 1000); // cada 15 min

// ══════════════════════════════════════════════════════
// SECCIÓN E — NUEVOS SLASH COMMANDS (agregar al array commands[])
// ══════════════════════════════════════════════════════

// Agrega estos al array commands[] antes del .map(cmd => cmd.toJSON()):
const newCommands = [
  new SlashCommandBuilder()
    .setName('tienda')
    .setDescription('Ver y comprar items con tus coins')
    .addStringOption(o => o.setName('item')
      .setDescription('Item a comprar')
      .addChoices(
        { name: '⭐ Rol VIP (500 🪙)',           value: 'vip_role' },
        { name: '📣 Mención especial (200 🪙)',   value: 'mention' },
        { name: '🎨 Banner en hilo (300 🪙)',     value: 'hilo_banner' },
        { name: '🚀 Boost al Top 3 (150 🪙)',     value: 'top_boost' },
        { name: '🎨 Color personalizado (100 🪙)', value: 'custom_color' },
      )),

  new SlashCommandBuilder()
    .setName('apostar')
    .setDescription('Apuesta coins a que un streamer en vivo sube de viewers')
    .addUserOption(o => o.setName('streamer').setDescription('Streamer al que apostar').setRequired(true))
    .addIntegerOption(o => o.setName('coins').setDescription('Cuántos coins apostar (mínimo 10)').setRequired(true).setMinValue(10)),

  new SlashCommandBuilder()
    .setName('mis-apuestas')
    .setDescription('Ver el historial de tus apuestas y coins'),

  new SlashCommandBuilder()
    .setName('crear-torneo')
    .setDescription('[Admin] Crear un torneo entre streamers')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('nombre').setDescription('Nombre del torneo').setRequired(true))
    .addStringOption(o => o.setName('metrica').setDescription('¿Qué se mide?').setRequired(true)
      .addChoices(
        { name: '👥 Más peak viewers', value: 'viewers' },
        { name: '📺 Más streams',      value: 'streams' },
        { name: '🎬 Más clips virales', value: 'clips'  },
      ))
    .addIntegerOption(o => o.setName('duracion_horas').setDescription('Duración en horas (default: 24)').setMinValue(1).setMaxValue(168))
    .addIntegerOption(o => o.setName('premio_coins').setDescription('Premio en coins (default: 500)').setMinValue(50))
    .addStringOption(o => o.setName('descripcion').setDescription('Descripción del torneo')),

  new SlashCommandBuilder()
    .setName('unirse-torneo')
    .setDescription('Unirte al torneo activo como competidor'),

  new SlashCommandBuilder()
    .setName('ver-torneo')
    .setDescription('Ver el estado del torneo activo y el ranking'),

  new SlashCommandBuilder()
    .setName('mis-coins')
    .setDescription('Ver tu saldo de coins y últimas transacciones'),
];
// → Luego en registerCommands(), cambia el array a: [...commands, ...newCommands]

// ══════════════════════════════════════════════════════
// SECCIÓN F — HANDLERS (agregar dentro del interactionCreate)
// ══════════════════════════════════════════════════════
// Pega estos casos dentro del if (interaction.isChatInputCommand()) { ... }

/*
if (commandName === 'tienda')         return handleShop(interaction);
if (commandName === 'apostar')        return handleApostar(interaction);
if (commandName === 'crear-torneo')   return handleCrearTorneo(interaction);
if (commandName === 'unirse-torneo')  return handleUnirseTorneo(interaction);

if (commandName === 'mis-coins') {
  await interaction.deferReply({ ephemeral: true });
  const coins = getCoins(interaction.user.id);
  const ec    = storage.economy.get(interaction.user.id) || { transactions: [] };
  const last5 = (ec.transactions || []).slice(-5).reverse();
  return interaction.editReply({ embeds: [new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('🪙 Tus Coins — El Patio RP')
    .setDescription(`💰 Saldo actual: **${coins} coins**`)
    .addFields(last5.length ? [{ name: '📋 Últimas transacciones', value: last5.map(t=>`\`${t.amount>0?'+':''}${t.amount}\` ${t.reason}`).join('\n') }] : [])
    .setFooter({ text: 'Ganas coins streamando y teniendo clips virales' }).setTimestamp()] });
}

if (commandName === 'mis-apuestas') {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  const myBets = [...storage.bets.values()].filter(b => b.participants[userId]);
  if (!myBets.length) return interaction.editReply({ content: '❌ No tienes apuestas registradas aún.' });
  const lines = myBets.map(b => {
    const won   = b.resolved && b.finalViewers > b.startViewers;
    const amt   = b.participants[userId]?.amount || 0;
    const state = b.resolved ? (won ? '✅ Ganaste' : '❌ Perdiste') : '⏳ En curso';
    return `${state} — **${amt} 🪙** en stream de \`${b.streamerId.slice(0,10)}\``;
  }).slice(-10);
  return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF9900).setTitle('🎲 Tus apuestas').setDescription(lines.join('\n')).setTimestamp()] });
}

if (commandName === 'ver-torneo') {
  await interaction.deferReply();
  const activos = [...storage.tournaments.values()].filter(t => t.status === 'active');
  if (!activos.length) return interaction.editReply({ content: '❌ No hay torneos activos.' });
  const t = activos[0];
  const sorted = Object.entries(t.participants).sort(([,a],[,b]) => b.score - a.score);
  return interaction.editReply({ embeds: [new EmbedBuilder()
    .setColor(0xFF6B00)
    .setTitle(`🏟️ ${t.nombre}`)
    .setDescription(t.desc || '')
    .addFields(
      { name: '🎯 Métrica', value: t.metrica, inline: true },
      { name: '🪙 Premio', value: `${t.premio} coins`, inline: true },
      { name: '⏰ Termina', value: `<t:${Math.floor(new Date(t.endsAt).getTime()/1000)}:R>`, inline: true },
      { name: `📊 Ranking (${sorted.length} participantes)`, value: sorted.slice(0,5).map(([uid,d],i)=>`${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} \`${uid.slice(0,15)}\` — ${d.score}`).join('\n') || 'Sin participantes' },
    ).setTimestamp()] });
}
*/

// ══════════════════════════════════════════════════════
// SECCIÓN G — NUEVOS ENDPOINTS EXPRESS (antes de webApp.listen)
// ══════════════════════════════════════════════════════

webApp.get('/api/posts', requireAdmin, (req, res) => {
  const posts = storage.posts || [];
  res.json(posts.slice(0, 50));
});

webApp.get('/api/tournaments', requireAdmin, (req, res) => {
  const list = [...storage.tournaments.values()].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

webApp.get('/api/bets', requireAdmin, (req, res) => {
  const list = [...storage.bets.values()].sort((a,b) => new Date(b.startedAt||0) - new Date(a.startedAt||0));
  res.json(list.slice(0, 50));
});

webApp.get('/api/pending-registrations', requireAdmin, (req, res) => {
  const list = [...storage.pendingRegistrations.entries()].map(([uid, d]) => ({ uid, ...d }));
  res.json(list);
});

webApp.post('/api/approve-registration/:uid', requireAdmin, async (req, res) => {
  try {
    const { uid } = req.params;
    const pending = storage.pendingRegistrations.get(uid);
    if (!pending) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const guild  = client.guilds.cache.get(config.discord.guildId);
    const member = await guild.members.fetch(uid).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Miembro no encontrado en el server' });
    const thread = await createStreamerThread(member, pending.platforms, pending.bio, '#9146FF');
    storage.pendingRegistrations.delete(uid);
    saveStorage();
    await member.send({ content: `🎉 ¡Tu solicitud fue aprobada desde el panel! Ya eres streamer de **El Patio RP**. Usa \`/mi-hilo\` para ver tu perfil.` }).catch(() => {});
    res.json({ ok: true, threadId: thread.id, displayName: member.displayName });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

webApp.post('/api/reject-registration/:uid', requireAdmin, (req, res) => {
  const { uid } = req.params;
  storage.pendingRegistrations.delete(uid);
  saveStorage();
  res.json({ ok: true });
});

webApp.post('/api/config', requireAdmin, (req, res) => {
  const { cooldownMinutes, checkInterval, viralThreshold, minViewers } = req.body;
  if (cooldownMinutes)  config.notifications.cooldownMinutes = parseInt(cooldownMinutes);
  if (checkInterval)    config.notifications.checkInterval   = parseInt(checkInterval) * 1000;
  if (viralThreshold)   config.clips.viralThreshold          = parseInt(viralThreshold);
  if (minViewers)       config.clips.minViewers              = parseInt(minViewers);
  console.log(`⚙️ Config actualizada desde dashboard: cooldown=${config.notifications.cooldownMinutes}min`);
  res.json({ ok: true, config: {
    cooldownMinutes: config.notifications.cooldownMinutes,
    checkIntervalSec: config.notifications.checkInterval / 1000,
    viralThreshold: config.clips.viralThreshold,
    minViewers: config.clips.minViewers,
  }});
});

// ══════════════════════════════════════════════════════
// VARIABLES .env NUEVAS
// ══════════════════════════════════════════════════════
/*
SHOP_VIP_ROLE_ID=id_del_rol_vip_en_discord
*/
