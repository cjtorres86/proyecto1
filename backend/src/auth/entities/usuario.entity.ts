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

  @Column({ unique: true, length: 60 })
  usuario: string;

  @Column({ name: 'contrasena_hash' })
  contrasenaHash: string;

  @Column({ name: 'nombre_para_mostrar', length: 120 })
  nombreParaMostrar: string;

  // El nombre de columna real en MySQL sigue siendo es_superusuario a
  // propósito — esa migración ya corrió contra la base de datos real;
  // cambiarlo requeriría una migración nueva. Es solo el nombre en
  // TypeScript el que se corrigió a esSuperadmin.
  @Column({ name: 'es_superusuario', default: false })
  esSuperadmin: boolean;

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
