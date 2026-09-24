# GDP-SLEP Studio — Backend

NestJS 10 + TypeORM 0.3 + MySQL2. Ver el TDD (sección 13) para el mapeo completo de módulos y el esquema de entidades.

## Requisitos
- Node.js 20+
- MySQL 8

## Arranque
```bash
cp .env.example .env   # completar con las credenciales reales
npm install
npm run start:dev
```

Verificación rápida: `curl http://localhost:3000/health` debe responder `{"status":"ok",...}`.

## Fase actual: F1 — Cimientos
- Conexión TypeORM ↔ MySQL2 (`src/database/data-source.ts`)
- Módulo `core/` (interceptor de logging, filtro global de excepciones)
- Endpoint `/health`

Las próximas fases (F2 Auth, F3 Forms, F4 Cases...) se agregan en `src/` como nuevos módulos, sin modificar lo ya construido — ver TDD, sección 13.5.

## Fase F2 — Auth (agregada)
- Entidades `Usuario`/`Perfil` con migración real (`InitAuth`), corrida contra MySQL
- Login local + JWT (Passport), Guards de permisos y de alcance de datos
- Seed con los mismos usuarios/perfiles del PMV (`npx ts-node -r tsconfig-paths/register src/database/seeds/auth.seed.ts`)
- Verificado con peticiones HTTP reales: login válido, login inválido (401), `/auth/me` con y sin token, alcance correcto por perfil
- 5 pruebas unitarias del Guard de permisos (`npx jest src/auth/guards`)

