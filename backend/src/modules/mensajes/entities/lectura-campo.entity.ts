import { Column, Entity, PrimaryColumn } from 'typeorm';

// Hasta dónde leyó cada persona el chat de cada campo (aviso de "no
// leídos"). leido_hasta es la fecha del último mensaje que la persona
// VIO, tomada de la propia base — nunca el reloj del servidor, que puede
// no coincidir con el de la base (Render vs Aiven).
@Entity('lecturas_campo')
export class LecturaCampo {
  @PrimaryColumn({ name: 'usuario_id', type: 'varchar', length: 36 })
  usuarioId: string;

  @PrimaryColumn({ name: 'contenedor_id', type: 'varchar', length: 36 })
  contenedorId: string;

  @PrimaryColumn({ name: 'pregunta_id', type: 'varchar', length: 20 })
  preguntaId: string;

  @Column({ name: 'leido_hasta', type: 'datetime', precision: 3 })
  leidoHasta: Date;
}
