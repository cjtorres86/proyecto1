import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

// Uniforma la forma de cualquier error que salga de la API — sea una
// HttpException explícita (ej. un Guard de permisos rechazando la
// petición) o una excepción no controlada. El frontend siempre recibe
// { statusCode, message, path, timestamp }, sin importar qué módulo
// disparó el error.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Corrección (hallazgo real): antes se ponía exception.getResponse()
    // completo dentro de "message" — pero eso YA es un objeto propio de
    // Nest, con su PROPIO "message" adentro ({statusCode, message,
    // error}), así que el resultado quedaba doblemente envuelto: un
    // objeto dentro de "message" en vez de un texto. El frontend, en
    // cualquier pantalla del sistema, terminaba mostrando ese objeto tal
    // cual — "[object Object]" en vez del mensaje real. Ahora se
    // desenvuelve ese "message" interno (string, o un arreglo cuando
    // viene de la validación automática de un DTO) para que el frontend
    // siempre reciba un texto legible, sin importar qué haya lanzado el
    // error.
    const message = this.extraerMensaje(exception);

    if (statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(statusCode).json({
      statusCode,
      message,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }

  private extraerMensaje(exception: unknown): string {
    if (!(exception instanceof HttpException)) return 'Error interno del servidor.';
    const cuerpo = exception.getResponse();
    if (typeof cuerpo === 'string') return cuerpo;
    const interno = (cuerpo as { message?: unknown }).message;
    if (typeof interno === 'string') return interno;
    // class-validator (ValidationPipe) entrega varios errores juntos, en
    // un arreglo — se juntan en un solo texto legible.
    if (Array.isArray(interno)) return interno.join(' ');
    return exception.message || 'Error inesperado.';
  }
}
