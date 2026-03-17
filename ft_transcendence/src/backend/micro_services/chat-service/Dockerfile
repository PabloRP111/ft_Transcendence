
#Stage 1: Build --> compiles TS in JS, we get all the raw materials and cook the meal
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/

RUN npm run build 


# ---
#Stage 2: we serve the meal without the disposables (ingredients to cook the meal) so the image is lighter

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

EXPOSE 3003

CMD ["node", "dist/index.js"]
