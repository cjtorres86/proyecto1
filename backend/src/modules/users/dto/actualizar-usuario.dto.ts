import { IsOptional, IsString } from 'class-validator';

export class ActualizarUsuarioDto {
  // Solo se acepta si la cuenta todavía no tenía uno (UsersService lo
  // verifica) — completa una cuenta "pendiente" (un SLEP sin persona
  // asignada todavía). Una cuenta que ya tiene usuario no se puede
  // renombrar por acá.
  @IsOptional() @IsString() usuario?: string;
  @IsOptional() @IsString() contrasena?: string;
  // Preparación para ClaveÚnica (todavía sin conectar) — asociar un RUT
  // a esta cuenta de antemano.
  @IsOptional() @IsString() rut?: string;
  @IsOptional() @IsString() nombreParaMostrar?: string;
  @IsOptional() @IsString() alcance?: string;
  @IsOptional() @IsString() perfilId?: string;
}
