# Base image with Node.js
FROM node:18-alpine AS base

# Install FFmpeg and other dependencies
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
FROM base AS dependencies
RUN npm ci --only=production
RUN cp -R node_modules /prod_node_modules
RUN npm ci

# Build stage
FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build || true

# Production stage
FROM base AS production

# Copy production dependencies
COPY --from=dependencies /prod_node_modules ./node_modules

# Copy application files
COPY --from=build /app/app ./app
COPY --from=build /app/config ./config
COPY --from=build /app/scripts ./scripts
COPY package*.json ./

# Create necessary directories
RUN mkdir -p /app/clips /app/logs /app/temp

# Set permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose ports
EXPOSE 3000 3001

# Start application
CMD ["npm", "start"]
