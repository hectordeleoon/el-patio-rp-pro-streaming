# 🚀 Guía de Deployment - El Patio RP Pro

## Pre-requisitos

- [x] Cuenta en GitHub
- [x] Cuenta en Railway (https://railway.app)
- [x] Node.js 18+ instalado localmente (para testing)
- [x] Git instalado
- [x] Tokens de Discord Bot
- [x] APIs de Twitch, YouTube, Kick (opcionales pero recomendados)

## Paso 1: Preparar el Proyecto en GitHub

### 1.1 Crear Repositorio en GitHub

```bash
# En tu computadora, ve al directorio del proyecto
cd el-patio-rp-pro

# Inicializar Git (si no está inicializado)
git init

# Agregar todos los archivos
git add .

# Hacer el primer commit
git commit -m "Initial commit - El Patio RP Pro"

# Crear repositorio en GitHub (ve a github.com y crea un nuevo repo)
# Luego conecta tu repositorio local:
git remote add origin https://github.com/TU-USUARIO/el-patio-rp-pro.git

# Subir el código
git branch -M main
git push -u origin main
```

## Paso 2: Configurar Discord Bot

### 2.1 Crear Aplicación en Discord

1. Ve a https://discord.com/developers/applications
2. Click en "New Application"
3. Nombra tu aplicación "El Patio RP Pro"
4. Ve a la sección "Bot"
5. Click en "Add Bot"
6. Copia el TOKEN (lo necesitarás para `.env`)
7. Habilita estos "Privileged Gateway Intents":
   - Presence Intent
   - Server Members Intent
   - Message Content Intent

### 2.2 Invitar el Bot a tu Servidor

1. Ve a "OAuth2" → "URL Generator"
2. Selecciona scopes:
   - `bot`
   - `applications.commands`
3. Selecciona permisos:
   - Administrator (o los permisos específicos que necesites)
4. Copia la URL generada y ábrela en tu navegador
5. Selecciona tu servidor e invita el bot

### 2.3 Obtener IDs necesarios

```
DISCORD_CLIENT_ID: Ve a General Information → Application ID
DISCORD_GUILD_ID: Click derecho en tu servidor Discord → Copy Server ID
DISCORD_FORUM_CHANNEL_ID: Crea un canal tipo Forum, click derecho → Copy Channel ID
```

## Paso 3: Configurar APIs de Streaming

### 3.1 Twitch API

1. Ve a https://dev.twitch.tv/console
2. Click "Register Your Application"
3. Nombre: "El Patio RP Pro"
4. OAuth Redirect URLs: `https://tu-app.railway.app/auth/twitch/callback`
5. Category: Website Integration
6. Copia el **Client ID** y **Client Secret**

### 3.2 YouTube API

1. Ve a https://console.cloud.google.com
2. Crea un nuevo proyecto
3. Habilita "YouTube Data API v3"
4. Ve a Credentials → Create Credentials → API Key
5. Copia tu API Key

### 3.3 Kick (Opcional)

Kick no tiene API oficial aún. El código usa endpoints no documentados.

## Paso 4: Configurar OpenAI y Deepgram

### 4.1 OpenAI (Para análisis con IA)

1. Ve a https://platform.openai.com/api-keys
2. Crea una nueva API key
3. Cópiala (la necesitarás para `OPENAI_API_KEY`)

### 4.2 Deepgram (Para transcripción de audio)

1. Ve a https://console.deepgram.com
2. Crea una cuenta
3. Obtén tu API key
4. Cópiala (para `DEEPGRAM_API_KEY`)

## Paso 5: Deploy en Railway

### 5.1 Método Recomendado - Desde GitHub

1. **Ir a Railway**: https://railway.app
2. **Hacer Login** (usa tu cuenta de GitHub)
3. **Crear Nuevo Proyecto**:
   - Click en "New Project"
   - Selecciona "Deploy from GitHub repo"
   - Busca y selecciona `el-patio-rp-pro`
   - Railway detectará automáticamente que es un proyecto Node.js

4. **Agregar PostgreSQL**:
   - En tu proyecto, click "+ New"
   - Selecciona "Database" → "PostgreSQL"
   - Railway creará la base de datos automáticamente
   - La variable `DATABASE_URL` se configura automáticamente

5. **Agregar Redis**:
   - Click "+ New" nuevamente
   - Selecciona "Database" → "Redis"
   - La variable `REDIS_URL` se configura automáticamente

6. **Configurar Variables de Entorno**:
   - Ve a tu servicio principal (el-patio-rp-pro)
   - Click en "Variables"
   - Agrega todas las variables del archivo `.env.example`

   **Variables Críticas Mínimas**:
   ```
   NODE_ENV=production
   PORT=3000
   
   # Discord
   DISCORD_TOKEN=tu_token_aqui
   DISCORD_CLIENT_ID=tu_client_id
   DISCORD_GUILD_ID=tu_server_id
   DISCORD_FORUM_CHANNEL_ID=canal_foro_id
   
   # Twitch
   TWITCH_CLIENT_ID=tu_twitch_id
   TWITCH_CLIENT_SECRET=tu_twitch_secret
   
   # YouTube
   YOUTUBE_API_KEY=tu_youtube_key
   
   # OpenAI
   OPENAI_API_KEY=tu_openai_key
   
   # Deepgram
   DEEPGRAM_API_KEY=tu_deepgram_key
   ```

7. **Deploy Automático**:
   - Railway desplegará automáticamente tu app
   - Verás los logs en tiempo real
   - Una vez completado, obtendrás una URL tipo: `https://tu-app.railway.app`

### 5.2 Método Alternativo - Railway CLI

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Inicializar proyecto
railway init

# Agregar PostgreSQL
railway add --database postgresql

# Agregar Redis
railway add --database redis

# Deploy
railway up

# Ver logs
railway logs
```

## Paso 6: Configurar Webhooks (Post-Deploy)

Una vez que tu app esté corriendo en Railway:

```bash
# Desde tu computadora local, ejecuta:
npm run setup:webhooks
```

Esto configurará los webhooks de Twitch para notificaciones de streams.

## Paso 7: Verificar el Deployment

### 7.1 Health Check

Visita: `https://tu-app.railway.app/health`

Deberías ver:
```json
{
  "status": "ok",
  "timestamp": "2024-...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "discord": "connected"
  }
}
```

### 7.2 Verificar Bot en Discord

1. Ve a tu servidor Discord
2. Deberías ver el bot online
3. Prueba el comando: `/live`

### 7.3 Verificar Logs

En Railway:
- Ve a tu proyecto
- Click en tu servicio
- Ve a "Deployments"
- Click en el deployment activo
- Ve "View Logs"

Deberías ver logs como:
```
🚀 Iniciando El Patio RP Pro...
✅ Base de datos conectada
✅ Redis conectado
✅ Discord Bot activo
✅ Servidor backend activo en puerto 3000
✨ El Patio RP Pro está completamente operativo!
```

## Paso 8: Panel Web (Opcional)

Si quieres el panel web de administración:

1. En Railway, ve a tu servicio
2. Click en "Settings" → "Networking"
3. Genera un dominio público
4. El panel estará disponible en: `https://tu-app.railway.app/admin`

## Paso 9: Configuración Post-Deploy

### 9.1 Agregar Streamers

Usa la API o el panel web:

```bash
POST https://tu-app.railway.app/api/streamers
{
  "display_name": "NombreStreamer",
  "twitch_username": "username_twitch",
  "youtube_channel_id": "channel_id",
  "bio": "Descripción del streamer"
}
```

### 9.2 Configurar Canal Forum

1. En Discord, crea un canal tipo "Forum"
2. Copia el ID del canal
3. Agrégalo como `DISCORD_FORUM_CHANNEL_ID` en Railway

## Troubleshooting

### ❌ Bot no se conecta

- Verifica `DISCORD_TOKEN` en variables de Railway
- Revisa que el bot tenga los intents habilitados
- Verifica los logs en Railway

### ❌ No se detectan streams

- Verifica tus credenciales de Twitch/YouTube
- Asegúrate de haber ejecutado `setup:webhooks`
- Revisa logs de Stream Monitor

### ❌ No se generan clips

- Verifica que FFmpeg esté instalado (viene en el Docker)
- Revisa logs de Clip Processor
- Verifica `CLIP_STORAGE_PATH` tiene permisos de escritura

### ❌ Error de base de datos

- Verifica que PostgreSQL esté corriendo en Railway
- Revisa `DATABASE_URL` en variables
- Ejecuta migraciones: `npm run db:migrate` (desde Railway CLI)

## Mantenimiento

### Ver Logs en Tiempo Real

```bash
railway logs -f
```

### Actualizar el Código

```bash
git add .
git commit -m "Update: descripción del cambio"
git push origin main
```

Railway desplegará automáticamente los cambios.

### Backup de Base de Datos

Railway hace backups automáticos, pero puedes hacer uno manual:

```bash
railway run pg_dump $DATABASE_URL > backup.sql
```

## Próximos Pasos

1. ✅ Configurar redes sociales (TikTok, Instagram)
2. ✅ Ajustar configuración de Viral Score
3. ✅ Personalizar branding en videos
4. ✅ Agregar más streamers
5. ✅ Monitorear métricas en el panel web

## Soporte

Si tienes problemas:
1. Revisa los logs en Railway
2. Verifica las variables de entorno
3. Consulta la documentación en el README
4. Abre un issue en GitHub

---

¡Felicidades! 🎉 Tu bot está ahora funcionando en Railway y listo para producción.
