// ═══════════════════════════════════════════════════════════════════════════════
//            🔥 EL PATIO BOT STREAM v9.2 — ULTRA NOTIFIER COMPLETO
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
// CONFIGURACIÓN
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
  port:     parseInt(process.env.PORT || '3000'),
  adminKey: process.env.DASHBOARD_ADMIN_KEY || 'Leoon272113',
  staffKey: process.env.DASHBOARD_STAFF_KEY || 'staff-elpatio-2026',
  shopVipRoleId: process.env.SHOP_VIP_ROLE_ID || '',
};

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS SERVER SETUP (INICIO INMEDIATO)
// ═══════════════════════════════════════════════════════════════════════════════
const webApp = express();
webApp.use(express.json());
webApp.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════════════════════════════════════
// PLATAFORMAS Y DATOS
// ═══════════════════════════════════════════════════════════════════════════════
const PLATFORM_CONFIG = {
  twitch:  { color:0x9146FF, emoji:'🟣', name:'Twitch',  icon:'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c1.png ', watchLabel:'Ver en Twitch',  liveLabel:'🔴 EN VIVO EN TWITCH',  urlBase:'https://twitch.tv/ ', thumb:(u)=>`https://static-cdn.jtvnw.net/previews-ttv/live_user_ ${u}-1280x720.jpg?t=${Date.now()}` },
  kick:    { color:0x53FC18, emoji:'🟢', name:'Kick',    icon:'https://kick.com/favicon.ico ', watchLabel:'Ver en Kick',    liveLabel:'🔴 EN VIVO EN KICK',    urlBase:'https://kick.com/ ', thumb:()=>null },
  tiktok:  { color:0xFF0050, emoji:'⚫', name:'TikTok',  icon:'https://www.tiktok.com/favicon.ico ', watchLabel:'Ver en TikTok',  liveLabel:'🔴 EN VIVO EN TIKTOK',  urlBase:'https://www.tiktok.com/@ ', thumb:()=>null },
  youtube: { color:0xFF0000, emoji:'🔴', name:'YouTube', icon:'https://www.youtube.com/favicon.ico ', watchLabel:'Ver en YouTube', liveLabel:'🔴 EN VIVO EN YOUTUBE', urlBase:'https://youtube.com/@ ', thumb:()=>null },
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
      staffUsers:          Object.fromEntries(storage.staffUsers),
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

// Auth middlewares
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

// Ruta de prueba
webApp.get('/test', (req, res) => {
  res.json({ message: 'OK', adminKey: config.adminKey, timestamp: new Date().toISOString() });
});

// Login POST
webApp.post('/api/login', (req, res) => {
  const key = req.body?.key?.trim();
  if (key === config.adminKey) return res.json({ success: true, role: 'admin' });
  if (key === config.staffKey) return res.json({ success: true, role: 'staff' });
  res.status(401).json({ success: false, error: 'Clave inválida' });
});

// Stats para dashboard
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

// Status público
webApp.get('/api/status', (req, res) => {
  res.json({
    bot: client.user?.tag || 'Desconectado',
    status: 'online', 
    ping: client.ws.ping, 
    uptime: Math.floor(process.uptime()),
    memory: fmtMem(), 
    version: '9.2',
    stats: { streamers: storage.streamers.size, liveNow: storage.liveStreams.size },
    config: { enableTwitch: config.notifications.enableTwitch, enableKick: config.notifications.enableKick, enableTikTok: config.notifications.enableTikTok },
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

// Ruta para buscar miembros
webApp.get('/admin/find-member', requireAdmin, async (req,res)=>{
  const q=(req.query.q||'').toLowerCase().trim();
  if (!q) return res.json([]);
  
  try {
    const guild=client.guilds.cache.get(config.discord.guildId);
    if (!guild) return res.status(500).json({error:'Bot no conectado al servidor'});
    
    let members;
    try {
      members = await guild.members.fetch({query: q, limit: 10});
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
    
    const results=[];
    for (const [id,m] of members.entries ? members.entries() : Object.entries(members)) {
      if (results.length>=10) break;
      results.push({ 
        id: m.id, 
        displayName: m.displayName || m.user?.username || 'Unknown', 
        username: m.user?.username || 'unknown', 
        avatar: m.user?.displayAvatarURL({size:64}) || '', 
        isRegistered: storage.streamers.has(m.id), 
        hasStreamerRole: config.discord.streamerRoleId ? m.roles?.cache.has(config.discord.streamerRoleId) : false 
      });
    }
    res.json(results);
  } catch(e) { res.status(500).json({error:e.message}); }
});

// Rutas protegidas
webApp.get('/api/clips', requireAdmin, (req,res)=>{
  const all=[];
  for (const [uid,clips] of storage.clips.entries()) clips.forEach(c=>all.push({...c,streamerId:uid}));
  res.json(all.sort((a,b)=>new Date(b.processedAt||0)-new Date(a.processedAt||0)).slice(0,100));
});

webApp.get('/api/pending-registrations', requireAdmin, (req,res)=>{
  res.json([...storage.pendingRegistrations.entries()].map(([uid,d])=>({uid,...d})));
});

webApp.post('/api/approve-registration/:uid', requireAdmin, async (req,res)=>{
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
    res.json({ ok: true, threadId: thread.id, displayName: member.displayName });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

webApp.post('/api/reject-registration/:uid', requireAdmin, (req, res) => {
  try {
    const { uid } = req.params;
    if (!storage.pendingRegistrations.has(uid)) return res.status(404).json({ error: 'Solicitud no encontrada' });
    storage.pendingRegistrations.delete(uid);
    saveStorage();
    res.json({ ok: true, message: 'Solicitud rechazada' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
    if (!storage.streamers.has(uid)) return res.status(404).json({ error: 'Streamer no encontrado' });
    
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
    storage.achievements.delete(uid);
    saveStorage();
    res.json({ ok: true, message: 'Streamer eliminado' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

webApp.post('/api/update-economy', requireAdmin, (req, res) => {
  try {
    const { uid, amount, reason } = req.body;
    if (!uid || !amount) return res.status(400).json({ error: 'Faltan datos' });
    const newBalance = addCoins(uid, parseInt(amount), reason || 'Ajuste manual por admin');
    res.json({ ok: true, newBalance, uid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

webApp.get('/api/economy/:uid', requireAdmin, (req, res) => {
  const { uid } = req.params;
  const data = storage.economy.get(uid) || { coins: 0, transactions: [] };
  res.json(data);
});

webApp.get('/api/stats/weekly', requireAdmin, (req, res) => {
  const stats = [];
  for (const [uid, data] of storage.weeklyStats.entries()) {
    const streamer = storage.streamers.get(uid);
    stats.push({
      uid,
      displayName: streamer?.displayName || uid,
      ...data
    });
  }
  res.json(stats.sort((a, b) => (b.peakViewers || 0) - (a.peakViewers || 0)));
});

webApp.post('/api/tournament', requireAdminOnly, (req, res) => {
  try {
    const { name, metric, duration, prize, description } = req.body;
    const id = Date.now().toString();
    storage.tournaments.set(id, {
      id,
      name,
      metric,
      startTime: Date.now(),
      endTime: Date.now() + (duration * 3600000),
      prize,
      description,
      participants: [],
      status: 'active'
    });
    saveStorage();
    res.json({ ok: true, tournamentId: id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

webApp.get('/api/tournaments', requireAdmin, (req, res) => {
  res.json([...storage.tournaments.values()]);
});

webApp.post('/api/broadcast', requireAdmin, async (req, res) => {
  try {
    const { message, channelType } = req.body;
    const guild = client.guilds.cache.get(config.discord.guildId);
    
    let channelId;
    switch(channelType) {
      case 'general': channelId = config.discord.generalChannelId; break;
      case 'live': channelId = config.discord.liveChannelId; break;
      case 'admin': channelId = config.discord.adminChannelId; break;
      default: channelId = config.discord.notificationsChannelId;
    }
    
    const channel = guild.channels.cache.get(channelId);
    if (!channel) return res.status(404).json({ error: 'Canal no encontrado' });
    await channel.send({ content: message });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

webApp.get('/api/logs', requireAdmin, (req, res) => {
  res.json(webLogs.slice(-100));
});

webApp.post('/api/config', requireAdminOnly, (req, res) => {
  try {
    const { checkInterval, cooldownMinutes } = req.body;
    if (checkInterval) config.notifications.checkInterval = parseInt(checkInterval);
    if (cooldownMinutes) config.notifications.cooldownMinutes = parseInt(cooldownMinutes);
    res.json({ ok: true, config: config.notifications });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Health check
webApp.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    discord: client.user ? 'connected' : 'disconnected',
    wsPing: client.ws.ping
  });
});

// RUTA CATCH-ALL - Para SPA
webApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════════
// INICIAR SERVIDOR HTTP (INMEDIATAMENTE)
// ═══════════════════════════════════════════════════════════════════════════════
webApp.listen(config.port, '0.0.0.0', () => {
  console.log(`🌐 Dashboard activo en puerto ${config.port}`);
  console.log(`📁 Sirviendo archivos desde: ${path.join(__dirname, 'public')}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// RESTO DEL CÓDIGO DEL BOT (SIN CAMBIOS)
// ═══════════════════════════════════════════════════════════════════════════════

// TWITCH TOKEN
let twitchToken=null, twitchTokenExpiry=0;
async function getTwitchToken() {
  if (!config.twitch.clientId||config.twitch.clientId==='tu_twitch_client_id') return null;
  if (twitchToken && Date.now()<twitchTokenExpiry) return twitchToken;
  try {
    const r = await axios.post('https://id.twitch.tv/oauth2/token ',null,{
      params:{ client_id:config.twitch.clientId, client_secret:config.twitch.clientSecret, grant_type:'client_credentials' },
      timeout:10000,
    });
    twitchToken      = r.data.access_token;
    twitchTokenExpiry= Date.now()+(r.data.expires_in-300)*1000;
    console.log('✅ Token Twitch renovado');
    return twitchToken;
  } catch(e) { logError('TwitchToken',e); return null; }
}

// EXTRACCIÓN DE USERNAME - CORREGIDO
function extractUsername(platform, input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;
  
  if (!s.includes('http') && !s.includes('/')) {
    return s.replace(/^@/, '').trim();
  }

  const patterns = {
    twitch:    [/twitch\.tv\/([^/?&#\s]+)/i],
    kick:      [/kick\.com\/([^/?&#\s]+)/i],
    tiktok:    [/tiktok\.com\/@?([^/?&#\s]+)/i],
    youtube:   [/youtube\.com\/@([^/?&#\s]+)/i, /youtube\.com\/channel\/([^/?&#\s]+)/i, /youtube\.com\/c\/([^/?&#\s]+)/i, /youtube\.com\/user\/([^/?&#\s]+)/i],
    instagram: [/instagram\.com\/([^/?&#\s]+)/i],
  };
  
  for (const pat of (patterns[platform]||[])) {
    const m = s.match(pat);
    if (m?.[1]) return m[1].replace(/\/$/, '').replace(/^@/, '').trim();
  }
  
  return s.replace(/^https?:\/\//i,'')
          .replace(/^www\./i,'')
          .replace(/^@/,'')
          .split('?')[0]
          .split('/')
          .filter(Boolean)
          .pop()?.trim() || s;
}

// VERIFICACIÓN DE PLATAFORMAS
async function verifyPlatformUser(platform, rawInput) {
  const username = extractUsername(platform, rawInput);
  if (!username||username.length<1) return { exists:false, error:'Usuario vacío o URL inválida' };
  const clean = username.replace(/^@/,'').toLowerCase().trim();

  try {
    if (platform === 'twitch') {
      const token = await getTwitchToken();
      if (!token) return { exists:false, error:'Sin credenciales Twitch' };
      const r = await axios.get('https://api.twitch.tv/helix/users ',{
        headers:{ 'Client-ID':config.twitch.clientId, 'Authorization':`Bearer ${token}` },
        params:{ login:clean }, timeout:8000,
      });
      const u = r.data?.data?.[0];
      if (!u) return { exists:false, error:`"${username}" no existe en Twitch` };
      return { exists:true, displayName:u.display_name, avatar:u.profile_image_url, verified:true, resolvedUsername:u.login, method:'Twitch API' };
    }

    if (platform === 'kick') {
      const r = await axios.get(`https://kick.com/api/v2/channels/ ${clean}`,{
        timeout:8000, headers:{ 'User-Agent':'Mozilla/5.0','Accept':'application/json' },
      });
      const d = r.data?.data || r.data;
      if (!d?.id) return { exists:false, error:`"${username}" no existe en Kick` };
      return { exists:true, displayName:d.user?.username||clean, avatar:d.user?.profile_pic||null, followers:d.followers_count||0, isLive:!!d.livestream, verified:true, resolvedUsername:clean, method:'Kick API' };
    }

    if (platform === 'tiktok') {
      try {
        const r = await axios.get(`https://www.tiktok.com/@ ${clean}`,{
          timeout:15000,
          headers:{ 
            'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language':'es-ES,es;q=0.9,en;q=0.8',
          },
          maxRedirects:5,
        });
        const html = r.data||'';
        if (r.status===404||html.includes('"statusCode":10202')||html.includes("Couldn't find this account"))
          return { exists:false, error:`@${username} no existe en TikTok` };
        
        const nameM = html.match(/"uniqueId":"([^"]+)"/);
        const nickM = html.match(/"nickname":"([^"]+)"/);
        const followM = html.match(/"followerCount":(\d+)/);
        
        if (nameM) {
          return {
            exists:true,
            displayName: nickM?nickM[1]:clean,
            followers: followM?parseInt(followM[1]):0,
            resolvedUsername: nameM[1],
            verified:true, method:'TikTok Web'
          };
        }
      } catch(e) {
        if (e.response?.status === 404) return { exists:false, error:`@${username} no existe en TikTok` };
      }
      return { exists:true, displayName:clean, resolvedUsername:clean, warning:'⚠️ Verificación parcial', method:'Parcial' };
    }

    if (platform === 'youtube') {
      const handle = clean.startsWith('@')?clean.slice(1):clean;
      if (config.youtube.apiKey && config.youtube.apiKey !== 'tu_youtube_api_key') {
        try {
          const r = await axios.get('https://www.googleapis.com/youtube/v3/channels ',{
            params:{ part:'snippet,statistics', forHandle:handle, key:config.youtube.apiKey }, timeout:8000,
          });
          const ch = r.data?.items?.[0];
          if (ch) {
            return { exists:true, displayName:ch.snippet?.title, avatar:ch.snippet?.thumbnails?.default?.url, followers:parseInt(ch.statistics?.subscriberCount||0), verified:true, resolvedUsername:handle, method:'YouTube API' };
          }
        } catch(e) { }
      }
      try {
        const r = await axios.get(`https://www.youtube.com/@ ${handle}`,{timeout:10000,headers:{'User-Agent':'Mozilla/5.0'}});
        if (r.status===404) return { exists:false, error:`${username} no existe en YouTube` };
        return { exists:true, displayName:handle, resolvedUsername:handle, warning:'Verificación básica', method:'YouTube Scraping' };
      } catch(e) {
        return { exists:true, displayName:handle, resolvedUsername:handle, warning:'Sin verificar', method:'Sin verificar' };
      }
    }

    return { exists:true, displayName:username, resolvedUsername:clean };
  } catch(e) {
    if (e.response?.status===404) return { exists:false, error:`"${username}" no existe en ${platform}` };
    return { exists:true, displayName:username, resolvedUsername:clean, warning:`Error: ${e.message}`, method:'Error' };
  }
}

// DETECTORES DE STREAM
async function checkTwitchStream(username, retries=0) {
  const token = await getTwitchToken();
  if (!token) return null;
  try {
    const r = await axios.get('https://api.twitch.tv/helix/streams ',{
      headers:{ 'Client-ID':config.twitch.clientId, 'Authorization':`Bearer ${token}` },
      params:{ user_login:username.toLowerCase() }, timeout:10000,
    });
    if (!r.data.data?.length) return null;
    const s = r.data.data[0];
    return { isLive:true, title:s.title||'Sin título', game:s.game_name||'Sin categoría', viewers:s.viewer_count||0,
      thumbnailUrl:s.thumbnail_url?.replace('{width}','1280').replace('{height}','720')+`?t=${Date.now()}`,
      startedAt:new Date(s.started_at), streamUrl:`https://twitch.tv/ ${username}`, platform:'twitch' };
  } catch(e) {
    if (retries<config.notifications.retryAttempts) { await new Promise(r=>setTimeout(r,config.notifications.retryDelay)); return checkTwitchStream(username,retries+1); }
    return null;
  }
}

async function checkKickStream(username, retries=0) {
  try {
    const r = await axios.get(`https://kick.com/api/v2/channels/ ${username}/livestream`,{
      timeout:10000, headers:{ 'User-Agent':'Mozilla/5.0','Accept':'application/json' },
    });
    if (!r.data?.data?.id && !r.data?.id) return null;
    const d = r.data.data||r.data;
    return { isLive:true, title:d.session_title||d.title||'Sin título', game:d.categories?.[0]?.name||'Sin categoría',
      viewers:d.viewer_count||d.viewers_count||0, thumbnailUrl:d.thumbnail?.url||null,
      startedAt:new Date(d.created_at||Date.now()), streamUrl:`https://kick.com/ ${username}`, platform:'kick' };
  } catch(e) {
    if (retries<config.notifications.retryAttempts) { await new Promise(r=>setTimeout(r,config.notifications.retryDelay)); return checkKickStream(username,retries+1); }
    return null;
  }
}

async function checkTikTokLive(username) {
  const clean = username.replace('@','').trim();
  try {
    const r = await axios.get(`https://www.tiktok.com/@ ${clean}/live`,{
      timeout:15000,
      headers:{ 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'text/html','Referer':'https://www.tiktok.com/ ' },
    });
    const html = r.data||'';
    const isLive = ['"isLiving":true','"liveStatus":1','"status":2','"roomStatus":2','"living":true'].some(s=>html.includes(s));
    if (!isLive) return null;
    const vM = html.match(/"user_count":(\d+)/)||html.match(/"viewerCount":(\d+)/);
    const tM = html.match(/"title":"([^"]{5,100})"/) || html.match(/"live_title":"([^"]{5,100})"/);
    return { isLive:true, title:tM?tM[1].replace(/\\u0026/g,'&'):`${clean} está en vivo en TikTok!`,
      game:'TikTok Live', viewers:vM?parseInt(vM[1]):0, thumbnailUrl:null,
      startedAt:new Date(), streamUrl:`https://www.tiktok.com/@ ${clean}/live`, platform:'tiktok' };
  } catch { return null; }
}

async function checkYouTubeLive(channelHandle) {
  if (!config.youtube.apiKey||config.youtube.apiKey==='tu_youtube_api_key') return null;
  try {
    const h = channelHandle.replace('@','').trim();
    const sr = await axios.get('https://www.googleapis.com/youtube/v3/search ',{
      params:{ part:'snippet', q:h, type:'channel', key:config.youtube.apiKey, maxResults:1 }, timeout:10000,
    });
    if (!sr.data.items?.length) return null;
    const cid = sr.data.items[0].id.channelId;
    const lr  = await axios.get('https://www.googleapis.com/youtube/v3/search ',{
      params:{ part:'snippet', channelId:cid, eventType:'live', type:'video', key:config.youtube.apiKey, maxResults:1 }, timeout:10000,
    });
    if (!lr.data.items?.length) return null;
    const live = lr.data.items[0];
    return { isLive:true, title:live.snippet.title, game:'YouTube Live', viewers:0,
      thumbnailUrl:live.snippet.thumbnails?.high?.url||null,
      startedAt:new Date(live.snippet.publishedAt), streamUrl:`https://youtube.com/watch?v= ${live.id.videoId}`, platform:'youtube' };
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

// IA GROQ
async function askGroqAI(userPrompt, systemPrompt='Eres el asistente de El Patio RP. Responde en español.') {
  if (!config.groq.apiKey||config.groq.apiKey==='gsk_tu_groq_api_key') return null;
  try {
    const r = await axios.post('https://api.groq.com/openai/v1/chat/completions ',
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

// VALIDAR STREAMER EN EL SERVIDOR
async function validateStreamerInGuild(userId) {
  try {
    const guild  = client.guilds.cache.get(config.discord.guildId);
    if (!guild) return false;
    const member = await guild.members.fetch(userId).catch(()=>null);
    if (!member) {
      console.log(`⚠️ Usuario ${userId} NO está en el servidor El Patio RP`);
      return false;
    }
    const hasRole = config.discord.streamerRoleId ? member.roles.cache.has(config.discord.streamerRoleId) : false;
    const isReg   = storage.streamers.has(userId);
    if (!hasRole && !isReg) {
      console.log(`⚠️ ${member.displayName} no tiene rol streamer ni está registrado`);
      return false;
    }
    return true;
  } catch(e) { return false; }
}

// ANTI-SPAM
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

// ENVIAR NOTIFICACIÓN DE LIVE
async function sendLiveNotification(platform, member, username, streamData, streamerData) {
  try {
    const valid = await validateStreamerInGuild(member.id);
    if (!valid) {
      console.log(`🚫 Notificación bloqueada: ${member.displayName} no válido en El Patio RP`);
      return;
    }

    const guild   = client.guilds.cache.get(config.discord.guildId);
    const channel = guild?.channels.cache.get(config.discord.liveChannelId);
    if (!channel) return console.error(`❌ Canal de lives no encontrado`);

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
    if (platform!=='twitch'  && plats.twitch)    extraBtns.push(new ButtonBuilder().setLabel('🟣 Twitch').setStyle(ButtonStyle.Link).setURL(`https://twitch.tv/ ${plats.twitch}`));
    if (platform!=='kick'    && plats.kick)      extraBtns.push(new ButtonBuilder().setLabel('🟢 Kick').setStyle(ButtonStyle.Link).setURL(`https://kick.com/ ${plats.kick}`));
    if (platform!=='tiktok'  && plats.tiktok)    extraBtns.push(new ButtonBuilder().setLabel('⚫ TikTok').setStyle(ButtonStyle.Link).setURL(`https://www.tiktok.com/@ ${plats.tiktok}`));
    if (platform!=='youtube' && plats.youtube)   extraBtns.push(new ButtonBuilder().setLabel('🔴 YouTube').setStyle(ButtonStyle.Link).setURL(`https://youtube.com/@ ${plats.youtube}`));

    const components=[new ActionRowBuilder().addComponents(mainBtn)];
    if (extraBtns.length) components.push(new ActionRowBuilder().addComponents(...extraBtns.slice(0,4)));

    const mention = config.discord.streamerRoleId ? `<@&${config.discord.streamerRoleId}>` : '@everyone';
    await channel.send({ content:`${mention} ¡**${member.displayName}** está en vivo en **${p.name}**! ${p.emoji}`, embeds:[embed], components });

    const threadId = storage.threads.get(member.id);
    if (threadId) {
      const thread = guild.channels.cache.get(threadId);
      if (thread) await thread.send({ content:`🔴 ¡Estoy en vivo en ${p.name}!`, embeds:[embed] }).catch(()=>{});
    }
    console.log(`✅ Notificación enviada: ${member.displayName} en ${platform}`);
  } catch(e) { logError('sendLiveNotification', e); }
}

// RECOMPENSAS
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

// CREAR HILO DE FORO + ASIGNAR ROL AUTOMÁTICO
async function createStreamerThread(member, platforms, bio, color) {
  const guild        = client.guilds.cache.get(config.discord.guildId);
  const forumChannel = guild?.channels.cache.get(config.discord.forumChannelId);

  if (!forumChannel) {
    throw new Error(`Canal de foro no encontrado. ID: "${config.discord.forumChannelId}". Verifica DISCORD_FORUM_CHANNEL_ID en el .env`);
  }
  if (forumChannel.type !== ChannelType.GuildForum) {
    throw new Error(`El canal "${config.discord.forumChannelId}" no es de tipo Foro. Debe ser un canal Foro de Discord.`);
  }

  const streamerColor = color||'#9146FF';
  const embed = new EmbedBuilder()
    .setColor(streamerColor)
    .setTitle(`🎮 ${member.displayName}`)
    .setThumbnail(member.user.displayAvatarURL({forceStatic:false,size:256}))
    .setDescription(bio||'*Streamer de El Patio RP*');

  let platText='';
  if (platforms?.twitch)    platText+=`🟣 **Twitch:** [${platforms.twitch}](https://twitch.tv/ ${platforms.twitch})\n`;
  if (platforms?.kick)      platText+=`🟢 **Kick:** [${platforms.kick}](https://kick.com/ ${platforms.kick})\n`;
  if (platforms?.tiktok)    platText+=`⚫ **TikTok:** [@${platforms.tiktok}](https://tiktok.com/@ ${platforms.tiktok})\n`;
  if (platforms?.youtube)   platText+=`🔴 **YouTube:** [${platforms.youtube}](https://youtube.com/@ ${platforms.youtube})\n`;
  if (platforms?.instagram) platText+=`📸 **Instagram:** [@${platforms.instagram}](https://instagram.com/ ${platforms.instagram})\n`;
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
    createdAt:Date.now(), displayName: member.displayName,
    stats:{ totalStreams:0, totalHours:0, avgViewers:0, peakViewers:0, viralClips:0, lastStream:null },
  });

  if (config.discord.streamerRoleId) {
    try {
      await member.roles.add(config.discord.streamerRoleId);
      console.log(`✅ Rol streamer asignado a ${member.displayName}`);
    } catch(e) {
      console.error(`❌ Error asignando rol streamer: ${e.message}`);
    }
  }

  return thread;
}

// LOOP PRINCIPAL DE VERIFICACIÓN
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
  
  const isValidMember = await validateStreamerInGuild(userId);
  if (!isValidMember) {
    console.log(`🚫 Notificación bloqueada: ${member.displayName} no es miembro válido de El Patio RP`);
    return false;
  }
  
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
      if (!member) {
        console.log(`⚠️ Streamer ${userId} no encontrado en el servidor`);
        continue;
      }
      const plats=data.platforms||{};
      const checks=[];
      if (config.notifications.enableTwitch  && plats.twitch)  checks.push(checkAndNotify('twitch', userId,plats.twitch, member,data));
      if (config.notifications.enableKick    && plats.kick)    checks.push(checkAndNotify('kick',   userId,plats.kick,   member,data));
      if (config.notifications.enableTikTok  && plats.tiktok)  checks.push(checkAndNotify('tiktok', userId,plats.tiktok, member,data));
      if (config.notifications.enableYouTube && plats.youtube) checks.push(checkAndNotify('youtube',userId,plats.youtube,member,data));
      const results=await Promise.allSettled(checks);
      liveFound+=results.filter(r=>r.status==='fulfilled'&&r.value===true).length;
    } catch(e) { logError(`check ${userId}`,e); }
  }
  console.log(`✅ En vivo activos: ${storage.liveStreams.size}`);
}

// SLASH COMMANDS
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
    .addStringOption(o=>o.setName('metrica').setDescription('¿Qué se mide?').setRequired(true).addChoices({name:'👥 Más viewers',value:'viewers'},{name:'📺 Más streams',value:'streams'},{name:'🎬 Más clips virales',value:'clips'}))
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

// INTERACTIONS
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  try {
    if (commandName==='ping') {
      return interaction.reply({embeds:[new EmbedBuilder().setColor(client.ws.ping<100?0x00FF00:0xFFFF00).setTitle('🏓 Pong!').addFields({name:'📡 Latencia',value:`${client.ws.ping}ms`,inline:true},{name:'⏱️ Uptime',value:fmtUptime(process.uptime()),inline:true},{name:'🎮 Streamers',value:`${storage.streamers.size}`,inline:true},{name:'🔴 En Vivo',value:`${storage.liveStreams.size}`,inline:true}).setTimestamp()],ephemeral:true});
    }
    
    if (commandName==='registrar-streamer') {
      await interaction.deferReply({ephemeral:true});
      const target = interaction.options.getUser('usuario');
      const member = await interaction.guild.members.fetch(target.id).catch(()=>null);
      if (!member) return interaction.editReply({content:'❌ Usuario no encontrado en el servidor.'});
      if (storage.streamers.has(target.id)) return interaction.editReply({content:`⚠️ Ya registrado.`});
      
      const rawPlatforms={
        twitch:    interaction.options.getString('twitch')    ||null,
        kick:      interaction.options.getString('kick')      ||null,
        tiktok:    interaction.options.getString('tiktok')    ||null,
        youtube:   interaction.options.getString('youtube')   ||null,
        instagram: interaction.options.getString('instagram') ||null,
      };
      Object.keys(rawPlatforms).forEach(k=>{ if (!rawPlatforms[k]) delete rawPlatforms[k]; });
      if (!Object.keys(rawPlatforms).length) return interaction.editReply({content:'❌ Agrega al menos una plataforma.'});
      
      await interaction.editReply({content:'🔍 Verificando plataformas...'});
      const vRes={};
      await Promise.allSettled(Object.entries(rawPlatforms).map(async([p,u])=>{ vRes[p]=await verifyPlatformUser(p,u); }));
      const failed=Object.entries(vRes).filter(([,r])=>!r.exists);
      if (failed.length) return interaction.editReply({content:`❌ No encontrados:\n${failed.map(([p,r])=>`• **${p}**: ${r.error}`).join('\n')}`});
      
      const platforms={};
      for (const [p,r] of Object.entries(vRes)) platforms[p]=r.resolvedUsername||extractUsername(p,rawPlatforms[p]);
      
      try {
        const thread=await createStreamerThread(member,platforms,interaction.options.getString('biografia')||'',interaction.options.getString('color')||'#9146FF');
        saveStorage();
        return interaction.editReply({content:`✅ **${member.displayName}** registrado.\n📌 Hilo: <#${thread.id}>`});
      } catch(e) { return interaction.editReply({content:`❌ Error: ${e.message}`}); }
    }

    if (commandName==='quiero-ser-streamer') {
      await interaction.deferReply({ephemeral:true});
      if (storage.streamers.has(interaction.user.id)) return interaction.editReply({content:'✅ ¡Ya eres streamer!'});
      if (storage.pendingRegistrations.has(interaction.user.id)) return interaction.editReply({content:'⏳ Solicitud pendiente.'});
      
      const rawPlatforms={
        twitch: interaction.options.getString('twitch'),
        kick:   interaction.options.getString('kick'),
        tiktok: interaction.options.getString('tiktok'),
        youtube: interaction.options.getString('youtube'),
        instagram: interaction.options.getString('instagram'),
      };
      Object.keys(rawPlatforms).forEach(k=>{ if (!rawPlatforms[k]) delete rawPlatforms[k]; });
      if (!Object.keys(rawPlatforms).length) return interaction.editReply({content:'❌ Agrega al menos una plataforma (puedes pegar la URL completa).'});
      
      const vRes={};
      await Promise.allSettled(Object.entries(rawPlatforms).map(async([p,u])=>{ if(u) vRes[p]=await verifyPlatformUser(p,u); }));
      
      const platforms={};
      for (const [p,r] of Object.entries(vRes)) if(r?.exists) platforms[p]=r.resolvedUsername||extractUsername(p,rawPlatforms[p]);
      
      storage.pendingRegistrations.set(interaction.user.id,{
        userId:interaction.user.id, platforms, bio:interaction.options.getString('biografia')||'',
        verifyResults:vRes, requestedAt:new Date().toISOString(),
        displayName:interaction.member.displayName, avatar:interaction.user.displayAvatarURL()
      });
      saveStorage();
      
      const adminCh=interaction.guild.channels.cache.get(config.discord.adminChannelId);
      if (adminCh) {
        await adminCh.send({
          content:'🔔 **Nueva solicitud de streamer:**',
          embeds:[new EmbedBuilder().setColor(0xFFB700).setTitle(`📋 ${interaction.member.displayName}`).setDescription('Quiere unirse como streamer').setThumbnail(interaction.user.displayAvatarURL({size:128})).setTimestamp()],
          components:[new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`aprobar_${interaction.user.id}`).setLabel('✅ Aprobar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`rechazar_${interaction.user.id}`).setLabel('❌ Rechazar').setStyle(ButtonStyle.Danger),
          )],
        });
      }
      return interaction.editReply({content:'✅ **¡Solicitud enviada!** El staff revisará tu solicitud.'});
    }

    if (commandName==='tienda') {
      await interaction.deferReply({ephemeral:true});
      const item=interaction.options.getString('item');
      const coins=getCoins(interaction.user.id);
      if (!item) {
        return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('🛒 Tienda').setDescription(`💰 Tus coins: **${coins}**`).addFields(SHOP_ITEMS.map(i=>({name:`${i.name} — ${i.price} 🪙`,value:i.description,inline:true}))).setTimestamp()]});
      }
      const shopItem=SHOP_ITEMS.find(i=>i.id===item);
      if (!shopItem) return interaction.editReply({content:'❌ Item no encontrado.'});
      if (coins<shopItem.price) return interaction.editReply({content:`❌ Necesitas ${shopItem.price} 🪙`});
      addCoins(interaction.user.id,-shopItem.price,`Compra: ${shopItem.name}`);
      if (shopItem.type==='boost') {
        const ws=storage.weeklyStats.get(interaction.user.id)||{};
        ws.boostPoints=(ws.boostPoints||0)+50;
        storage.weeklyStats.set(interaction.user.id,ws);
      }
      saveStorage();
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xFFD700).setTitle('✅ Compra exitosa').setDescription(`Compraste **${shopItem.name}**\n💰 Restantes: **${getCoins(interaction.user.id)}**`).setTimestamp()]});
    }

  } catch(e) {
    console.error(e);
    if (interaction.deferred||interaction.replied) await interaction.editReply({content:`❌ Error: ${e.message}`}).catch(()=>{});
    else await interaction.reply({content:`❌ Error: ${e.message}`,ephemeral:true}).catch(()=>{});
  }
});

// Botones para aprobar/rechazar
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  const cid = interaction.customId;
  
  if (cid.startsWith('aprobar_')) {
    const uid = cid.replace('aprobar_','');
    const pending = storage.pendingRegistrations.get(uid);
    if (!pending) return interaction.reply({content:'❌ Solicitud no encontrada.',ephemeral:true});
    
    await interaction.deferReply({ephemeral:true});
    try {
      const member = await interaction.guild.members.fetch(uid).catch(()=>null);
      if (!member) return interaction.editReply({content:'❌ Usuario no encontrado.'});
      
      const thread = await createStreamerThread(member, pending.platforms, pending.bio, '#9146FF');
      storage.pendingRegistrations.delete(uid);
      saveStorage();
      
      await member.send({content:`🎉 ¡Aprobado! Ya eres streamer de El Patio RP. Hilo: <#${thread.id}>`}).catch(()=>{});
      await interaction.editReply({content:`✅ **${member.displayName}** aprobado. Hilo: <#${thread.id}>`});
    } catch(e) {
      await interaction.editReply({content:`❌ Error: ${e.message}`});
    }
  }
  
  if (cid.startsWith('rechazar_')) {
    const uid = cid.replace('rechazar_','');
    storage.pendingRegistrations.delete(uid);
    saveStorage();
    await interaction.reply({content:'🗑️ Solicitud rechazada.',ephemeral:true});
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOT EVENTS Y LOGIN (DESPUÉS DEL SERVIDOR)
// ═══════════════════════════════════════════════════════════════════════════════
client.once('clientReady', async () => {
  console.log(`🤖 ${client.user.tag} listo!`);
  console.log(`📊 Versión: 9.2 Ultra Notifier`);
  
  loadStorage();
  await registerCommands();
  
  setInterval(checkAllStreams, config.notifications.checkInterval);
  console.log(`🔄 Verificación cada ${config.notifications.checkInterval/1000}s`);
});

client.on('error', (e) => logError('Discord Client', e));
client.on('warn', (w) => console.warn('⚠️ Discord:', w));

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Cerrando bot...');
  saveStorage();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Cerrando por SIGTERM...');
  saveStorage();
  client.destroy();
  process.exit(0);
});

// Login
client.login(config.discord.token).catch(e => {
  console.error('❌ Error login:', e.message);
  process.exit(1);
});
