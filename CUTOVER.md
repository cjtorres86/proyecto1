# GDP-SLEP Studio — Runbook de Cutover (F14)

Puesta en producción del sistema nuevo (NestJS + Angular + MySQL) y retiro del PMV.
Este documento es el plan real de corte — qué hacer, en qué orden, y cómo revertir si algo falla.

## 0. Antes de empezar — verificación ya hecha (no repetir)
- ✅ Backend F1-F6 y Frontend F8-F12: 35 pruebas unitarias en verde, verificadas con Chrome real y con el backend real corriendo (no simulado).
- ✅ F13: el Dashboard nuevo reproduce EXACTO al PMV con datos reales de Agosto 2025 y Julio 2025 (15 métricas + 36 filas de ranking, cero diferencias).
- ✅ F14: los 14 meses históricos completos (504 contenedores) migrados y verificados.

Si alguno de estos puntos no está vigente al momento del corte real (por ejemplo, si hay más desarrollo entre esta sesión y el corte), **repetir la comparación en paralelo de la sección F13 antes de continuar** — no asumir que sigue siendo válido sin volver a correrla.

## 1. Infraestructura (una sola vez, antes del corte)
1. Servidor de MySQL 8 real, con backup automático configurado.
2. Variables de entorno de producción (`.env` del backend): `DB_HOST`, `DB_PASSWORD`, y sobre todo **`JWT_SECRET` real y único** — nunca el valor de desarrollo (`CAMBIAR_EN_PRODUCCION`) llega a producción.
3. Construir las imágenes Docker (`backend/Dockerfile`, `frontend/Dockerfile`) — ya escritas y revisadas; en este entorno de desarrollo no se pudieron construir por una restricción de red específica de este sandbox (sin acceso a Docker Hub), no por un problema de los Dockerfiles en sí.
4. Certificado HTTPS para el dominio real.

## 2. Migración de datos (una sola vez)
1. Correr las migraciones de TypeORM contra la base de producción: `npm run migration:run`.
2. Correr el seed de Auth (`src/database/seeds/auth.seed.ts`) — **cambiar las contraseñas de ejemplo antes de correrlo en producción real**, o desactivar los usuarios de ejemplo después.
3. Correr el seed de Forms (banco de preguntas, formularios, SLEP).
4. Correr la migración histórica (`src/database/migrar-historico-completo.ts`) — trae los 14 meses reales desde el PMV. Es **idempotente**: si un mes ya existe, lo omite en vez de duplicarlo (verificado en esta sesión).
5. Verificar el total: 504 contenedores esperados (14 meses × 36 SLEP).

## 3. Validación final en el ambiente de producción
Repetir, contra la base de producción recién migrada, la misma comparación en paralelo de F13: elegir 2-3 meses, calcular su Dashboard en el sistema nuevo, y compararlo número por número contra lo que el PMV calculaba para esos mismos meses. **No dar por buena la migración solo porque el conteo de filas coincide** — el conteo no revisa que los valores en sí hayan quedado bien mapeados.

## 4. Corte (el día del cutover)
1. Poner el PMV en modo solo lectura (o avisar a los usuarios que no carguen datos durante la ventana de corte).
2. Apuntar el dominio real al sistema nuevo.
3. Monitorear los primeros logins reales de cada perfil (Admin, Validador, Digitador) — confirmar que cada uno ve exactamente lo que debería ver (alcance y permisos), no solo que el login funciona.
4. Dejar el PMV accesible, pero sin escritura, durante un período de respaldo (sugerido: 2 semanas) antes de decomisionarlo del todo.

## 5. Plan de reversa (rollback)
Si algo falla durante el corte:
1. Apuntar el dominio de vuelta al PMV (que sigue intacto, no se modificó).
2. Cualquier dato cargado en el sistema nuevo durante la ventana de corte fallida queda registrado con fecha — se puede volver a migrar después de corregir el problema, sin perder ese trabajo.
3. No se borra la base de datos nueva al hacer rollback — se investiga la causa con los datos ahí mismo.

## 6. Decomiso del PMV (después del período de respaldo)
1. Confirmar que nadie accedió al PMV en modo lectura durante el período de respaldo (revisar logs de acceso).
2. Archivar el archivo HTML del PMV (no borrarlo) — sigue siendo la especificación de comportamiento de referencia si surge alguna duda sobre "cómo se calculaba esto antes".
3. Retirar el hosting/acceso del PMV.
