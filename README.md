# 🔥 El Patio Bot Stream v7.0 — Ultra Notifier

Bot de Discord para **El Patio RP** con notificaciones de streams en **Twitch, Kick, TikTok y YouTube**. El mejor bot de notificaciones para servidores de streamers.

## ✨ Mejoras Principales

### 🚀 Sistema de Detección Mejorado
- **Verificación cada 1 minuto** (antes 2 minutos)
- **Sistema de retry** con 3 intentos por plataforma
- **Manejo de errores robusto** sin crashear el bot
- **Detección múltiple de métodos** para cada plataforma

### 🛡️ Sistema Anti-Spam
- **Cooldown configurable** entre notificaciones (default: 30 min)
- Evita spam cuando un streamer reinicia stream
- Notificaciones inteligentes que respetan el cooldown

### 📱 Plataformas Soportadas
| Plataforma | Estado | Método |
|------------|--------|--------|
| 🟣 Twitch | ✅ Funcionando | API oficial |
| 🟢 Kick | ✅ Funcionando | API oficial |
| ⚫ TikTok | ✅ Funcionando | Scraping + API alternativa |
| 🔴 YouTube | ⚠️ Requiere API Key | YouTube Data API |

### 🎨 Notificaciones Mejoradas
- Embeds con colores de cada plataforma
- Thumbnails en tiempo real
- Botones directos para ver el stream
- Mención al rol de streamers
- Actualización automática del hilo del streamer

---

## 📋 Variables de Entorno

```env
# ═══════════════════════════════════════════════════════════
#                    DISCORD (REQUERIDO)
# ═══════════════════════════════════════════════════════════
DISCORD_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=tu_client_id
DISCORD_GUILD_ID=tu_guild_id

# ═══════════════════════════════════════════════════════════
#                    CANALES
# ═══════════════════════════════════════════════════════════
DISCORD_FORUM_CHANNEL_ID=id_canal_foro
DISCORD_NOTIFICATIONS_CHANNEL_ID=id_canal_notificaciones
DISCORD_CLIPS_CHANNEL_ID=id_canal_clips

# ═══════════════════════════════════════════════════════════
#                    ROLES
# ═══════════════════════════════════════════════════════════
STREAMER_ROLE_ID=id_rol_streamer

# ═══════════════════════════════════════════════════════════
#                    TWITCH API (OPCIONAL)
# ═══════════════════════════════════════════════════════════
TWITCH_CLIENT_ID=tu_client_id
TWITCH_CLIENT_SECRET=tu_client_secret

# ═══════════════════════════════════════════════════════════
#                    YOUTUBE API (OPCIONAL)
# ═══════════════════════════════════════════════════════════
YOUTUBE_API_KEY=tu_api_key

# ═══════════════════════════════════════════════════════════
#                    CONFIGURACIÓN
# ═══════════════════════════════════════════════════════════
# Intervalo de verificación en ms (default: 60000 = 1 min)
CHECK_INTERVAL=60000

# Cooldown entre notificaciones en minutos (default: 30)
NOTIFICATION_COOLDOWN=30

# Activar/desactivar plataformas
ENABLE_TWITCH=true
ENABLE_KICK=true
ENABLE_TIKTOK=true
ENABLE_YOUTUBE=false

# Dashboard admin key
DASHBOARD_ADMIN_KEY=elpatio-admin-2026

# Puerto del servidor web
PORT=3000
```

---

## 🚀 Instalación

### 1. Clonar y instalar
```bash
git clone <tu-repo>
cd nekotina-style-bot
npm install
```

### 2. Configurar variables
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

### 3. Iniciar
```bash
npm start
```

---

## 📁 Estructura de Archivos

```
nekotina-style-bot/
├── index.js              # Código principal del bot
├── dashboard.html        # Dashboard web
├── package.json          # Dependencias
├── README.md            # Esta guía
└── data/                # Datos persistentes
    └── storage.json     # Base de datos local
```

---

## 🤖 Comandos de Discord

### Para Streamers
| Comando | Descripción |
|---------|-------------|
| `/registrar-streamer` | Registra tus plataformas de streaming |
| `/mi-hilo` | Muestra tu hilo en el foro |
| `/stats [usuario]` | Muestra estadísticas |
| `/live` | Muestra streams en vivo ahora |
| `/ping` | Verifica la latencia del bot |

### Para Administradores
| Comando | Descripción |
|---------|-------------|
| `/check-stream` | Fuerza verificación de streams |
| `/config-cooldown <minutos>` | Configura el cooldown |

---

## 🌐 Dashboard Web

Accede al dashboard en: `http://localhost:3000`

**Default Admin Key:** `elpatio-admin-2026`

### Funciones del Dashboard
- 📊 Estadísticas en tiempo real
- 🔴 Ver streams en vivo
- 🎮 Gestionar streamers
- ⚙️ Configuración del bot
- 📋 Logs del sistema
- 🔍 Forzar verificación de streams

---

## 🔧 Solución de Problemas

### Las notificaciones no llegan
1. Verifica que el canal de notificaciones esté configurado
2. Revisa que el bot tenga permisos en el canal
3. Verifica las credenciales de Twitch (si usas Twitch)
4. Revisa los logs: `📋 Logs` en el dashboard

### TikTok no detecta
- TikTok usa scraping, puede fallar ocasionalmente
- El bot reintenta automáticamente 3 veces
- Si persiste, verifica que el usuario de TikTok sea correcto

### Kick no detecta
- Verifica que el username de Kick sea exacto
- La API de Kick puede tener cambios

### YouTube no detecta
- **Requiere YOUTUBE_API_KEY**
- Ve a: https://console.cloud.google.com/apis/credentials
- Crea una API Key y habilita YouTube Data API v3

---

## 🔄 Migración desde versión anterior

Si vienes del bot anterior (El Patio RP Bot v6.0):

1. Copia tu archivo `data/storage.json` a la nueva carpeta
2. Actualiza las variables de entorno (nuevos nombres)
3. Instala las dependencias: `npm install`
4. Inicia el bot: `npm start`

---

## 📝 Changelog v7.0

### Nuevo
- ✅ Sistema de retry (3 intentos)
- ✅ Cooldown anti-spam configurable
- ✅ Verificación cada 1 minuto
- ✅ Mejor manejo de errores
- ✅ Dashboard mejorado
- ✅ Logs persistentes
- ✅ Detección múltiple para TikTok

### Mejorado
- 🎨 Notificaciones más atractivas
- ⚡ Rendimiento optimizado
- 🔧 Código más robusto
- 📊 Mejor sistema de estadísticas

---

## 💡 Tips

1. **Configura el cooldown** según tus necesidades:
   - Servidores pequeños: 15-20 minutos
   - Servidores grandes: 30-60 minutos

2. **Usa el dashboard** para monitorear el estado del bot

3. **Revisa los logs** regularmente para detectar problemas

4. **Registra streamers** con todas sus plataformas para mejor cobertura

---

## 🆘 Soporte

Si tienes problemas:
1. Revisa los logs en el dashboard
2. Verifica las variables de entorno
3. Asegúrate de que el bot tenga los permisos correctos

---

**Creado con ❤️ para la comunidad de streamers**
