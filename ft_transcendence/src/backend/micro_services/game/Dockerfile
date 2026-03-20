# Usa Node 20 basado en Alpine
FROM node:20-alpine

# Crear directorio de trabajo
WORKDIR /app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache bash git curl

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el resto del código
COPY src ./src

# Exponer puerto (ajusta según tu servidor)
EXPOSE 2077

# Comando por defecto para correr el microservicio
CMD ["node", "src/index.js"]