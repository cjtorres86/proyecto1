import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListarBitacoraDto {
  @IsOptional() @IsString() usuarioId?: string;
  @IsOptional() @IsString() accion?: string;
  @IsOptional() @IsString() desde?: string;
  @IsOptional() @IsString() hasta?: string;
  @IsOptional() @IsString() texto?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) @Max(200) porPagina: number = 50;
}

// Solo estas 3: son las únicas acciones que de verdad ocurren enteras en
// el navegador, sin ningún pedido al servidor que las pueda registrar
// solas (cerrar sesión es una decisión del navegador; ver o imprimir el
// Informe/PDF los arma el propio navegador de la persona — ver
// informe.component.ts). Cualquier otra acción real SIEMPRE pasa por un
// endpoint del servidor y se registra sola con @Bitacora(...), nunca
// desde acá — este endpoint no es una puerta libre para registrar
// cualquier cosa.
const ACCIONES_DESDE_FRONTEND = ['sesion_cerrada', 'informe_visto', 'informe_pdf_descargado'] as const;

export class RegistrarEventoDto {
  @IsIn(ACCIONES_DESDE_FRONTEND)
  accion: (typeof ACCIONES_DESDE_FRONTEND)[number];

  @IsString()
  descripcion: string;
}
