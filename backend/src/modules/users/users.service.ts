import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../../auth/entities/usuario.entity';
import { Perfil } from '../../auth/entities/perfil.entity';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { CrearPerfilDto } from './dto/crear-perfil.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Perfil) private readonly perfiles: Repository<Perfil>,
  ) {}

  async listarUsuarios(): Promise<Omit<Usuario, 'contrasenaHash'>[]> {
    const lista = await this.usuarios.find();
    return lista.map(({ contrasenaHash, ...resto }) => resto);
  }

  async crearUsuario(dto: CrearUsuarioDto) {
    const existente = await this.usuarios.findOne({ where: { usuario: dto.usuario } });
    if (existente) throw new BadRequestException(`Ya existe un usuario "${dto.usuario}".`);
    const nuevo = this.usuarios.create({
      usuario: dto.usuario,
      contrasenaHash: await bcrypt.hash(dto.contrasena, 10),
      nombreParaMostrar: dto.nombreParaMostrar,
      alcance: dto.alcance,
      perfilId: dto.esSuperadmin ? null : dto.perfilId ?? null,
      esSuperadmin: !!dto.esSuperadmin,
    });
    const guardado = await this.usuarios.save(nuevo);
    const { contrasenaHash, ...resto } = guardado;
    return resto;
  }

  // Completar una cuenta pendiente, o editar una ya activa (mejora
  // post-v2.23). "usuario" solo se acepta si la cuenta todavía no tenía
  // uno — completar un SLEP pendiente por primera vez, nunca renombrar
  // una cuenta que ya existe. Si se manda "usuario" nuevo, hace falta
  // "contrasena" en el mismo pedido (o ya tenerla) — no tendría sentido
  // una cuenta con usuario pero sin ninguna clave con la que entrar.
  async actualizarUsuario(id: string, dto: ActualizarUsuarioDto) {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');

    if (dto.usuario && dto.usuario !== usuario.usuario) {
      if (usuario.usuario) {
        throw new BadRequestException('Esta cuenta ya tiene un usuario asignado; no se puede cambiar por acá.');
      }
      const enUso = await this.usuarios.findOne({ where: { usuario: dto.usuario } });
      if (enUso) throw new BadRequestException(`Ya existe un usuario "${dto.usuario}".`);
      if (!dto.contrasena) throw new BadRequestException('Para asignar un usuario nuevo, también hace falta una contraseña.');
      usuario.usuario = dto.usuario;
    }
    if (dto.rut && dto.rut !== usuario.rut) {
      const enUso = await this.usuarios.findOne({ where: { rut: dto.rut } });
      if (enUso) throw new BadRequestException(`El RUT "${dto.rut}" ya está asociado a otra cuenta.`);
      usuario.rut = dto.rut;
    }
    if (dto.contrasena) usuario.contrasenaHash = await bcrypt.hash(dto.contrasena, 10);
    if (dto.nombreParaMostrar) usuario.nombreParaMostrar = dto.nombreParaMostrar;
    if (dto.alcance) usuario.alcance = dto.alcance;
    if (dto.perfilId) usuario.perfilId = dto.perfilId;
    const guardado = await this.usuarios.save(usuario);
    const { contrasenaHash, ...resto } = guardado;
    return resto;
  }

  // Activar/desactivar (mejora post-v2.23): una cuenta desactivada no
  // puede iniciar sesión (AuthService.validarCredenciales), sin borrar
  // nada — conserva su historial en la Bitácora.
  async cambiarActivo(id: string, activo: boolean) {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    usuario.activo = activo;
    const guardado = await this.usuarios.save(usuario);
    const { contrasenaHash, ...resto } = guardado;
    return resto;
  }

  async listarPerfiles(): Promise<Perfil[]> {
    return this.perfiles.find();
  }

  // Crear/editar perfiles es exclusivo del superadmin (TDD, sección
  // 11.2.1) — verificado en el controller, no acá; este método asume
  // que ya se autorizó.
  async crearPerfil(dto: CrearPerfilDto) {
    const existente = await this.perfiles.findOne({ where: { id: dto.id } });
    if (existente) throw new BadRequestException(`Ya existe un perfil con id "${dto.id}".`);
    const nuevo = this.perfiles.create({
      id: dto.id,
      nombre: dto.nombre,
      permisos: { vistas: dto.vistas, acciones: dto.acciones, gestion: dto.gestion },
    });
    return this.perfiles.save(nuevo);
  }
}
