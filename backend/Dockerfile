# Build
FROM node:20-slim AS build
WORKDIR /app
# No hace falta que Puppeteer descargue Chrome en esta etapa — el
# resultado nunca se copia a la etapa final (ver runtime), sería tirar
# a la basura una descarga de ~300MB en cada build.
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Puppeteer usa el Chromium del sistema (instalado por apt, que resuelve
# solo todas las librerías que Chrome necesita para arrancar) en vez de
# intentar descargar el suyo propio — hallazgo real: ese postinstall de
# Puppeteer no sobrevivía el build multi-etapa de Docker en Render
# ("Could not find Chrome"), y aunque sobreviviera, una imagen "slim"
# le faltan varias librerías de sistema igual.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
RUN apt-get update && apt-get install -y --no-install-recommends chromium && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
