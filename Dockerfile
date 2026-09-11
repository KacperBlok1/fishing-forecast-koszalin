# syntax=docker/dockerfile:1

# ============================================================
# 1. Build frontendu (Vite → statyczne pliki)
# ============================================================
FROM node:20-alpine AS client-build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ============================================================
# 2. Build backendu (TypeScript → JavaScript)
# ============================================================
FROM node:20-alpine AS server-build
WORKDIR /srv

COPY server/package.json server/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY server/ ./
RUN npm run build

# ============================================================
# 3. Same zależności produkcyjne serwera
#    (osobny etap, żeby do obrazu nie trafił TypeScript ani tsx)
# ============================================================
FROM node:20-alpine AS server-deps
WORKDIR /srv

COPY server/package.json server/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ============================================================
# 4. Obraz uruchomieniowy
# ============================================================
FROM node:20-alpine
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV CLIENT_DIR=/srv/client
ENV PORT=8090

WORKDIR /srv

COPY --from=server-deps /srv/node_modules ./node_modules
COPY --from=server-build /srv/dist ./dist
COPY server/package.json ./package.json
COPY --from=client-build /app/dist ./client

USER node
EXPOSE 8090

CMD ["node", "dist/index.js"]
