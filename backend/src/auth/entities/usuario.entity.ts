import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Perfil } from './perfil.entity';

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable (mejora post-v2.23): una cuenta "pendiente" (un SLEP
  // registrado de antemano, todavía sin persona asignada) existe en la
  // base con usuario y contrasenaHash en null — no puede entrar a
  // ningún lado (AuthService.validarCredenciales la rechaza) hasta que
  // alguien complete estos 2 campos, o el día que se conecte ClaveÚnica,
  // hasta que se le asocie un RUT.
  @Column({ type: 'varchar', unique: true, length: 60, nullable: true })
  usuario: string | null;

  @Column({ name: 'contrasena_hash', type: 'varchar', nullable: true })
  contrasenaHash: string | null;

  // RUT (mejora post-v2.23, preparación para ClaveÚnica — todavía sin
  // conectar): cuando se active el ingreso con ClaveÚnica, la persona se
  // identifica por su RUT, no por un usuario/contraseña. Se deja el
  // campo desde ya para no tener que tocar la base de datos otra vez ese
  // día — el emparejamiento (RUT → perfil y SLEP) lo sigue haciendo un
  // Admin de antemano, nunca la propia persona al entrar.
  @Column({ type: 'varchar', unique: true, length: 12, nullable: true })
  rut: string | null;

  @Column({ name: 'nombre_para_mostrar', length: 120 })
  nombreParaMostrar: string;

  // El nombre de columna real en MySQL sigue siendo es_superusuario a
  // propósito — esa migración ya corrió contra la base de datos real;
  // cambiarlo requeriría una migración nueva. Es solo el nombre en
  // TypeScript el que se corrigió a esSuperadmin.
  @Column({ name: 'es_superusuario', default: false })
  esSuperadmin: boolean;

  // Desactivar (mejora post-v2.23): una cuenta desactivada no puede
  // iniciar sesión (AuthService.validarCredenciales), aunque la clave
  // sea correcta — sin borrar nada, para no perder su historial en la
  // Bitácora ni tener que recrearla si se reactiva.
  @Column({ default: true })
  activo: boolean;

  // 'todos' o el nombre exacto de un SLEP — ver AuthService.puedeVerSlep.
  // El superadmin y Admin/Validador tienen 'todos'; Digitador, su SLEP.
  @Column({ length: 60 })
  alcance: string;

  // Nullable: el superadmin no tiene perfil (TDD, sección 11.2.2 —
  // "el superadmin no está sujeto a esta lógica").
  @ManyToOne(() => Perfil, (perfil) => perfil.usuarios, { nullable: true, eager: true })
  @JoinColumn({ name: 'perfil_id' })
  perfil: Perfil | null;

  @Column({ name: 'perfil_id', nullable: true, length: 60 })
  perfilId: string | null;

  @CreateDateColumn({ name: 'creado_en' })
  creadoEn: Date;
}
