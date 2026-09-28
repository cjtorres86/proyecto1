import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { BitacoraService } from '../bitacora.service';
import { BITACORA_META, BitacoraMeta } from '../decorators/bitacora.decorator';

// Registrado global en app.module.ts (mejora post-v2.23): revisa CADA
// petición, pero solo hace algo si el método tiene @Bitacora(...) — para
// el resto de las rutas, no cuesta nada. Con tap(), no interfiere en la
// respuesta real de la persona, y solo registra DESPUÉS de que el método
// terminó bien (tap no se dispara si el método lanzó un error).
@Injectable()
export class BitacoraInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly bitacoraService: BitacoraService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<BitacoraMeta>(BITACORA_META, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap((resultado) => {
        // Sin usuario autenticado no hay a quién atribuirle la acción
        // (no debería pasar en una ruta con @Bitacora, pero por si acaso).
        if (!request.user) return;
        const descripcion = meta.descripcion(request, resultado);
        const detalle = meta.detalle?.(request, resultado);
        // Sin await a propósito: no hace esperar la respuesta a la
        // persona por un registro de bitácora — BitacoraService.registrar
        // ya se encarga de nunca lanzar un error hacia afuera.
        void this.bitacoraService.registrar(request.user, request.ip, meta.accion, descripcion, detalle);
      }),
    );
  }
}
