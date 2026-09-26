import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { MensajeCampo } from './mensaje-campo.entity';

export const TIPOS_REACCION = ['corazon', 'like', 'feliz'] as const;
export type TipoReaccion = (typeof TIPOS_REACCION)[number];

// Una reacción por persona, por tipo, por mensaje: la clave primaria
// (mensaje, usuario, tipo) lo garantiza en la base misma. Se puede poner
// y sacar libremente (no consume la regla de "una sola vez").
@Entity('reacciones_mensaje')
export class ReaccionMensaje {
  @PrimaryColumn({ name: 'mensaje_id', type: 'varchar', length: 36 })
  mensajeId: string;

  @PrimaryColumn({ name: 'usuario_id', type: 'varchar', length: 36 })
  usuarioId: string;

  @PrimaryColumn({ type: 'varchar', length: 10 })
  tipo: TipoReaccion;

  @ManyToOne(() => MensajeCampo, (m) => m.reacciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mensaje_id' })
  mensaje: MensajeCampo;
}
