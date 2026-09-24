import { Column, Entity, PrimaryColumn } from 'typeorm';

// Ayuda mostrada en el Inspector de Campo (TDD, sección 7.3): descripción
// larga + notas — se guarda como JSON porque su forma no cambia según la
// plantilla, solo su contenido.
export interface AyudaPregunta {
  desc: string;
  notes: string[];
}

// Forms (codename en el PMV: MOAI — sección 5.1 del TDD): banco de
// preguntas único. El id es estable y permanente (nunca cambia aunque la
// pregunta se reubique entre formularios) — la posición sí varía, pero
// vive en FormularioPregunta, no acá (sección 6.1 del TDD).
@Entity('preguntas')
export class Pregunta {
  @PrimaryColumn({ length: 20 })
  id: string;

  @Column({ length: 40 })
  grupo: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  rol: string | null;

  // Texto oficial largo — usado por Cases para reconocer encabezados de
  // un Excel importado (sección 7.1 del TDD), no para mostrar en la UI.
  @Column({ type: 'text' })
  texto: string;

  @Column({ type: 'json' })
  alias: string[];

  @Column({ length: 20 })
  tipo: string;

  // Nombre corto — el que efectivamente se muestra en el Formulario.
  @Column({ length: 200 })
  nombre: string;

  @Column({ type: 'varchar', name: 'help_name', length: 200, nullable: true })
  helpName: string | null;

  @Column({ type: 'json' })
  ayuda: AyudaPregunta;

  // Para preguntas de valor fijo (Ministerio, Subsecretaría) — TDD,
  // sección 7.9: se resuelve solo, no lo escribe el Digitador.
  @Column({ type: 'varchar', name: 'valor_fijo', length: 200, nullable: true })
  valorFijo: string | null;

  // Para preguntas de tipo 'select' (ej. Servicio/SLEP) — sus opciones.
  @Column({ type: 'json', nullable: true })
  opciones: string[] | null;
}
