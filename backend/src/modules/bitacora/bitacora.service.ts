import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { RegistroBitacora } from './entities/registro-bitacora.entity';
import { Usuario } from '../../auth/entities/usuario.entity';
import { TipoAccion } from './decorators/bitacora.decorator';

export interface FiltrosBitacora {
  usuarioId?: string;
  accion?: string;
  desde?: Date;
  hasta?: Date;
  texto?: string;
  pagina: number;
  porPagina: number;
}

// Bitácora de usuarios (mejora post-v2.23). A propósito, esta clase
// SOLO tiene "registrar" (crear) y "listar" (leer) — nunca "editar" ni
// "borrar". No es un descuido: es justo el punto de una bitácora, un
// registro que nadie puede alterar después de escrito, ni el Superadmin.
@Injectable()
export class BitacoraService {
  constructor(@InjectRepository(RegistroBitacora) private readonly registros: Repository<RegistroBitacora>) {}

  // Nunca lanza: un problema al registrar en la bitácora no debe romper
  // la acción real de la persona (guardar, chatear, etc.) — se deja
  // constancia en la consola del servidor y nada más.
  async registrar(usuario: Usuario, ip: string, accion: TipoAccion, descripcion: string, detalle?: unknown): Promise<void> {
    try {
      // TypeORM tipa mal el insert de una columna json genérica (problema
      // conocido de la librería) — el "as any" es puntual a esta única
      // llamada, no una forma general de saltarse tipos en el proyecto.
      await this.registros.insert({
        usuarioId: usuario.id,
        usuarioNombre: usuario.nombreParaMostrar,
        perfilNombre: usuario.esSuperadmin ? 'Superadmin' : (usuario.perfil?.nombre ?? '—'),
        ip,
        accion,
        descripcion,
        detalle: detalle ?? null,
      } as any);
    } catch (error) {
      console.error('No se pudo registrar en la bitácora:', error);
    }
  }

  async listar(filtros: FiltrosBitacora): Promise<{ filas: RegistroBitacora[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (filtros.usuarioId) where.usuarioId = filtros.usuarioId;
    if (filtros.accion) where.accion = filtros.accion;
    if (filtros.desde && filtros.hasta) where.creadoEn = Between(filtros.desde, filtros.hasta);
    else if (filtros.desde) where.creadoEn = MoreThanOrEqual(filtros.desde);
    else if (filtros.hasta) where.creadoEn = LessThanOrEqual(filtros.hasta);

    const qb = this.registros.createQueryBuilder('r').where(where).orderBy('r.creadoEn', 'DESC');
    if (filtros.texto) {
      qb.andWhere('(r.descripcion LIKE :texto OR r.usuarioNombre LIKE :texto)', { texto: `%${filtros.texto}%` });
    }
    const [filas, total] = await qb
      .skip((filtros.pagina - 1) * filtros.porPagina)
      .take(filtros.porPagina)
      .getManyAndCount();
    return { filas, total };
  }
}
