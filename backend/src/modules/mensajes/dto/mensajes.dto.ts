import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { TIPOS_REACCION, TipoReaccion } from '../entities/reaccion-mensaje.entity';

export const LARGO_MAXIMO_MENSAJE = 2000;

export class CrearMensajeDto {
  @IsString()
  @Length(1, 20)
  preguntaId: string;

  @IsString()
  @MaxLength(LARGO_MAXIMO_MENSAJE)
  texto: string;

  @IsOptional()
  @IsUUID()
  respuestaAId?: string;
}

export class EditarMensajeDto {
  @IsString()
  @MaxLength(LARGO_MAXIMO_MENSAJE)
  texto: string;
}

export class ReaccionDto {
  @IsIn(TIPOS_REACCION)
  tipo: TipoReaccion;
}
