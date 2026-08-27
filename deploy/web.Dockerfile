FROM node:22-alpine AS build
RUN corepack enable
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
WORKDIR /src
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend .
RUN pnpm build

FROM caddy:2-alpine
COPY --from=build /src/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
