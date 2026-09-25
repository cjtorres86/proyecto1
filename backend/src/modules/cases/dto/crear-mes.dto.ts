import { ArrayNotEmpty, IsArray, IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class CrearMesDto {
  @IsString()
  @IsNotEmpty()
  mes: string;

  @IsString()
  @Matches(/^\d{4}$/)
  anio: string;

  @IsIn(['seguimiento_disciplinario_37', 'seguimiento_disciplinario'])
  formularioId: string;

  // SLEP elegidos en el paso 2 del asistente "Crear mes" (mejora
  // post-v2.23): antes se creaban siempre los 36, ahora solo los marcados.
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sleps: string[];
}
