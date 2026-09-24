import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { HttpExceptionFilter } from './filters/http-exception.filter';

// Core (codename en el PMV: FUNDACIÓN — sección 5.1 del TDD): infraestructura
// transversal que cualquier otro módulo puede necesitar, pero que no
// pertenece a ningún dominio de negocio en particular.
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class CoreModule {}
