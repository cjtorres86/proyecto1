import { BadGatewayException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, timingSafeEqual } from 'crypto';
import { Repository } from 'typeorm';
import { Usuario } from '../../auth/entities/usuario.entity';
import { Perfil } from '../../auth/entities/perfil.entity';
import { IdentidadPortal, PERFIL_DE_ROL, PerfilPortal } from './identidad';

const APLICACION_ID = 'reporte_avance_sumarios';

@Injectable()
export class IntegracionPortalService {
  private readonly log = new Logger('IntegracionPortal');

  constructor(
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Perfil) private readonly perfiles: Repository<Perfil>,
  ) {}

  // El portal manda la lista COMPLETA de perfiles de Sumarios (al crear,
  // editar o eliminar uno en Configuración → Perfiles). Se guardan tal cual;
  // los que ya no están en la lista se borran, salvo que alguien todavía lo
  // tenga (por seguridad: nunca se deja a una persona sin perfil).
  async sincronizarPerfiles(lista: PerfilPortal[]): Promise<{ guardados: number; borrados: number }> {
    for (const p of lista) await this.guardarPerfil(p);
    const ids = new Set(lista.map((p) => p.id));
    let borrados = 0;
    for (const p of await this.perfiles.find()) {
      if (ids.has(p.id)) continue;
      const enUso = await this.usuarios.count({ where: { perfilId: p.id } });
      if (!enUso) {
        await this.perfiles.delete({ id: p.id });
        borrados++;
      }
    }
    return { guardados: lista.length, borrados };
  }

  private async guardarPerfil(p: PerfilPortal): Promise<void> {
    await this.perfiles.save({ id: p.id, nombre: p.nombre, permisos: p.permisos });
  }

  // Canjea con el portal (de servidor a servidor) el pase que trajo el
  // navegador, y deja al día la copia local de la persona.
  async ingresarConPase(pase: string): Promise<Usuario> {
    const urlPortal = process.env.PORTAL_API_URL;
    const clave = process.env.CLAVE_INTEGRACION;
    if (!urlPortal || !clave) throw new BadGatewayException('El ingreso desde el portal no está configurado en este servidor.');
    let respuesta: Response;
    try {
      respuesta = await fetch(`${urlPortal.replace(/\/$/, '')}/ingreso-unico/canjear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-clave-aplicacion': clave },
        body: JSON.stringify({ aplicacionId: APLICACION_ID, pase }),
        signal: AbortSignal.timeout(60000), // el portal puede estar despertando (Render)
      });
    } catch {
      throw new BadGatewayException('No se pudo contactar al portal. Espera un minuto y vuelve a entrar desde el portal.');
    }
    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => ({}))) as { message?: string };
      throw new UnauthorizedException(cuerpo.message ?? 'No se pudo validar el ingreso. Vuelve a entrar desde el portal.');
    }
    const identidad = (await respuesta.json()) as IdentidadPortal;
    const usuario = await this.sincronizar(identidad);
    if (!usuario || !usuario.activo) throw new UnauthorizedException('Tu cuenta no tiene acceso a Avance de Sumarios.');
    return usuario;
  }

  // El portal avisa que una persona cambió (perfil, SLEP, permiso, o que se
  // desactivó): se verifica que el aviso venga de verdad del portal.
  verificarClavePortal(claveRecibida: string | undefined): void {
    const clave = process.env.CLAVE_INTEGRACION;
    if (!clave || !claveRecibida || !mismaClave(claveRecibida, clave)) throw new UnauthorizedException('Aviso no autorizado.');
  }

  // Deja la copia local de la persona igual a lo que dice el portal. La
  // empareja por portal_id y, la primera vez, por usuario (así las cuentas
  // que ya existían conservan su historial: autoría de datos, Bitácora).
  async sincronizar(i: IdentidadPortal): Promise<Usuario | null> {
    if (!i.usuario) return null;
    let u =
      (await this.usuarios.findOne({ where: { portalId: i.portalId } })) ??
      (await this.usuarios.findOne({ where: { usuario: i.usuario } }));
    if (!u) {
      // Persona nueva que todavía no existía en Sumarios. Si no tiene acceso,
      // no hace falta crearla.
      if (!i.tieneAcceso || !i.activo) return null;
      u = this.usuarios.create({ contrasenaHash: null });
    }
    u.portalId = i.portalId;
    u.usuario = i.usuario;
    u.nombreParaMostrar = i.nombreParaMostrar;
    if (i.rut && !u.rut) u.rut = i.rut;
    // Sin acceso a Sumarios (o desactivada en el portal) = desactivada aquí.
    u.activo = i.activo && i.tieneAcceso;
    if (i.esSuperadmin) {
      u.esSuperadmin = true;
      u.perfilId = null;
      u.alcance = 'todos';
      u.puedeCargarDatos = true;
    } else if (i.tieneAcceso) {
      // Desde la etapa 3 el portal manda el perfil completo (su id es el de
      // Sumarios): se guarda primero, así existe aunque sea nuevo (ej. Visita).
      if (i.perfil) await this.guardarPerfil(i.perfil);
      const perfilId = i.perfil?.id ?? PERFIL_DE_ROL[i.rol ?? ''];
      if (!perfilId) {
        this.log.warn(`Perfil "${i.rol}" del portal sin equivalente en Sumarios (${i.usuario}): se desactiva por seguridad.`);
        u.activo = false;
      } else {
        u.esSuperadmin = false;
        u.perfilId = perfilId;
        u.alcance = !i.alcance.length || i.alcance.includes('todos') ? 'todos' : i.alcance[0];
        u.puedeCargarDatos = i.rol === 'Digitador' ? true : !!i.opciones.cargar_datos;
      }
    }
    const { perfil: _p, ...sinRelacion } = u as Usuario & { perfil?: unknown };
    await this.usuarios.save(sinRelacion);
    return this.usuarios.findOne({ where: { id: u.id } });
  }
}

function mismaClave(a: string, b: string): boolean {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
