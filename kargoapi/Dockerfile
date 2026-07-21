# syntax=docker/dockerfile:1

# 1) Bağımlılıklar (dev dahil) — build ve test için
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 2) Build — TypeScript -> dist
FROM deps AS build
WORKDIR /app
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# 3) Test — unit + e2e (docker build --target test ile koşar)
FROM build AS test
WORKDIR /app
COPY test ./test
RUN npm run test && npm run test:e2e

# 4) Sadece prod bağımlılıkları
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# 5) Runtime — küçük çalışma imajı
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8000
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 8000
CMD ["node", "dist/main.js"]
