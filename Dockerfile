FROM node:18-alpine

# Instalar FFmpeg y dependencias
RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# USAR npm install (NO npm ci)
RUN npm install --production

# Copiar código
COPY . .

# Crear directorios
RUN mkdir -p clips logs temp

# Variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Iniciar app
CMD ["node", "app/index.js"]
