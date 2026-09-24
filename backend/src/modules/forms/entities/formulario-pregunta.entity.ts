import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Formulario } from './formulario.entity';
import { Pregunta } from './pregunta.entity';

// La "receta" de cada plantilla (TDD, sección 6.2): qué preguntas incluye
// y en qué orden. Las validaciones viven ACÁ, no en Pregunta, porque
// dependen de la posición dentro de ESTA plantilla en particular — la
// misma pregunta puede estar en la posición 7 en una plantilla y en la
// 9 en otra, y su fórmula de validación cambia con eso.
@Entity('formulario_preguntas')
export class FormularioPregunta {
  @PrimaryColumn({ name: 'formulario_id', length: 60 })
  formularioId: string;

  @PrimaryColumn({ name: 'pregunta_id', length: 20 })
  preguntaId: string;

  @Column({ name: 'posicion_canonica' })
  posicionCanonica: number;

  @Column({ type: 'json' })
  validaciones: unknown[];

  @ManyToOne(() => Formulario, (f) => f.preguntas)
  @JoinColumn({ name: 'formulario_id' })
  formulario: Formulario;

  @ManyToOne(() => Pregunta)
  @JoinColumn({ name: 'pregunta_id' })
  pregunta: Pregunta;
}
