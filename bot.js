// CORS para el frontend
const cors = require('cors');
webApp.use(cors());
webApp.use(express.static('public'));

// ========== RUTAS FALTANTES PARA EL DASHBOARD ==========

// Obtener posts de redes (simulados o reales)
webApp.get('/api/posts', requireAdmin, (req, res) => {
  res.json(storage.posts || []);
});

webApp.post('/api/posts', requireAdmin, (req, res) => {
  try {
    const { platform, content, url, imageUrl } = req.body;
    const post = {
      id: Date.now().toString(),
      platform,
      content,
      url,
      imageUrl,
      createdAt: new Date().toISOString(),
      createdBy: req.role || 'admin'
    };
    if (!storage.posts) storage.posts = [];
    storage.posts.unshift(post);
    if (storage.posts.length > 100) storage.posts.pop();
    saveStorage();
    res.json({ ok: true, post });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Sistema de Top 3 Semanal
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
  const sorted = stats.sort((a, b) => b.score - a.score).slice(0, 3);
  res.json(sorted);
});

webApp.post('/api/top3/reset', requireAdminOnly, (req, res) => {
  storage.weeklyStats.clear();
  saveStorage();
  res.json({ ok: true, message: 'Top 3 reiniciado' });
});

// Sistema de Apuestas
webApp.get('/api/bets', requireAdmin, (req, res) => {
  const activeBets = [];
  for (const [id, bet] of storage.bets || new Map()) {
    if (bet.status === 'active') activeBets.push({ id, ...bet });
  }
  res.json(activeBets);
});

webApp.get('/api/bets/history', requireAdmin, (req, res) => {
  const history = [];
  for (const [id, bet] of storage.bets || new Map()) {
    if (bet.status !== 'active') history.push({ id, ...bet });
  }
  res.json(history.slice(-50));
});

// Horarios de streamers
webApp.get('/api/schedules', requireAdmin, (req, res) => {
  const schedules = [];
  for (const [uid, data] of storage.streamSchedules || new Map()) {
    const streamer = storage.streamers.get(uid);
    schedules.push({
      uid,
      displayName: streamer?.displayName || 'Desconocido',
      ...data
    });
  }
  res.json(schedules);
});

webApp.post('/api/schedules/:uid', requireAdmin, (req, res) => {
  try {
    const { uid } = req.params;
    const { day, time, game, timezone } = req.body;
    if (!storage.streamSchedules) storage.streamSchedules = new Map();
    storage.streamSchedules.set(uid, { day, time, game, timezone, updatedAt: new Date().toISOString() });
    saveStorage();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Configuración actual
webApp.get('/api/config', requireAdmin, (req, res) => {
  res.json({
    notifications: config.notifications,
    clips: config.clips,
    discord: {
      guildId: config.discord.guildId,
      streamerRoleId: config.discord.streamerRoleId,
      notificationsChannelId: config.discord.notificationsChannelId
    }
  });
});

// Forzar verificación manual
webApp.post('/api/check-now', requireAdmin, async (req, res) => {
  try {
    await checkAllStreams();
    res.json({ ok: true, message: 'Verificación completada', timestamp: new Date().toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Estadísticas generales
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
