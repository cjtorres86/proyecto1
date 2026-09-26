import { IsNotEmpty, IsString, Matches } from 'class-validator';

// Identifica un mes consolidado (cerrar / eliminar mes).
export class MesDto {
  @IsString()
  @IsNotEmpty()
  mes: string;

  @IsString()
  @Matches(/^\d{4}$/)
  anio: string;
}
