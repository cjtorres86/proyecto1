import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contenedor } from '../cases/entities/contenedor.entity';
import { FormularioPregunta } from '../forms/entities/formulario-pregunta.entity';
import { MensajeCampo } from './entities/mensaje-campo.entity';
import { ReaccionMensaje } from './entities/reaccion-mensaje.entity';
import { LecturaCampo } from './entities/lectura-campo.entity';
import { MensajesController, MensajesGlobalController } from './mensajes.controller';
import { MensajesService } from './mensajes.service';

@Module({
  imports: [TypeOrmModule.forFeature([MensajeCampo, ReaccionMensaje, LecturaCampo, Contenedor, FormularioPregunta])],
  controllers: [MensajesController, MensajesGlobalController],
  providers: [MensajesService],
})
export class MensajesModule {}
