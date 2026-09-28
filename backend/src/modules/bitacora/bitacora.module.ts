import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegistroBitacora } from './entities/registro-bitacora.entity';
import { BitacoraService } from './bitacora.service';
import { BitacoraController } from './bitacora.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RegistroBitacora])],
  controllers: [BitacoraController],
  providers: [BitacoraService],
  // Exportado (mejora post-v2.23): cada módulo que use @Bitacora(...) en
  // sus controllers (cases, mensajes, reports, users) necesita poder
  // inyectar BitacoraService — en realidad no lo inyectan directo, lo usa
  // BitacoraInterceptor por su cuenta, pero el interceptor se registra en
  // AppModule y necesita este export para resolver la dependencia.
  exports: [BitacoraService],
})
export class BitacoraModule {}
