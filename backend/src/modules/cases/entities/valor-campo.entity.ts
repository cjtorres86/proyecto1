import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Contenedor } from './contenedor.entity';
import { Pregunta } from '../../forms/entities/pregunta.entity';

// Una fila por cada pregunta respondida de un contenedor — reemplaza al
// "snapshot" plano del PMV (TDD, sección 13.11, Camino B). Ausencia de
// fila = campo vacío; nunca se guarda una fila con valor '' a propósito,
// para no confundir "no respondido" con "respondido con vacío".
@Entity('valores_campo')
export class ValorCampo {
  @PrimaryColumn({ name: 'contenedor_id' })
  contenedorId: string;

  @PrimaryColumn({ name: 'pregunta_id', length: 20 })
  preguntaId: string;

  @Column({ type: 'varchar', length: 500 })
  valor: string;

  @ManyToOne(() => Contenedor)
  @JoinColumn({ name: 'contenedor_id' })
  contenedor: Contenedor;

  @ManyToOne(() => Pregunta)
  @JoinColumn({ name: 'pregunta_id' })
  pregunta: Pregunta;
}
