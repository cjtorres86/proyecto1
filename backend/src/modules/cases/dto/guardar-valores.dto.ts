import { IsObject, IsNotEmpty } from 'class-validator';

// { [preguntaId]: valor } — mismo espíritu que "valoresPorCampoId" en
// guardarValoresManualmente() del PMV, pero indexado por preguntaId
// estable en vez de por posición ('c07'), ya que la posición es un
// detalle interno de cómo se ensambla el formulario, no algo que el
// cliente deba conocer para guardar un valor.
export class GuardarValoresDto {
  @IsObject()
  @IsNotEmpty()
  valores: Record<string, string>;
}
