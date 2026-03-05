FROM node:20-alpine

WORKDIR /app

# Copiamos package.json y package-lock.json primero para cache
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies)
RUN npm install

# Copiamos el resto del código
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]