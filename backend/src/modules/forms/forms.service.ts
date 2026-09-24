import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Formulario } from './entities/formulario.entity';
import { FormularioPregunta } from './entities/formulario-pregunta.entity';
import { Pregunta } from './entities/pregunta.entity';
import { Slep } from './entities/slep.entity';

// Forma de un campo ya ensamblado — equivalente exacto a lo que
// getCamposDePlantilla() devolvía en el PMV (TDD, sección 6.6): mismo
// id posicional (c01, c02...), mismo contenido, mismas validaciones.
export interface CampoEnsamblado {
  id: string; // 'c01'..'c44' — posición dentro de ESTA plantilla
  numero: number;
  preguntaId: string; // 'Q01'..'Q44' — id estable en el banco
  nombre: string;
  tipo: string;
  ayuda: unknown;
  valorFijo: string | null;
  opciones: string[] | null;
  validaciones: unknown[];
}

@Injectable()
export class FormsService {
  constructor(
    @InjectRepository(Formulario) private readonly formularios: Repository<Formulario>,
    @InjectRepository(FormularioPregunta) private readonly recetas: Repository<FormularioPregunta>,
    @InjectRepository(Slep) private readonly sleps: Repository<Slep>,
  ) {}

  async listarFormularios(): Promise<Formulario[]> {
    return this.formularios.find();
  }

  // El corazón de Forms: junta la receta (FormularioPregunta) con el
  // contenido real (Pregunta) — exactamente el mismo ensamblaje que
  // hacía getCamposDePlantilla() en el PMV, ahora resuelto con una
  // consulta relacional en vez de leer dos objetos JS en memoria.
  async getCamposDePlantilla(formularioId: string): Promise<CampoEnsamblado[]> {
    const receta = await this.recetas.find({
      where: { formularioId },
      relations: ['pregunta'],
      order: { posicionCanonica: 'ASC' },
    });
    if (!receta.length) {
      throw new NotFoundException(`No existe el formulario "${formularioId}".`);
    }
    return receta.map((item) => ({
      id: 'c' + String(item.posicionCanonica).padStart(2, '0'),
      numero: item.posicionCanonica,
      preguntaId: item.preguntaId,
      nombre: item.pregunta.nombre,
      tipo: item.pregunta.tipo,
      ayuda: item.pregunta.ayuda,
      valorFijo: item.pregunta.valorFijo,
      opciones: item.pregunta.opciones,
      validaciones: item.validaciones,
    }));
  }

  async listarSlep(): Promise<Slep[]> {
    return this.sleps.find({ order: { nombre: 'ASC' } });
  }
}
