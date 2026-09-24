import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CrearUsuarioDto {
  @IsString() @IsNotEmpty() usuario: string;
  @IsString() @IsNotEmpty() contrasena: string;
  @IsString() @IsNotEmpty() nombreParaMostrar: string;
  @IsString() @IsNotEmpty() alcance: string; // 'todos' o el nombre de un SLEP
  @IsOptional() @IsString() perfilId?: string;
  @IsOptional() @IsBoolean() esSuperadmin?: boolean;
}
