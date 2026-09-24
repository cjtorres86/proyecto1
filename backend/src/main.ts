import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Cualquier DTO con class-validator se valida automáticamente en cada
  // endpoint, sin que cada Controller tenga que acordarse de hacerlo —
  // mismo espíritu que el motor de validación del PMV (sección 6.3 del
  // TDD), ahora aplicado también a la forma de las peticiones HTTP.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Avance de Sumarios backend corriendo en http://localhost:${port}`);
}
bootstrap();
