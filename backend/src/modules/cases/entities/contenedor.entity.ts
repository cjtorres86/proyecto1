import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Formulario } from '../../forms/entities/formulario.entity';
import { Usuario } from '../../../auth/entities/usuario.entity';

export type EstadoContenedor = 'pending' | 'ok' | 'no';

// Cases (codename en el PMV: MARAMARAMA — sección 5.1 del TDD): el envío
// de datos de UN SLEP para UN mes. "snapshot" del PMV se reemplaza por la
// tabla ValorCampo (sección 13.11) — Camino B, Entidad-Atributo-Valor,
// consistente con el banco de preguntas único.
@Entity('contenedores')
export class Contenedor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 60 })
  slep: string;

  @Column({ name: 'mes_consolidado', length: 20 })
  mesConsolidado: string;

  @Column({ name: 'anio_consolidado', length: 4 })
  anioConsolidado: string;

  @ManyToOne(() => Formulario, { eager: true })
  @JoinColumn({ name: 'formulario_id' })
  formulario: Formulario;

  @Column({ name: 'formulario_id', length: 60 })
  formularioId: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: EstadoContenedor;

  @Column({ default: 0 })
  filled: number;

  @Column({ default: 0 })
  total: number;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'creado_por_id' })
  creadoPor: Usuario | null;

  @Column({ name: 'creado_por_id', nullable: true })
  creadoPorId: string | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;

  @UpdateDateColumn({ name: 'actualizado_en' })
  actualizadoEn: Date;
}
