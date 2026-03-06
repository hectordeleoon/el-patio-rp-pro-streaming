// ═══════════════════════════════════════════════════════════════════════════════
//            🔥 EL PATIO BOT STREAM v9.5 — SEGURO Y CORREGIDO
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

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN SEGURA
// ═══════════════════════════════════════════════════════════════════════════════
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
  twitch:  { 
    clientId:     process.env.TWITCH_CLIENT_ID, 
    clientSecret: process.env.TWITCH_CLIENT_SECRET 
  },
  youtube: { 
    apiKey: process.env.YOUTUBE_API_KEY 
  },
  groq:    { 
    apiKey: process.env.GROQ_API_KEY, 
    model: 'llama-3.1-70b-versatile' 
  },
  notifications: {
    checkInterval:   parseInt(process.env.CHECK_INTERVAL) || 60000,
    cooldownMinutes: parseInt(process.env.NOTIFICATION_COOLDOWN) || 30,
    retryAttempts:   3, 
    retryDelay:      5000,
    enableTwitch:    process.env.ENABLE_TWITCH !== 'false',
    enableKick:      process.env.ENABLE_KICK !== 'false',
    enableTikTok:    process.env.ENABLE_TIKTOK !== 'false',
    enableYouTube:   process.env.ENABLE_YOUTUBE === 'true',
  },
  filters: {
    keywords: ['patio', 'elpatio', 'el patio', 'patiorp', 'patio rp', 'servidor patio'],
    allowedGames: ['gta', 'grand theft auto', 'gta v', 'gta rp', 'fivem', 'red dead redemption', 'rdr2', 'roleplay', 'rp'],
    strictMode: true
  },
  clips: {
    viralThreshold:      parseInt(process.env.VIRAL_SCORE_AUTO_PUBLISH_THRESHOLD || '70'),
    autoClipIntervalMin: parseInt(process.env.AUTO_CLIP_INTERVAL_MIN || '20'),
    minViewers:          parseInt(process.env.MIN_VIEWERS_TO_CLIP || '10'),
    autoGeneration:      process.env.FEATURE_AUTO_CLIP_GENERATION === 'true',
  },
  port:     parseInt(process.env.PORT || '3000'),
  adminKey: process.env.DASHBOARD_ADMIN_KEY,
  staffKey: process.env.DASHBOARD_STAFF_KEY,
  shopVipRoleId: process.env.SHOP_VIP_ROLE_ID || '',
};

// Validación de seguridad
if (!config.adminKey || config.adminKey.length < 10) {
  console.error('❌ CRÍTICO: DASHBOARD_ADMIN_KEY no definida o muy corta');
  process.exit(1);
}

if (!config.discord.token) {
  console.error('❌ CRÍTICO: DISCORD_TOKEN no definida');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS SERVER SETUP
// ═══════════════════════════════════════════════════════════════════════════════
const webApp = express();

// CORS habilitado
webApp.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-Admin-Key, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

webApp.use(express.json());
webApp.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════════════════════
// PLATAFORMAS Y DATOS (URLs CORREGIDAS - Sin espacios)
// ═══════════════════════════════════════════════════════════════════════════════
const PLATFORM_CONFIG = {
  twitch:  { 
    color:0x9146FF, emoji:'🟣', name:'Twitch',  
    icon:'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c1.png', 
    watchLabel:'Ver en Twitch',  liveLabel:'🔴 EN VIVO EN TWITCH',  
    urlBase:'https://twitch.tv/', 
    thumb:(u)=>`https://static-cdn.jtvnw.net/previews-ttv/live_user_${u}-1280x720.jpg?t=${Date.now()}` 
  },
  kick:    { 
    color:0x53FC18, emoji:'🟢', name:'Kick',    
    icon:'https://kick.com/favicon.ico',  
    watchLabel:'Ver en Kick',    liveLabel:'🔴 EN VIVO EN KICK',    
    urlBase:'https://kick.com/',  
    thumb:()=>null 
  },
  tiktok:  { 
    color:0xFF0050, emoji:'⚫', name:'TikTok',  
    icon:'https://www.tiktok.com/favicon.ico',  
    watchLabel:'Ver en TikTok',  liveLabel:'🔴 EN VIVO EN TIKTOK',  
    urlBase:'https://www.tiktok.com/@',  
    thumb:()=>null 
  },
  youtube: { 
    color:0xFF0000, emoji:'🔴', name:'YouTube', 
    icon:'https://www.youtube.com/favicon.ico',  
    watchLabel:'Ver en YouTube', liveLabel:'🔴 EN VIVO EN YOUTUBE', 
    urlBase:'https://youtube.com/@',  
    thumb:()=>null 
  },
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
  staffUsers:           new Map(),
};

let isSaving = false;
let saveQueued = false;

function saveStorage() {
  if (isSaving) {
    saveQueued = true;
    return;
  }
  isSaving = true;
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
      staffUsers:          Object.fromEntries(storage.staffUsers),
      pendingRegistrations: Object.fromEntries(storage.pendingRegistrations),
    };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(d, null, 2));
  } catch(e) { 
    console.error('❌ Error guardando storage:', e.message); 
  } finally {
    isSaving = false;
    if (saveQueued) {
      saveQueued = false;
      setTimeout(saveStorage, 100);
    }
  }
}

