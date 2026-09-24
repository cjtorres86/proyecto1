import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { Usuario } from './entities/usuario.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    private readonly jwtService: JwtService,
  ) {}

  async validarCredenciales(usuario: string, contrasena: string): Promise<Usuario | null> {
    const encontrado = await this.usuarios.findOne({ where: { usuario } });
    if (!encontrado) return null;
    const claveValida = await bcrypt.compare(contrasena, encontrado.contrasenaHash);
    return claveValida ? encontrado : null;
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    return this.usuarios.findOne({ where: { id } });
  }

  login(usuario: Usuario) {
    const payload = { sub: usuario.id };
    return {
      accessToken: this.jwtService.sign(payload),
      usuario: this.aEtiquetaPublica(usuario),
    };
  }

  // Nunca se devuelve contrasenaHash al cliente — ni por accidente.
  // Hallazgo real (verificación E2E, F10): faltaba "permisos" acá — el
  // frontend los necesita para AuthService.can(), y sin ellos
  // AuthService.can() del propio Angular lanzaba TypeError en cada
  // llamada. Ninguna prueba unitaria lo detectó porque usaban su propio
  // mock, no la forma real de esta respuesta.
  aEtiquetaPublica(usuario: Usuario) {
    return {
      id: usuario.id,
      usuario: usuario.usuario,
      nombreParaMostrar: usuario.nombreParaMostrar,
      esSuperadmin: usuario.esSuperadmin,
      alcance: usuario.alcance,
      perfil: usuario.perfil ? { id: usuario.perfil.id, nombre: usuario.perfil.nombre, permisos: usuario.perfil.permisos } : null,
    };
  }
}
