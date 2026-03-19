# --- Builder stage ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json y tsconfigs
COPY package*.json tsconfig*.json ./ 

# Instalar dependencias de build
RUN npm ci

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# --- Final stage ---
FROM node:18-alpine

WORKDIR /app

# Copiar solo dependencias de producción
COPY package*.json ./ 
RUN npm ci --omit=dev

# Copiar los archivos compilados
COPY --from=builder /app/dist ./dist

# Arrancar el servicio
CMD ["node", "dist/index.js"]
