FROM node:18-alpine

# Instalar TODAS las dependencias necesarias para canvas
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    pkgconfig

WORKDIR /app

# Copiar package.json
COPY package*.json ./

# Instalar dependencias
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
