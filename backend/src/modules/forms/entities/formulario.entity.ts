import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { FormularioPregunta } from './formulario-pregunta.entity';

@Entity('formularios')
export class Formulario {
  @PrimaryColumn({ length: 60 })
  id: string;

  @Column({ length: 150 })
  label: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  icono: string | null;

  @OneToMany(() => FormularioPregunta, (fp) => fp.formulario)
  preguntas: FormularioPregunta[];
}
