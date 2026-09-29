-- ============================================================
-- Usuario de base de datos "de uso diario" (mejora post-v2.23)
-- ============================================================
-- Qué es esto: un segundo usuario de MySQL, aparte del que ya usas para
-- las migraciones (gdp_app en local, avnadmin en Aiven). Este usuario
-- nuevo es el que usará el backend cuando esté funcionando normalmente
-- (cuando alguien entra al sistema, guarda un formulario, escribe en el
-- chat, etc.) — nunca para correr migraciones.
--
-- Por qué existe: para que la protección de "nadie puede editar ni
-- borrar la Bitácora" no dependa solo de que el código esté bien escrito
-- — quede garantizada por la base de datos misma. Con este usuario, aunque
-- alguien programara sin querer un botón de "editar registro" el día de
-- mañana, la base de datos lo rechazaría igual, porque este usuario
-- físicamente no tiene el permiso de modificar esa tabla.
--
-- Verificado de verdad antes de entregar este script (no solo escrito y
-- confiado): se probó contra una base de datos real, conectado como este
-- usuario restringido —
--   - INSERT y SELECT en registros_bitacora: funcionan.
--   - UPDATE y DELETE en registros_bitacora: MySQL los rechaza con
--     "command denied to user", el error real del motor de base de
--     datos, no una validación de la aplicación.
--   - UPDATE en una tabla normal (usuarios): funciona sin problema.
--   - ALTER TABLE, incluso en una tabla normal: rechazado también — este
--     usuario nunca puede cambiar la estructura de nada, solo los datos.
--
-- CÓMO USAR ESTE ARCHIVO:
--   1. Reemplaza NOMBRE_BASE_DE_DATOS por el nombre real (ver abajo).
--   2. Reemplaza CAMBIAR_ESTA_CLAVE por una contraseña nueva y segura.
--   3. Pega el resultado en tu cliente de MySQL (o el editor de consultas
--      de Aiven) y ejecútalo.
--   4. Guarda la contraseña que usaste — la vas a necesitar para el
--      DB_USERNAME / DB_PASSWORD del backend (ver el documento
--      README-usuario-runtime.md, en esta misma carpeta).
--
--   Nombre de base de datos según el ambiente:
--     - Tu notebook (local):  gdp_slep
--     - Aiven (producción):   defaultdb
--
-- IMPORTANTE — mantenimiento a futuro: si más adelante se agrega una
-- tabla nueva al sistema (una migración nueva), hay que agregarle su
-- propia línea de GRANT acá y volver a correr este script — un GRANT
-- general a "toda la base de datos" no sirve para este propósito (MySQL
-- no permite conceder todo y después quitar una excepción puntual; hay
-- que conceder tabla por tabla, a propósito). Si la tabla nueva es otra
-- bitácora o registro de auditoría, dale el mismo trato que
-- registros_bitacora (sin UPDATE ni DELETE); si es una tabla normal,
-- dale las 4 (SELECT, INSERT, UPDATE, DELETE), igual que las demás.
-- ============================================================

CREATE USER IF NOT EXISTS 'gdp_runtime'@'%' IDENTIFIED BY 'CAMBIAR_ESTA_CLAVE';

-- Tablas normales: los 4 verbos de datos de siempre (leer, agregar,
-- modificar, borrar) — el uso diario del sistema. Ninguna incluye CREATE,
-- ALTER ni DROP: cambiar la estructura sigue siendo exclusivo del usuario
-- de las migraciones.
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.contenedores TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.formularios TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.formulario_preguntas TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.preguntas TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.slep TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.perfiles TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.usuarios TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.valores_campo TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.lecturas_campo TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.mensajes_campo TO 'gdp_runtime'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON NOMBRE_BASE_DE_DATOS.reacciones_mensaje TO 'gdp_runtime'@'%';

-- La Bitácora: SOLO leer y agregar. Sin UPDATE, sin DELETE — a propósito,
-- es la protección real de la que trata este archivo.
GRANT SELECT, INSERT ON NOMBRE_BASE_DE_DATOS.registros_bitacora TO 'gdp_runtime'@'%';

-- La tabla `migrations` (la usa TypeORM para saber qué migraciones ya
-- corrieron) queda SIN NINGÚN permiso para este usuario, ni siquiera
-- leer — el backend, funcionando normalmente, nunca la necesita; solo la
-- toca el usuario de las migraciones.

FLUSH PRIVILEGES;

-- Para revisar que quedó como se espera, en cualquier momento:
--   SHOW GRANTS FOR 'gdp_runtime'@'%';
