import { IsOptional, IsString } from 'class-validator';

export class ActualizarUsuarioDto {
  @IsOptional() @IsString() contrasena?: string;
  @IsOptional() @IsString() nombreParaMostrar?: string;
  @IsOptional() @IsString() alcance?: string;
  @IsOptional() @IsString() perfilId?: string;
}
