// Configuración de conexión TypeORM + MySQL2 (TDD, sección 13.11).
// Este archivo se usa tanto para que Nest arranque la conexión (vía
// TypeOrmModule.forRootAsync en app.module.ts) como para la CLI de
// TypeORM (generar y correr migraciones) — una sola fuente de verdad,
// nunca dos configuraciones separadas que puedan desincronizarse.
import 'dotenv/config';
import { DataSource, DataSourceOptions } from 'typeorm';

export const dataSourceOptions: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // synchronize:false a propósito, incluso en desarrollo: el esquema se
  // gobierna solo por migraciones versionadas, nunca por que TypeORM
  // "adivine" el DDL a partir de las entidades — así el esquema real y
  // el que ve el equipo en el control de versiones nunca divergen.
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  // Aiven (y la mayoría de los MySQL manejados en la nube) exigen
  // conexión cifrada — tu MySQL local no. DB_SSL=true solo se pone en
  // el .env cuando se apunta a Aiven/producción; en local, sin esa
  // variable, la conexión queda exactamente como siempre (sin SSL).
  // rejectUnauthorized:false es la opción rápida (la conexión sigue
  // cifrada igual, solo no verifica el certificado de Aiven contra una
  // autoridad) — para más adelante, si se quiere más riguroso, existe
  // la opción de pasar el certificado CA real que da Aiven.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
};

export default new DataSource(dataSourceOptions);
