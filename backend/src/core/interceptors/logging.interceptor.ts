import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

// Registra método, ruta y tiempo de respuesta de cada request — el
// equivalente en el backend a lo que el PMV resolvía con console.log
// puntuales; acá queda centralizado en un solo lugar (sección 5.2 del
// TDD: ningún módulo de negocio debería tener que ocuparse de esto).
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(`${method} ${originalUrl} ${Date.now() - start}ms`);
      }),
    );
  }
}