function loadStorage() {
  try {
    if (!fs.existsSync(STORAGE_FILE)) return console.log('⚠️ Sin storage previo');
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
    load(storage.pendingRegistrations, d.pendingRegistrations);
    if (d.posts) storage.posts = d.posts;
    if (d.staffUsers) load(storage.staffUsers, d.staffUsers);
    if (storage.threads.size === 0) {
      for (const [uid,sd] of storage.streamers.entries()) {
        if (sd.threadId) storage.threads.set(uid, sd.threadId);
      }
    }
    console.log(`✅ Storage cargado: ${storage.streamers.size} streamers`);
  } catch(e) { console.error('❌ Error cargando storage:', e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT
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

// HELPERS
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
// MIDDLEWARES Y RUTAS API
// ═══════════════════════════════════════════════════════════════════════════════

function requireAdmin(req, res, next) {
  const key = (req.headers['x-admin-key'] || req.query.key || req.body?.key || '').trim();
  if (key === config.adminKey) { req.role = 'admin'; req.userLevel = 3; return next(); }
  if (key === config.staffKey) { req.role = 'staff'; req.userLevel = 2; return next(); }
  return res.status(401).json({ error: 'No autorizado. Clave inválida.' });
}

function requireAdminOnly(req, res, next) {
  const key = req.headers['x-admin-key']||req.query.key||req.body?.key;
  if (key===config.adminKey) { req.role='admin'; req.userLevel=3; return next(); }
  return res.status(403).json({error:'Solo el admin principal puede hacer esto.'});
}

// ✅ Health check simple
webApp.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    discord: client.user ? 'connected' : 'disconnected'
  });
});

// ✅ Login - Devuelve la clave misma como "token" para el frontend
webApp.post('/api/login', (req, res) => {
  const key = req.body?.key?.trim();
  if (key === config.adminKey) return res.json({ success: true, role: 'admin', token: key });
  if (key === config.staffKey) return res.json({ success: true, role: 'staff', token: key });
  res.status(401).json({ success: false, error: 'Clave inválida' });
});

// ✅ Verify - Valida que la sesión sigue activa
webApp.get('/api/verify', (req, res) => {
  const key = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (key === config.adminKey || key === config.staffKey) {
    return res.json({ valid: true, role: key === config.adminKey ? 'admin' : 'staff' });
  }
  res.status(401).json({ valid: false, error: 'Sesión inválida' });
});

// ✅ Stats básicas
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

// ✅ Status público
webApp.get('/api/status', (req, res) => {
  res.json({
    bot: client.user?.tag || 'Desconectado',
    status: 'online', 
    ping: client.ws.ping, 
    uptime: Math.floor(process.uptime()),
    memory: fmtMem(), 
    version: '9.5',
    stats: { streamers: storage.streamers.size, liveNow: storage.liveStreams.size },
    config: { 
      enableTwitch: config.notifications.enableTwitch, 
      enableKick: config.notifications.enableKick, 
      enableTikTok: config.notifications.enableTikTok 
    },
  });
});

