# 📋 Guía de Comandos — El Patio Bot Stream v7.0

## 👥 Comandos para Streamers

### `/registrar-streamer`
Registra tus plataformas de streaming y crea tu hilo en el foro.

**Parámetros:**
- `twitch` — Tu usuario de Twitch (sin @)
- `kick` — Tu usuario de Kick
- `youtube` — Tu canal de YouTube (@usuario)
- `tiktok` — Tu usuario de TikTok (@usuario)
- `biografia` — Breve descripción sobre ti
- `color` — Color en formato hex (ej: #FF5500)

**Ejemplo:**
```
/registrar-streamer
  twitch: juanito_rp
  kick: juanito
  biografia: Streamer de GTA V RP
  color: #9146FF
```

**Resultado:**
- ✅ Crea un hilo en el foro con tu nombre
- ✅ Guarda todas tus plataformas
- ✅ Activa notificaciones automáticas cuando entres en vivo

---

### `/mi-hilo`
Muestra el link a tu hilo en el foro de streamers.

**Ejemplo:**
```
/mi-hilo
```

---

### `/stats [usuario]`
Muestra estadísticas del servidor o de un usuario específico.

**Ejemplo:**
```
/stats                    # Stats del servidor
/stats @Juanito          # Stats de un usuario
```

**Muestra:**
- 🎮 Streamers registrados
- 🔴 Streams en vivo
- ⏱️ Horas totales
- 📺 Streams totales
- 📡 Latencia del bot

---

### `/live`
Muestra todos los streams que están en vivo ahora mismo.

**Ejemplo:**
```
/live
```

---

### `/ping`
Verifica la latencia del bot.

**Ejemplo:**
```
/ping
```

---

## 🛠️ Comandos para Administradores

### `/check-stream`
Fuerza una verificación inmediata de todos los streams.

**Permiso requerido:** Administrador

**Ejemplo:**
```
/check-stream
```

**Resultado:**
- Verifica todos los streamers registrados
- Envía notificaciones si encuentra streams en vivo
- Muestra resultado en mensaje efímero

---

### `/config-cooldown <minutos>`
Configura el tiempo de cooldown entre notificaciones del mismo streamer.

**Permiso requerido:** Administrador

**Parámetros:**
- `minutos` — Tiempo en minutos (5-120)

**Ejemplo:**
```
/config-cooldown 30
```

**Nota:** Esto evita spam cuando un streamer reinicia su transmisión.

---

## 🔔 Cómo Funciona el Sistema de Notificaciones

### Flujo de Detección

1. **Registro del Streamer**
   - El streamer usa `/registrar-streamer`
   - El bot guarda sus plataformas (Twitch, Kick, TikTok, YouTube)

2. **Verificación Automática**
   - El bot verifica cada **1 minuto** si hay streams en vivo
   - Revisa todas las plataformas registradas

3. **Detección de Stream**
   - Si detecta un stream nuevo → Envía notificación
   - Si el stream sigue activo → Actualiza viewers
   - Si el stream terminó → Calcula estadísticas

4. **Notificación**
   - Se envía al canal configurado
   - Incluye: título, viewers, tiempo, botón para ver
   - Se actualiza el hilo del streamer

### Sistema Anti-Spam (Cooldown)

Por defecto, el bot espera **30 minutos** antes de enviar otra notificación del mismo streamer. Esto evita:
- Spam cuando un streamer reinicia OBS
- Múltiples notificaciones por reconexiones
- Flood en el canal

**Para cambiar el cooldown:**
```
/config-cooldown 15    # 15 minutos
/config-cooldown 60    # 1 hora
```

---

## 📊 Estadísticas que el Bot Rastrea

Para cada streamer, el bot guarda:

| Estadística | Descripción |
|-------------|-------------|
| 📺 Streams | Número total de streams |
| ⏱️ Horas | Horas totales streameadas |
| 👥 Viewers promedio | Promedio de espectadores |
| 🔥 Peak viewers | Máximo de espectadores alcanzado |
| 🪙 Coins | Monedas del sistema de economía |
| 🕐 Último stream | Fecha del último stream |

---

## 🎯 Flujo de Uso Típico

### Para un Streamer Nuevo:

1. **Admin le da el rol "Streamer"**
   - El bot envía DM automático con instrucciones

2. **Streamer se registra**
   ```
   /registrar-streamer
     twitch: mi_usuario
     kick: mi_usuario
     biografia: Streamer de GTA V RP
   ```

3. **Bot crea hilo automáticamente**
   - Hilo con nombre del streamer
   - Info de todas las plataformas

4. **Cuando el streamer inicia stream**
   - Bot detecta automáticamente
   - Envía notificación al canal
   - Actualiza el hilo del streamer

5. **Cuando el streamer termina**
   - Bot calcula duración
   - Actualiza estadísticas
   - Otorga coins por horas streameadas

---

## 🆘 Solución de Problemas

### "No recibo notificaciones cuando prendo stream"

1. Verifica que estés registrado: `/mi-hilo`
2. Asegúrate de que tu username esté correcto
3. Revisa que el bot tenga permisos en el canal de notificaciones
4. Si es YouTube, necesitas configurar YOUTUBE_API_KEY

### "El bot no detecta mi stream de TikTok"

- TikTok usa scraping y puede fallar ocasionalmente
- El bot reintenta automáticamente 3 veces
- Verifica que tu username de TikTok sea exacto (sin @)

### "Llegan muchas notificaciones del mismo stream"

- Aumenta el cooldown: `/config-cooldown 60`
- Esto suele pasar cuando hay reconexiones frecuentes

---

## 💡 Tips

### Para Streamers:

1. **Registra todas tus plataformas**
   - Más visibilidad = más viewers
   - Los viewers pueden seguirte donde prefieran

2. **Mantén actualizado tu username**
   - Si cambias tu username en alguna plataforma, re-regístrate

3. **Usa el comando `/live`**
   - Para ver quién más está streameando
   - Apoya a otros streamers de la comunidad

### Para Administradores:

1. **Revisa el dashboard regularmente**
   - Monitorea el estado del bot
   - Revisa logs si hay problemas

2. **Ajusta el cooldown según tu comunidad**
   - Servidores pequeños: 15-20 minutos
   - Servidores grandes: 30-60 minutos

3. **Usa `/check-stream` para testing**
   - Fuerza verificación inmediata
   - Útil para probar después de cambios

---

## 📚 Enlaces Útiles

- **Discord Developer Portal:** https://discord.com/developers/applications
- **Twitch Developer Console:** https://dev.twitch.tv/console
- **YouTube API Console:** https://console.cloud.google.com/apis/credentials
- **Dashboard del Bot:** http://localhost:3000 (o tu URL de Railway)
