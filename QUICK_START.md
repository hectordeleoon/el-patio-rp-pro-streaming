# 🚀 Quick Start - El Patio RP Pro

## Inicio Rápido en 5 Minutos

### 1. Clonar y Setup Inicial

```bash
# Clonar el repositorio
git clone https://github.com/tu-usuario/el-patio-rp-pro.git
cd el-patio-rp-pro

# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env
```

### 2. Configurar Variables Mínimas

Edita `.env` y configura **AL MENOS** estas variables:

```env
# Discord (OBLIGATORIO)
DISCORD_TOKEN=tu_token_aqui
DISCORD_CLIENT_ID=tu_client_id
DISCORD_GUILD_ID=tu_server_id

# Base de datos local (para desarrollo)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/elpatio_rp_pro
REDIS_URL=redis://localhost:6379
```

### 3. Iniciar con Docker (Recomendado)

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### 4. Iniciar sin Docker (Manual)

```bash
# Iniciar PostgreSQL y Redis localmente primero
# Luego:

# Crear base de datos
npm run db:migrate

# Iniciar en desarrollo
npm run dev
```

### 5. Verificar que Funciona

1. Ve a tu servidor Discord
2. El bot debería estar online ✅
3. Prueba el comando `/live`
4. Visita http://localhost:3000/health

## Deploy a Railway (Producción)

### Opción 1: Un Click desde GitHub

1. Sube tu código a GitHub:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. Ve a [Railway](https://railway.app)
3. Click "New Project" → "Deploy from GitHub"
4. Selecciona tu repositorio
5. Agrega PostgreSQL y Redis desde el dashboard
6. Configura las variables de entorno
7. ¡Listo! 🎉

### Opción 2: Railway CLI

```bash
# Instalar CLI
npm install -g @railway/cli

# Login y deploy
railway login
railway init
railway up
```

## Primeros Pasos

### Agregar tu Primer Streamer

```bash
# API
curl -X POST http://localhost:3000/api/streamers \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "NombreStreamer",
    "twitch_username": "username",
    "bio": "Streamer de GTA RP"
  }'
```

### Comandos del Bot

```
/live   - Ver streamers en vivo
/clips  - Ver últimos clips
/stats  - Estadísticas del servidor
```

## Estructura del Proyecto

```
el-patio-rp-pro/
├── app/
│   ├── bot/              # Discord bot
│   ├── backend/          # API y servicios
│   └── shared/           # Utilidades compartidas
├── config/               # Configuraciones
├── scripts/              # Scripts de utilidad
└── docker-compose.yml    # Docker setup
```

## Troubleshooting Rápido

**Bot no se conecta:**
```bash
# Verifica el token
echo $DISCORD_TOKEN

# Verifica los logs
npm run logs
```

**Error de base de datos:**
```bash
# Reinicia PostgreSQL
docker-compose restart postgres

# O ejecuta migraciones
npm run db:migrate
```

**Error de Redis:**
```bash
# Reinicia Redis
docker-compose restart redis
```

## Siguiente Paso

Lee la [Guía Completa de Deployment](./DEPLOYMENT.md) para configuración avanzada.

## Soporte

- 📖 [README Completo](./README.md)
- 🚀 [Guía de Deployment](./DEPLOYMENT.md)
- 🐛 [Reportar Issues](https://github.com/tu-usuario/el-patio-rp-pro/issues)

---

¡Diviértete con El Patio RP Pro! 🎮🤖
