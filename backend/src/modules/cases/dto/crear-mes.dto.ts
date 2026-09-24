import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CrearMesDto {
  @IsString()
  @IsNotEmpty()
  mes: string;

  @IsString()
  @Matches(/^\d{4}$/)
  anio: string;

  @IsIn(['seguimiento_disciplinario_37', 'seguimiento_disciplinario'])
  formularioId: string;
}
