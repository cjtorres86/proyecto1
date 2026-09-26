import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from '../../../auth/entities/usuario.entity';
import { ReaccionMensaje } from './reaccion-mensaje.entity';

// Un mensaje del chat de UN campo de UN formulario (contenedor = SLEP +
// mes). Nunca se borra de la base: "borrar" solo marca eliminado_en (se
// muestra "Mensaje eliminado" para no romper las respuestas que lo
// citan) y la primera edición guarda el texto original en
// texto_original — mismo criterio que el resto del sistema: los datos
// se conservan siempre.
//
// Fechas con precisión de milisegundos (3), a propósito: el driver de
// MySQL en Node lee las fechas con esa precisión. Con microsegundos, un
// mensaje ya leído seguiría contando como "no leído" por la diferencia
// (ver MensajesService.listarHilo / noLeidos).
@Entity('mensajes_campo')
export class MensajeCampo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'contenedor_id', type: 'varchar', length: 36 })
  contenedorId: string;

  @Column({ name: 'pregunta_id', type: 'varchar', length: 20 })
  preguntaId: string;

  @Column({ name: 'autor_id', type: 'varchar', length: 36 })
  autorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'autor_id' })
  autor: Usuario;

  @Column({ type: 'text' })
  texto: string;

  @Column({ name: 'texto_original', type: 'text', nullable: true })
  textoOriginal: string | null;

  @Column({ name: 'respuesta_a_id', type: 'varchar', length: 36, nullable: true })
  respuestaAId: string | null;

  @ManyToOne(() => MensajeCampo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'respuesta_a_id' })
  respuestaA: MensajeCampo | null;

  @OneToMany(() => ReaccionMensaje, (r) => r.mensaje)
  reacciones: ReaccionMensaje[];

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 3 })
  creadoEn: Date;

  @Column({ name: 'editado_en', type: 'datetime', precision: 3, nullable: true })
  editadoEn: Date | null;

  @Column({ name: 'eliminado_en', type: 'datetime', precision: 3, nullable: true })
  eliminadoEn: Date | null;

  @Column({ name: 'eliminado_por_id', type: 'varchar', length: 36, nullable: true })
  eliminadoPorId: string | null;

  // Regla "una sola vez": el autor puede editar O borrar su mensaje una
  // única vez en total. Las acciones del superadmin no la consumen.
  @Column({ name: 'cambio_usado', type: 'boolean', default: false })
  cambioUsado: boolean;
}
