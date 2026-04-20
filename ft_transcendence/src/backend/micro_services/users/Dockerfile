FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

COPY src/ ./src/

COPY assets/ ./assets/

EXPOSE 3002

CMD ["node", "src/index.js"]
