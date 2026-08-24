FROM node:22-alpine AS build
RUN corepack enable
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
WORKDIR /src
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend .
# Ключ Яндекс.Карт нужен на СБОРКЕ: vite подставляет его в index.html.
# На VM после git clone файла frontend/.env нет, и без этого аргумента
# карта молча грузится без ключа. Аргумент не задан — остаётся .env.
ARG VITE_YMAPS_API_KEY
RUN pnpm build

FROM caddy:2-alpine
COPY --from=build /src/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
