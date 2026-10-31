FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile Caddyfile.prod app.caddy /etc/caddy/
COPY --from=build /app/dist /srv
