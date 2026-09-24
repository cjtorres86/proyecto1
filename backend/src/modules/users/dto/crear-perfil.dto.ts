import { IsArray, IsNotEmpty, IsString } from 'class-validator';

export class CrearPerfilDto {
  @IsString() @IsNotEmpty() id: string;
  @IsString() @IsNotEmpty() nombre: string;
  @IsArray() vistas: string[];
  @IsArray() acciones: string[];
  @IsArray() gestion: string[];
}