## Fase F3 — Forms (agregada)
- Entidades `Pregunta`/`Formulario`/`FormularioPregunta`/`Slep`, con migraciones reales corridas contra MySQL
- Datos extraídos programáticamente del PMV real (BANCO_PREGUNTAS, FORM_TEMPLATES, SLEP_CANONICOS) — no retranscritos a mano
- `FormsService.getCamposDePlantilla(id)` — equivalente exacto a `getCamposDePlantilla()` del PMV
- Verificado con peticiones HTTP reales: 37 campos para la plantilla corta, 44 para la larga, 36 SLEP, validaciones idénticas a las del PMV (ej. c07 con su única validación)
- Hallazgo real corregido: el banco de preguntas usa ids mixtos (\"Q07\", pero también \"YA_SUMARIADOS\" de 13 caracteres) — se ensanchó la columna

## Fase F4 — Cases (agregada) — la pieza más grande
- Entidades `Contenedor`/`ValorCampo` (Camino B: Entidad-Atributo-Valor, sección 13.11), migración real corrida contra MySQL
- `ValidacionService`: reimplementación fiel de evaluateValidation()/_sumaTokens() del PMV — mismo algoritmo exacto
- `CasesService`: crearMesVacio, guardarValores (única puerta de escritura, revalida siempre), getContenedorConValores, listarPorMes (acotado por alcance)
- `CasesController`: alcance verificado sobre el SLEP real del recurso, no solo por parámetro de ruta
- Verificado con HTTP real end-to-end: creación de 36 contenedores, validación C07+C08=C06 fallando y luego corrigiéndose exactamente igual que en el PMV, 403 al intentar ver otro SLEP, 403 al intentar guardar sin el permiso editar_formulario
- 5 pruebas unitarias del motor de validación

## Fase F5 — Dashboard (agregada)
- `ConsolidadoService`: agrega valores de varios contenedores (texto único, mínimo, máximo, promedio ponderado, suma) — reglas idénticas al PMV, pero por preguntaId estable, no por posición
- `DashboardService`: calculateMetrics, getCicSeriesPct/getProcedimientosSeriesPct/getSancionesSeriesPct, getRankingSeries — capa de datos pura, sin nada de renderizado
- Mejora real sobre el PMV: al consolidar por id estable en vez de por posición, se resuelve de raíz el riesgo de mezclar mal datos entre plantillas de distinto tamaño (documentado como límite en el TDD, sección 6.6/13.8)
- Verificado con HTTP real: consolidado de 36 contenedores, pctAvance calculado correctamente (10/20=50%), ranking con 36 SLEP ordenados
- 5 pruebas unitarias de calculateMetrics

## Fase F6 — Users + Reports (agregada) — cierre del backend
- `UsersService`/`UsersController`: CRUD de usuarios (permiso gestionar_usuarios) y de perfiles (exclusivo del superusuario, verificado explícitamente, no solo oculto en la UI)
- `ExcelService` (con exceljs): Consolidado General y por SLEP — archivos .xlsx reales, verificados como ZIP válido
- `InformeService`: informe HTML con el mismo contenido de datos que el PMV (indicador de avance + tabla de respuestas)
- Verificado con HTTP real: creación de usuario (nunca devuelve el hash), rechazo 403 al intentar crear un perfil sin ser superusuario, descarga de Excel real (10.9 KB, ZIP válido), informe HTML con los datos correctos
- 18 pruebas unitarias en total en todo el backend (F1-F6), todas en verde

## Fuera de alcance de esta fase (decisión explícita, no un olvido)
- **PDF vía Puppeteer**: instalar Chromium en este entorno es una descarga pesada (~200MB+) con retorno incierto dado el tiempo disponible. El informe HTML ya funciona completo; generar el PDF a partir de él es una fase acotada y independiente cuando se decida abordarla — no bloquea nada de lo demás.
- El diseño visual detallado del informe (donut SVG, franjas de color exactas del PMV) quedó simplificado a una versión funcional con los mismos datos — una iteración de diseño, no de datos.

## Fase F10 (backend) — cierre de un vacío real de F4
Se agregó `ImportacionService` + `POST /cases/:id/importar` (multer) — el PMV podía cargar un Excel a un SLEP puntual (`cargarDatosParaContenedor`), y ese endpoint nunca se había construido en F4. Verificado con un archivo .xlsx real: reconoce encabezados por texto (no por posición), reporta columnas no reconocidas, y guarda los valores en el contenedor correcto.
También se agregó `GET /cases/meses-disponibles` (necesario para el panel de Meses del frontend).

## Fase F12 (backend) — cierre de otro vacío real
Se agregó `CasesService.listarErroresDelMes()` + `GET /cases/errores` — el "Informe de errores" del frontend lo necesitaba y nunca se había construido. Reutiliza el mismo ValidacionService del guardado, nunca una segunda copia de las reglas. Verificado con datos reales: detecta correctamente 4 errores de validación en Valdivia (Enero 2027).

## Fase F13 — Validación: corrida en paralelo contra el PMV, con datos históricos reales
Se extrajeron directamente del PMV (vía jsdom, no a mano) los 36 registros semilla reales de Agosto 2025, y el resultado exacto que el PMV mismo calcula para ese mes (`calcularConsolidado` + `calculateMetrics` + `getRankingSeries`). Se migraron esos datos a MySQL como Contenedor/ValorCampo reales (`src/database/migrar-agosto2025.ts`), y se corrió el endpoint `/dashboard` del backend nuevo sobre exactamente los mismos datos.

**Resultado: coincidencia exacta, campo por campo — las 15 métricas del Dashboard y las 36 filas del ranking, cero diferencias.**

### Un bug real encontrado en el camino (en el script de migración, no en el backend)
La primera corrida del script de migración usaba el nombre de SLEP tal cual venía en el dato crudo, sin normalizar — el PMV documenta que el dato real trae "45 variantes de texto que colapsan a 36 tras normalizar" (espacios, tildes, "de X" en vez de "X"). Dos SLEP ("Aysén ", "Costa Araucanía ") quedaron con un espacio de más, y la comparación automática del ranking lo detectó de inmediato. Se corrigió aplicando la misma normalización que usa `MOAI.normalizarSlep()` en el PMV, contra el catálogo real de 36 SLEP — no asumiendo que el dato crudo ya viene limpio.

## Fase F14 — Cutover (agregada) — cierre de la transformación
- Migración histórica completa: los 14 meses reales del PMV (504 contenedores, verificado exacto contra el conteo del propio PMV), no solo el mes de prueba de F13 (`src/database/migrar-historico-completo.ts`, idempotente)
- Segunda validación en paralelo (Julio 2025, caso con datos en cero): coincidencia exacta contra el PMV
- `Dockerfile` real (backend y frontend) + `docker-compose.yml` en la raíz del proyecto — no se pudieron construir en este entorno por falta de acceso de red a Docker Hub (confirmado con x-deny-reason: host_not_allowed), no por un defecto de los archivos
- `CUTOVER.md`: el runbook real de puesta en producción y retiro del PMV, con plan de reversa

## Corrección post-entrega — reportada por el usuario, verificada contra una base de datos nueva de verdad
- **Bug real en la migración `WidenFormularioPreguntaPreguntaId`**: asumía que `preguntas.id` ya estaba ensanchado a varchar(20) por un intento previo — cierto solo en la base de desarrollo original de este proyecto, nunca en una base nueva. Se corrigió para ensanchar ambas columnas (la llave primaria y la que la referencia), soltando y reponiendo la restricción una sola vez. Verificado corriendo las 4 migraciones + los 3 seeds contra una base de datos recién creada, de cero: 504 contenedores migrados sin ningún error ni intervención manual.
