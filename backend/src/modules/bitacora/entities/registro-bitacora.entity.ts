import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Bitácora de usuarios (mejora post-v2.23). A propósito, esta entidad NO
// tiene @UpdateDateColumn: un registro de bitácora se crea una vez y
// nunca se toca de nuevo — ni el Superadmin puede editarlo o borrarlo
// (BitacoraService, más abajo, solo expone "registrar" y "listar", nunca
// "editar" ni "borrar" — no es un descuido).
//
// usuarioNombre y perfilNombre están duplicados a propósito (en vez de
// solo guardar usuarioId y consultar el nombre actual cada vez): son una
// FOTO del momento exacto de la acción. Si mañana alguien cambia de
// perfil, o su nombre para mostrar cambia, la bitácora sigue diciendo
// quién era en ESE momento — no reescribe la historia.
@Entity('registros_bitacora')
export class RegistroBitacora {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'usuario_id', type: 'varchar', length: 36 })
  usuarioId: string;

  @Column({ name: 'usuario_nombre', type: 'varchar', length: 100 })
  usuarioNombre: string;

  @Column({ name: 'perfil_nombre', type: 'varchar', length: 100 })
  perfilNombre: string;

  @Column({ type: 'varchar', length: 45 })
  ip: string;

  @Column({ type: 'varchar', length: 60 })
  accion: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'json', nullable: true })
  detalle: Record<string, unknown> | null;

  // Cuándo el portal confirmó que lo recibió (Bitácora central). Vacío =
  // todavía pendiente de enviar. Es lo único que se marca después de
  // crearlo: el contenido del registro nunca cambia.
  @Column({ name: 'enviado_portal_en', type: 'datetime', nullable: true, select: false })
  enviadoPortalEn: Date | null;

  @CreateDateColumn({ name: 'creado_en', type: 'datetime', precision: 3 })
  creadoEn: Date;
}
