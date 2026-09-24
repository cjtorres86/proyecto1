# GDP-SLEP Studio — Frontend

Angular 19 standalone + Angular Material 19 + PrimeNG 19 + Tailwind CSS 4 + RxJS 7.8.

## Requisitos
- Node.js 20+

## Arranque
```bash
npm install
npm start   # ng serve
```

## Fase actual: F8 — Cimientos
- Proyecto Angular 19 standalone, con Material, PrimeNG (tema Aura) y Tailwind CSS 4 integrados y verificados (build real, clases utilitarias confirmadas en el CSS de salida)
- `core/services/auth.service.ts`: sesión, token, `can()`/`puedeVerSlep()` (ayuda de UI — la verificación real vive en el backend)
- `core/services/case-state.service.ts`: el patrón reactivo real (BehaviorSubject + Observables derivados) descrito en el TDD, sección 13.10 — reemplaza al eventBus y a las llamadas manuales a `_renderX()` del PMV
- `core/interceptors/auth.interceptor.ts`, `core/guards/auth.guard.ts` y `permission.guard.ts`
- Layout base (toolbar + router-outlet) y Login funcionales

## Nota importante: Fuse Admin
Fuse Admin es una plantilla con licencia comercial — no está disponible en este entorno. El layout actual es una versión funcional real hecha con Angular Material que cumple el mismo rol (navegación, sesión activa, cerrar sesión) mientras se licencia e integra la plantilla real.

## Verificación realizada
- `ng build` (producción) es lento en este entorno por la combinación Tailwind v4 + minificación — se verificó con `ng build --configuration development`, que compila en ~15s sin errores
- Se confirmó que Tailwind, Material y PrimeNG quedan realmente integrados inspeccionando el CSS de salida (clases `.flex`, `.bg-gray-50`, `.p-6` presentes)
- **No se pudieron correr las pruebas unitarias (Karma/Jasmine)**: este entorno no tiene un navegador Chrome instalado (`No binary for ChromeHeadless`) — limitación del entorno de pruebas, no del código. Los archivos `.spec.ts` ya existen y están listos para correr en cualquier máquina con Chrome instalado (`npm test`).

## Fase F9 — Auth (agregada)
- Restauración de sesión al recargar la página (`APP_INITIALIZER` + `AuthService.cargarSesion()`)
- El interceptor ahora cierra la sesión automáticamente si el backend responde 401 (token vencido o inválido)
- 9 pruebas unitarias nuevas (`AuthService`, `authGuard`, `permissionGuard`) — **corridas con Chrome real** (ver nota abajo), 10/10 en total en el proyecto
- **Verificación E2E real de punta a punta**: usando Puppeteer, se abrió un navegador real contra `ng serve` + el backend NestJS real corriendo — login con cesar/cesarcesar, verificado que redirige a `/login` sin sesión, que tras el login redirige a home mostrando su nombre, y que el token queda guardado en localStorage

## Actualización importante: Karma/Chrome sí funciona
En F8 reporté que no había Chrome disponible para correr las pruebas. Se resolvió: Puppeteer trae su propio Chromium autocontenido (no depende de apt/snap, que no funcionan en este contenedor) — se configuró `karma.conf.js` con `CHROME_BIN` apuntando a ese binario y flags `--no-sandbox`. Las pruebas ya corren de verdad en este entorno.

## Hallazgo durante la verificación E2E (no es un bug de la app)
Aparecieron 2 errores 403 en consola al cargar la página — vienen de `fonts.googleapis.com` (Google Fonts), bloqueado por la lista de dominios permitidos de este entorno sandbox, no por la aplicación. En un despliegue con acceso normal a internet no ocurre. El login, el guardado del token y la navegación funcionan correctamente de punta a punta.

## Fase F10 — Cases (agregada) — la pieza más grande del frontend
- `CasesApiService` (capa HTTP pura) + `CaseStateService` refactorizado para consumirla — separación real, según el árbol de archivos del TDD
- 4 componentes: `months-panel` (con el modal "Agregar Mes" en MatDialog), `slep-panel`, `case-form-panel` (edición + Guardar + Cargar Datos), `field-inspector`
- 13 pruebas unitarias en total

## Un bug real encontrado por la verificación E2E (no por pruebas unitarias)
`AuthService.aEtiquetaPublica()` en el **backend** nunca devolvía `perfil.permisos` — solo `{id, nombre}`. Cualquier llamada a `AuthService.can()` en Angular lanzaba `TypeError`. Ninguna prueba unitaria lo detectó porque usaban su propio mock de datos, no la respuesta real del backend — se necesitó un navegador real contra el backend real para que apareciera. Corregido en el backend (agregando `permisos`) y reforzado en el frontend (optional chaining, por si vuelve a faltar algún dato).

