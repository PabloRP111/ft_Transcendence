FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY src/ ./src/

COPY assets/ ./assets/

EXPOSE 3002

CMD ["node", "src/index.js"]
