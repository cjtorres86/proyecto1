import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

// Forma de "permisos" fijada por el PMV (TDD, sección 11.2.1): tres
// categorías — vistas, acciones, gestión. "gestionar_perfiles" nunca es
// una casilla asignable dentro de acá; es exclusiva del superadmin,
// verificada aparte (ver AuthService.puedeGestionarPerfiles).
export interface PermisosPerfil {
  vistas: string[];
  acciones: string[];
  gestion: string[];
}

@Entity('perfiles')
export class Perfil {
  // String legible en vez de UUID a propósito: los 3 perfiles
  // predeterminados (perfil_admin, perfil_validador, perfil_digitador)
  // necesitan un id estable y reconocible, igual que en el PMV.
  @PrimaryColumn({ type: 'varchar', length: 60 })
  id: string;

  @Column({ length: 120 })
  nombre: string;

  @Column({ type: 'json' })
  permisos: PermisosPerfil;

  @OneToMany(() => Usuario, (usuario) => usuario.perfil)
  usuarios: Usuario[];
}