## Tres problemas de mi propio script de prueba (no de la aplicación) que investigué antes de tocar código
Al diagnosticar por qué un clic no parecía funcionar, encontré que mis selectores CSS eran ambiguos (coincidían con un div contenedor exterior, o con el botón "Cargar Datos", que también tiene la clase `cursor-pointer`) — nada de esto era un bug de Angular, era mi script de Puppeteer apuntando al elemento equivocado. Lo dejo documentado para que quede claro qué se corrigió en la app y qué era solo del arnés de pruebas.

## Verificación E2E completa (Puppeteer, navegador real, backend real)
Login como Barrancas (Digitador) → selecciona su mes → el panel SLEP muestra solo su propio SLEP (nunca otros, alcance correcto) → el panel Formulario carga sus datos reales y muestra el botón Guardar (tiene el permiso) → clickear una pregunta activa el Inspector de Campo con su ficha real.

## Fase F11 — Dashboard (agregada)
- `DashboardApiService` (capa HTTP pura, mismo patrón que CasesApiService)
- 4 componentes: `advance-indicator`, `initial-totals-donut` (con `p-chart`/Chart.js real — TDD sección 13.6), `total-and-bars-group` (reutilizable para CIC/Procedimientos/Sanciones), `ranking`
- `WorkspaceModeService`: el toggle Formulario ↔ Dashboard ampliado (TDD, sección 7.8), con el modo por defecto correcto según perfil (Admin/superusuario → Dashboard; Validador/Digitador → Formulario) — se fija tanto al iniciar sesión como al restaurar la sesión al recargar la página
- 4 pruebas unitarias nuevas de `WorkspaceModeService` — 17 en total en el frontend

## Verificación E2E completa — sin ningún hallazgo nuevo esta vez
Login como cesar (superusuario) → confirma que arranca en modo Dashboard ampliado → selecciona Enero 2027 → el Dashboard muestra los mismos números ya verificados en el backend (F5): 50% de avance, 20 sumarios instruidos, 10 procesos cerrados, Valdivia arriba en el ranking → el donut de Chart.js se renderiza de verdad (`<canvas>` presente, no solo declarado) → alternar de vuelta a Formulario funciona.

## Fase F12 — Users + Reports (agregada) — cierre de todo el frontend
- `UsersApiService`/`ReportsApiService`, `UserConfigComponent` + `UserFormDialogComponent` (crear usuarios, PrimeNG p-table), `ProfileConfigComponent` (solo superusuario), `DownloadModalComponent` (las 4 modalidades del TDD 9.6), `ErrorReportTableComponent` (PrimeNG p-table, ordenable/paginada)
- Navegación agregada al layout: Usuarios, Perfiles, Errores, y el botón de Descargar — cada uno visible solo según el permiso real del usuario

## Verificación E2E completa (8 pasos, todos en verde)
Claudia (Admin) crea un usuario real y lo ve aparecer en la tabla; Ximena (Validador) no ve el link "Usuarios" y si fuerza la URL directamente, el guard la redirige fuera; cesar ve la tabla de Perfiles (exclusiva de superusuario) y el Informe de errores con los errores reales de Valdivia; el modal de Descarga muestra sus 4 opciones.

Un hallazgo en el camino que **no era un bug de la app**: mi primer intento de probar el Informe de errores usó una recarga completa de página para navegar, lo que reinicia el estado en memoria de Angular (se pierde el mes activo) — corregido navegando por clic, como lo haría un usuario real.

## Corrección post-entrega — reportada por el usuario, verificada con capturas reales
- **Banner y botones invisibles (blanco sobre blanco)**: `mat-toolbar[color="primary"]` y `mat-flat-button[color="primary"]` no aplicaban el color de fondo en esta versión de Angular Material (confirmado con CSS calculado real: fondo rgb(250,249,253), texto rgb(255,255,255) — literalmente invisible). Afectaba 8 botones en toda la app, no solo el banner. Se corrigió aplicando el color de marca real del PMV (#1E3A8A) explícito en los 8, verificado con captura de pantalla real tras el arreglo.
- **Estrella (★) quitada** del login y del banner — el banner ahora dice "Avance de Sumarios".
- **Íconos rotos (texto cortado "do"/"los")**: dependían de una fuente de Google cargada por internet, que se rompe si ese dominio está bloqueado (típico en redes corporativas). Se reemplazaron por PrimeIcons, empaquetado localmente sin depender de ningún CDN externo.
