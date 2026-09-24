# Build (configuration=development por el hallazgo del F8/F11: la build
# de producción con Tailwind v4 es muy lenta en entornos con pocos
# recursos — para producción real, evaluar aumentar recursos del
# builder o fijar una versión distinta de Tailwind antes de usar
# --configuration production acá).
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration development

# Runtime: nginx sirviendo los archivos estáticos, con fallback a
# index.html para las rutas de Angular (SPA).
FROM nginx:alpine AS runtime
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
