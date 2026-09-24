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

  async actualizarUsuario(id: string, dto: ActualizarUsuarioDto) {
    const usuario = await this.usuarios.findOne({ where: { id } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado.');
    if (dto.contrasena) usuario.contrasenaHash = await bcrypt.hash(dto.contrasena, 10);
    if (dto.nombreParaMostrar) usuario.nombreParaMostrar = dto.nombreParaMostrar;
    if (dto.alcance) usuario.alcance = dto.alcance;
    if (dto.perfilId) usuario.perfilId = dto.perfilId;
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