// ✅ Endpoint para el portal de streamers (público, solo lectura de datos propios)
webApp.get('/api/streamer/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const streamer = storage.streamers.get(uid);
    if (!streamer) return res.status(404).json({ error: 'Streamer no encontrado' });
    
    // Calcular ranking
    let rankPosition = null;
    let rankTotal = storage.streamers.size;
    const allStats = [...storage.weeklyStats.entries()].sort((a,b) => (b[1].peakViewers||0) - (a[1].peakViewers||0));
    const index = allStats.findIndex(([id]) => id === uid);
    if (index !== -1) rankPosition = index + 1;
    
    // Obtener clips del streamer
    const clips = storage.clips.get(uid) || [];
    
    res.json({
      ...streamer,
      uid,
      isLive: [...storage.liveStreams.keys()].some(k => k.includes(uid)),
      liveData: [...storage.liveStreams.entries()].find(([k]) => k.includes(uid))?.[1] || null,
      rankPosition,
      rankTotal,
      coins: getCoins(uid),
      clips: clips.slice(0, 10),
      viralClipsCount: clips.filter(c => c.viralScore >= 65).length
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Listar todos los streamers (protegido)
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

// ✅ Buscar miembros
webApp.get('/admin/find-member', requireAdmin, async (req, res) => {
  const q = (req.query.q || '').toLowerCase().trim();
  if (!q || q.length < 2) return res.status(400).json({ error: 'Mínimo 2 caracteres' });
  
  try {
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) return res.status(500).json({ error: 'Bot no conectado al servidor' });

    let results = [];
    
    // Buscar por ID exacto
    if (/^\d{17,20}$/.test(q)) {
      try {
        const member = await guild.members.fetch(q).catch(() => null);
        if (member && !member.user.bot) {
          return res.json([{
            id: member.id,
            displayName: member.displayName || member.user.username,
            username: member.user.username,
            avatar: member.user.displayAvatarURL({ size: 64 }),
            isRegistered: storage.streamers.has(member.id),
            hasStreamerRole: config.discord.streamerRoleId ? member.roles.cache.has(config.discord.streamerRoleId) : false
          }]);
        }
      } catch (e) {}
    }

    // Buscar en caché
    const cachedMembers = guild.members.cache.filter(m => {
      if (m.user.bot) return false;
      const displayName = (m.displayName || '').toLowerCase();
      const username = (m.user.username || '').toLowerCase();
      return displayName.includes(q) || username.includes(q);
    }).first(25);

    results = cachedMembers.map(m => ({
      id: m.id,
      displayName: m.displayName || m.user.username || 'Unknown',
      username: m.user.username || 'unknown',
      avatar: m.user.displayAvatarURL({ size: 64 }),
      isRegistered: storage.streamers.has(m.id),
      hasStreamerRole: config.discord.streamerRoleId ? m.roles.cache.has(config.discord.streamerRoleId) : false
    }));

    res.json(results);
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// ✅ Registrar streamer
webApp.post('/api/direct-register', requireAdmin, async (req, res) => {
  try {
    const { userId, platforms, bio, color } = req.body;
    if (!userId || !platforms) return res.status(400).json({ error: 'Faltan datos' });
    if (storage.streamers.has(userId)) return res.status(400).json({ error: 'Ya registrado' });
    
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) return res.status(500).json({ error: 'Bot no conectado' });
    
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const thread = await createStreamerThread(member, platforms, bio || 'Streamer de El Patio RP', color || '#9146FF');
    saveStorage();
    
    res.json({ success: true, threadId: thread.id, displayName: member.displayName });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Eliminar streamer
webApp.delete('/api/streamer/:uid', requireAdminOnly, async (req, res) => {
  try {
    const { uid } = req.params;
    if (!storage.streamers.has(uid)) return res.status(404).json({ error: 'Streamer no encontrado' });
    
    const threadId = storage.threads.get(uid);
    if (threadId) {
      const guild = client.guilds.cache.get(config.discord.guildId);
      const thread = await guild.channels.fetch(threadId).catch(() => null);
      if (thread) await thread.delete('Eliminado por admin');
    }
    
    storage.streamers.delete(uid);
    storage.threads.delete(uid);
    saveStorage();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ✅ Logs
webApp.get('/api/logs', requireAdmin, (req, res) => {
  res.json(webLogs.slice(-100));
});

// ✅ Force check
webApp.post('/api/check-now', requireAdmin, async (req, res) => {
  try {
    await checkAllStreams();
    res.json({ ok: true, liveNow: storage.liveStreams.size });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Catch-all para SPA
webApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
webApp.listen(config.port, '0.0.0.0', () => {
  console.log(`🌐 Dashboard activo en puerto ${config.port}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOT FUNCTIONS (URLs CORREGIDAS)
// ═══════════════════════════════════════════════════════════════════════════════

let twitchToken=null, twitchTokenExpiry=0;

async function getTwitchToken() {
  if (!config.twitch.clientId || config.twitch.clientId === 'tu_twitch_client_id') return null;
  if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;
  try {
    const r = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: { 
        client_id: config.twitch.clientId, 
        client_secret: config.twitch.clientSecret, 
        grant_type: 'client_credentials' 
      },
      timeout: 10000,
    });
    twitchToken = r.data.access_token;
    twitchTokenExpiry = Date.now() + (r.data.expires_in - 300) * 1000;
    return twitchToken;
  } catch(e) { 
    return null; 
  }
}

function extractUsername(platform, input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s.includes('http') && !s.includes('/')) return s.replace(/^@/, '').trim();

  const patterns = {
    twitch: [/twitch\.tv\/([^/?&#\s]+)/i],
    kick: [/kick\.com\/([^/?&#\s]+)/i],
    tiktok: [/tiktok\.com\/@?([^/?&#\s]+)/i],
    youtube: [/youtube\.com\/@([^/?&#\s]+)/i],
  };
  
  for (const pat of (patterns[platform] || [])) {
    const m = s.match(pat);
    if (m?.[1]) return m[1].replace(/\/$/, '').replace(/^@/, '').trim();
  }
  return s;
}

async function verifyPlatformUser(platform, rawInput) {
  const username = extractUsername(platform, rawInput);
  if (!username) return { exists: false, error: 'Usuario vacío' };
  
  if (platform === 'twitch') {
    const token = await getTwitchToken();
    if (!token) return { exists: false, error: 'Sin credenciales Twitch' };
    try {
      const r = await axios.get('https://api.twitch.tv/helix/users', {
        headers: { 'Client-ID': config.twitch.clientId, 'Authorization': `Bearer ${token}` },
        params: { login: username.toLowerCase() }, 
        timeout: 8000,
      });
      const u = r.data?.data?.[0];
      if (!u) return { exists: false, error: `"${username}" no existe` };
      return { exists: true, displayName: u.display_name, resolvedUsername: u.login };
    } catch(e) {
      return { exists: false, error: 'Error verificando Twitch' };
    }
  }
  
  if (platform === 'kick') {
    try {
      const r = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
        timeout: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      });
      const d = r.data?.data || r.data;
      if (!d?.id) return { exists: false, error: `"${username}" no existe en Kick` };
      return { exists: true, displayName: d.user?.username || username, resolvedUsername: username };
    } catch(e) {
      return { exists: false, error: 'Error verificando Kick' };
    }
  }
  
  return { exists: true, displayName: username, resolvedUsername: username };
}

async function checkTwitchStream(username) {
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
    if (!r.data.data?.length) return null;
    const s = r.data.data[0];
    return { 
      isLive: true, 
      title: s.title || 'Sin título', 
      game: s.game_name || 'Sin categoría', 
      viewers: s.viewer_count || 0,
      thumbnailUrl: s.thumbnail_url?.replace('{width}', '1280').replace('{height}', '720') + `?t=${Date.now()}`,
      startedAt: new Date(s.started_at), 
      streamUrl: `https://twitch.tv/${username}`, 
      platform: 'twitch' 
    };
  } catch(e) { return null; }
}

async function checkKickStream(username) {
  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/${username}/livestream`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    });
    if (!r.data?.data?.id && !r.data?.id) return null;
    const d = r.data.data || r.data;
    return { 
      isLive: true, 
      title: d.session_title || d.title || 'Sin título', 
      game: d.categories?.[0]?.name || 'Sin categoría',
      viewers: d.viewer_count || d.viewers_count || 0,
      startedAt: new Date(d.created_at || Date.now()), 
      streamUrl: `https://kick.com/${username}`, 
      platform: 'kick' 
    };
  } catch(e) { return null; }
}

async function checkTikTokLive(username) {
  const clean = username.replace('@', '').trim();
  try {
    const r = await axios.get(`https://www.tiktok.com/@${clean}/live`, {
      timeout: 15000,
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html'
      },
    });
    const html = r.data || '';
    const isLive = ['"isLiving":true', '"liveStatus":1'].some(s => html.includes(s));
    if (!isLive) return null;
    const vM = html.match(/"user_count":(\d+)/);
    return { 
      isLive: true, 
      title: `${clean} está en vivo en TikTok!`,
      game: 'TikTok Live', 
      viewers: vM ? parseInt(vM[1]) : 0,
      streamUrl: `https://www.tiktok.com/@${clean}/live`, 
      platform: 'tiktok' 
    };
  } catch { return null; }
}

async function getStreamData(platform, username) {
  switch(platform) {
    case 'twitch': return checkTwitchStream(username);
    case 'kick': return checkKickStream(username);
    case 'tiktok': return checkTikTokLive(username);
    default: return null;
  }
}

function isRelatedToPatioRP(streamData) {
  if (!config.filters.strictMode) return true;
  const title = (streamData.title || '').toLowerCase();
  const game = (streamData.game || '').toLowerCase();
  const isAllowedGame = config.filters.allowedGames.some(g => game.includes(g.toLowerCase()));
  if (!isAllowedGame) return false;
  return true;
}

async function createStreamerThread(member, platforms, bio, color) {
  const guild = client.guilds.cache.get(config.discord.guildId);
  const forumChannel = guild?.channels.cache.get(config.discord.forumChannelId);

  if (!forumChannel) throw new Error('Canal de foro no encontrado');

  const embed = new EmbedBuilder()
    .setColor(color || '#9146FF')
    .setTitle(`🎮 ${member.displayName}`)
    .setThumbnail(member.user.displayAvatarURL({ forceStatic: false, size: 256 }))
    .setDescription(bio || '*Streamer de El Patio RP*');

  let platText = '';
  if (platforms?.twitch) platText += `🟣 **Twitch:** [${platforms.twitch}](https://twitch.tv/${platforms.twitch})\n`;
  if (platforms?.kick) platText += `🟢 **Kick:** [${platforms.kick}](https://kick.com/${platforms.kick})\n`;
  if (platforms?.tiktok) platText += `⚫ **TikTok:** [@${platforms.tiktok}](https://tiktok.com/@${platforms.tiktok})\n`;
  if (platText) embed.addFields({ name: '📺 Plataformas', value: platText });

  const thread = await forumChannel.threads.create({
    name: `🎮 ${member.displayName}`,
    message: { embeds: [embed] },
    reason: 'Nuevo streamer registrado',
  });

  storage.threads.set(member.id, thread.id);
  storage.streamers.set(member.id, {
    platforms: platforms || {},
    bio: bio || '',
    color: color || '#9146FF',
    threadId: thread.id,
    createdAt: Date.now(),
    displayName: member.displayName,
    stats: { totalStreams: 0, totalHours: 0, avgViewers: 0, peakViewers: 0, viralClips: 0, lastStream: null },
  });

  if (config.discord.streamerRoleId) {
    await member.roles.add(config.discord.streamerRoleId).catch(() => {});
  }

  return thread;
}

async function sendLiveNotification(platform, member, username, streamData, streamerData) {
  try {
    if (!isRelatedToPatioRP(streamData)) return;
    
    const guild = client.guilds.cache.get(config.discord.guildId);
    const channel = guild?.channels.cache.get(config.discord.liveChannelId);
    if (!channel) return;

    const p = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.twitch;
    const streamUrl = `${p.urlBase}${username}`;
    const plats = streamerData?.platforms || {};

    const embed = new EmbedBuilder()
      .setColor(p.color)
      .setAuthor({ name: p.liveLabel, iconURL: p.icon })
      .setTitle(member.displayName)
      .setURL(streamUrl)
      .setDescription(`**${streamData.title || '¡En vivo!'}**`)
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setTimestamp();

    embed.addFields(
      { name: '🎮 Juego', value: streamData.game || 'Sin categoría', inline: true },
      { name: '👥 Espectadores', value: String(streamData.viewers || 0), inline: true }
    );

    const mainBtn = new ButtonBuilder().setLabel(`${p.emoji} ${p.watchLabel}`).setStyle(ButtonStyle.Link).setURL(streamUrl);
    const extraBtns = [];
    
    if (platform !== 'twitch' && plats.twitch) 
      extraBtns.push(new ButtonBuilder().setLabel('🟣 Twitch').setStyle(ButtonStyle.Link).setURL(`https://twitch.tv/${plats.twitch}`));
    if (platform !== 'kick' && plats.kick) 
      extraBtns.push(new ButtonBuilder().setLabel('🟢 Kick').setStyle(ButtonStyle.Link).setURL(`https://kick.com/${plats.kick}`));

    const components = [new ActionRowBuilder().addComponents(mainBtn)];
    if (extraBtns.length) components.push(new ActionRowBuilder().addComponents(...extraBtns.slice(0, 4)));

    const mentionRole = config.discord.streamerRoleId ? `<@&${config.discord.streamerRoleId}>` : '';
    await channel.send({ 
      content: `@everyone ${mentionRole} ¡**${member.displayName}** está en vivo en **${p.name}**! ${p.emoji}`, 
      embeds: [embed], 
      components 
    });
  } catch(e) { logError('sendLiveNotification', e); }
}

async function checkAndNotify(platform, userId, username, member, streamerData) {
  const streamKey = `${platform}-${userId}`;
  const wasLive = storage.liveStreams.has(streamKey);

  if (wasLive) {
    const streamData = await getStreamData(platform, username);
    if (!streamData?.isLive) {
      storage.liveStreams.delete(streamKey);
      saveStorage();
      return false;
    }
    return true;
  }

  const streamData = await getStreamData(platform, username);
  if (!streamData?.isLive) return false;

  storage.liveStreams.set(streamKey, {
    startedAt: new Date().toISOString(),
    viewers: streamData.viewers,
    platform,
    title: streamData.title
  });

  await sendLiveNotification(platform, member, username, streamData, streamerData);
  saveStorage();
  return true;
}

async function checkAllStreams() {
  console.log(`🔍 Verificando ${storage.streamers.size} streamers...`);
  for (const [userId, data] of storage.streamers.entries()) {
    try {
      const guild = client.guilds.cache.get(config.discord.guildId);
      if (!guild) continue;
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) continue;
      
      const plats = data.platforms || {};
      if (config.notifications.enableTwitch && plats.twitch) 
        await checkAndNotify('twitch', userId, plats.twitch, member, data);
      if (config.notifications.enableKick && plats.kick) 
        await checkAndNotify('kick', userId, plats.kick, member, data);
    } catch(e) { logError(`check ${userId}`, e); }
  }
}

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Verifica latencia del bot'),
  new SlashCommandBuilder().setName('live').setDescription('Ver quién está en vivo'),
  new SlashCommandBuilder().setName('stats').setDescription('Estadísticas').addUserOption(o => o.setName('usuario').setDescription('Streamer')),
  new SlashCommandBuilder().setName('quiero-ser-streamer').setDescription('Solicitar ser streamer')
    .addStringOption(o => o.setName('twitch').setDescription('Usuario Twitch'))
    .addStringOption(o => o.setName('kick').setDescription('Usuario Kick')),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  try {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    await rest.put(Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId), { body: commands });
    console.log(`✅ ${commands.length} comandos registrados`);
  } catch(e) { console.error('❌ Error registrando comandos:', e.message); }
}

client.once('ready', async () => {
  console.log(`🤖 ${client.user.tag} listo!`);
  loadStorage();
  await registerCommands();
  setInterval(checkAllStreams, config.notifications.checkInterval);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  
  if (interaction.commandName === 'ping') {
    return interaction.reply({ 
      embeds: [new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🏓 Pong!')
        .addFields(
          { name: 'Latencia', value: `${client.ws.ping}ms`, inline: true },
          { name: 'Streamers', value: `${storage.streamers.size}`, inline: true }
        )
      ], 
      ephemeral: true 
    });
  }
  
  if (interaction.commandName === 'quiero-ser-streamer') {
    await interaction.deferReply({ ephemeral: true });
    const rawPlatforms = {
      twitch: interaction.options.getString('twitch'),
      kick: interaction.options.getString('kick'),
    };
    
    const platforms = {};
    for (const [k, v] of Object.entries(rawPlatforms)) {
      if (v) platforms[k] = extractUsername(k, v);
    }
    
    storage.pendingRegistrations.set(interaction.user.id, {
      userId: interaction.user.id,
      platforms,
      requestedAt: new Date().toISOString(),
      displayName: interaction.member.displayName
    });
    saveStorage();
    
    await interaction.editReply('✅ Solicitud enviada. Un admin revisará tu solicitud.');
  }
});

process.on('SIGINT', () => {
  saveStorage();
  client.destroy();
  process.exit(0);
});

client.login(config.discord.token).catch(e => {
  console.error('❌ Error login:', e.message);
  process.exit(1);
});
