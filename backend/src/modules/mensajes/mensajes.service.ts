import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from '../../auth/entities/usuario.entity';
import { Contenedor } from '../cases/entities/contenedor.entity';
import { FormularioPregunta } from '../forms/entities/formulario-pregunta.entity';
import { verificarAccesoSlep } from '../cases/acceso-slep';
import { MensajeCampo } from './entities/mensaje-campo.entity';
import { ReaccionMensaje, TIPOS_REACCION, TipoReaccion } from './entities/reaccion-mensaje.entity';
import { LecturaCampo } from './entities/lectura-campo.entity';
import { CrearMensajeDto } from './dto/mensajes.dto';

// Lo que recibe el frontend: nunca la entidad cruda. El texto de un
// mensaje eliminado no sale del servidor, y los permisos (puedeModificar)
// se calculan acá, no en el navegador.
export interface MensajeVista {
  id: string;
  texto: string | null;
  autor: { nombre: string; perfil: string };
  esMio: boolean;
  creadoEn: Date;
  editado: boolean;
  eliminado: boolean;
  respuestaA: { id: string; autor: string; texto: string | null; eliminado: boolean } | null;
  reacciones: Record<TipoReaccion, { total: number; mia: boolean }>;
  puedeModificar: boolean;
}

// Chat por campo (mejora post-v2.23). Cada conversación es de UN campo de
// UN formulario (contenedor = SLEP + mes). Quién participa se hereda de
// quién puede ver ese formulario (verificarAccesoSlep): Admin y Validador
// en cualquiera, el Digitador solo en el de su SLEP. No es en vivo: se
// lee al abrir el campo.
//
// Toda operación que cambia algo devuelve la conversación completa ya
// actualizada: el frontend solo reemplaza la lista, sin lógica propia.
@Injectable()
export class MensajesService {
  constructor(
    @InjectRepository(MensajeCampo) private readonly mensajes: Repository<MensajeCampo>,
    @InjectRepository(ReaccionMensaje) private readonly reacciones: Repository<ReaccionMensaje>,
    @InjectRepository(LecturaCampo) private readonly lecturas: Repository<LecturaCampo>,
    @InjectRepository(Contenedor) private readonly contenedores: Repository<Contenedor>,
    @InjectRepository(FormularioPregunta) private readonly recetas: Repository<FormularioPregunta>,
  ) {}

  // Conversación de un campo — de solo lectura, NO marca nada como leído
  // (mejora post-v2.23, hallazgo del propio uso: antes se marcaba solo con
  // ABRIR el campo, aunque nadie hubiera leído nada de verdad). Marcar
  // leído es una acción aparte (marcarLeido) — la dispara el frontend
  // ante una interacción real: tocar un mensaje, responder, reaccionar,
  // escribir.
  async listarHilo(contenedorId: string, preguntaId: string, usuario: Usuario): Promise<MensajeVista[]> {
    const contenedor = await this.contenedorAccesible(contenedorId, usuario);
    await this.validarPregunta(contenedor, preguntaId);
    const filas = await this.mensajes.find({
      where: { contenedorId, preguntaId },
      relations: { autor: { perfil: true }, respuestaA: { autor: true }, reacciones: true },
      order: { creadoEn: 'ASC', id: 'ASC' },
    });
    return filas.map((m) => this.aVista(m, usuario));
  }

  // Marca la conversación como leída hasta el mensaje más reciente (fecha
  // tomada de la base, no del reloj del servidor). La llaman crear/editar/
  // borrar/reaccionar (una interacción real ya implica haber leído) y el
  // endpoint explícito que dispara el frontend al tocar un mensaje,
  // responder o empezar a escribir.
  private async marcarLeido(contenedorId: string, preguntaId: string, usuarioId: string): Promise<void> {
    const ultimo = await this.mensajes.findOne({ where: { contenedorId, preguntaId }, order: { creadoEn: 'DESC' } });
    if (!ultimo) return;
    await this.lecturas.upsert({ usuarioId, contenedorId, preguntaId, leidoHasta: ultimo.creadoEn }, ['usuarioId', 'contenedorId', 'preguntaId']);
  }

  async marcarLeidoExplicito(contenedorId: string, preguntaId: string, usuario: Usuario): Promise<void> {
    await this.contenedorAccesible(contenedorId, usuario);
    await this.marcarLeido(contenedorId, preguntaId, usuario.id);
  }

  async crear(contenedorId: string, dto: CrearMensajeDto, usuario: Usuario): Promise<MensajeVista[]> {
    const contenedor = await this.contenedorAccesible(contenedorId, usuario);
    await this.validarPregunta(contenedor, dto.preguntaId);
    const texto = this.textoValido(dto.texto);
    if (dto.respuestaAId) {
      const original = await this.mensajes.findOne({ where: { id: dto.respuestaAId } });
      if (!original || original.contenedorId !== contenedorId || original.preguntaId !== dto.preguntaId) {
        throw new BadRequestException('El mensaje al que respondes no pertenece a esta conversación.');
      }
    }
    await this.mensajes.save(
      this.mensajes.create({ contenedorId, preguntaId: dto.preguntaId, autorId: usuario.id, texto, respuestaAId: dto.respuestaAId ?? null }),
    );
    await this.marcarLeido(contenedorId, dto.preguntaId, usuario.id);
    return this.listarHilo(contenedorId, dto.preguntaId, usuario);
  }

  async editar(contenedorId: string, mensajeId: string, textoNuevo: string, usuario: Usuario): Promise<MensajeVista[]> {
    const m = await this.mensajeModificable(contenedorId, mensajeId, usuario);
    const texto = this.textoValido(textoNuevo);
    m.textoOriginal ??= m.texto; // el texto original nunca se pierde
    m.texto = texto;
    m.editadoEn = new Date();
    if (!usuario.esSuperadmin) m.cambioUsado = true;
    await this.mensajes.save(m);
    await this.marcarLeido(contenedorId, m.preguntaId, usuario.id);
    return this.listarHilo(contenedorId, m.preguntaId, usuario);
  }

  async borrar(contenedorId: string, mensajeId: string, usuario: Usuario): Promise<MensajeVista[]> {
    const m = await this.mensajeModificable(contenedorId, mensajeId, usuario);
    m.eliminadoEn = new Date();
    m.eliminadoPorId = usuario.id;
    if (!usuario.esSuperadmin) m.cambioUsado = true;
    await this.mensajes.save(m);
    await this.marcarLeido(contenedorId, m.preguntaId, usuario.id);
    return this.listarHilo(contenedorId, m.preguntaId, usuario);
  }

  // Poner o sacar una reacción (alterna). Libre: no consume la regla de
  // "una sola vez".
  async reaccionar(contenedorId: string, mensajeId: string, tipo: TipoReaccion, usuario: Usuario): Promise<MensajeVista[]> {
    await this.contenedorAccesible(contenedorId, usuario);
    const m = await this.mensajes.findOne({ where: { id: mensajeId, contenedorId } });
    if (!m) throw new NotFoundException('Mensaje no encontrado.');
    if (m.eliminadoEn) throw new BadRequestException('No se puede reaccionar a un mensaje eliminado.');
    const clave = { mensajeId, usuarioId: usuario.id, tipo };
    if (await this.reacciones.count({ where: clave })) await this.reacciones.delete(clave);
    else await this.reacciones.insert(clave);
    await this.marcarLeido(contenedorId, m.preguntaId, usuario.id);
    return this.listarHilo(contenedorId, m.preguntaId, usuario);
  }

  // Cuántos mensajes sin leer tiene cada campo de un formulario, para esta
  // persona: mensajes de OTROS, no eliminados, posteriores a su última
  // lectura de ese campo. Una sola consulta agrupada por campo.
  async noLeidos(contenedorId: string, usuario: Usuario): Promise<Record<string, number>> {
    await this.contenedorAccesible(contenedorId, usuario);
    const filas: { preguntaId: string; total: string }[] = await this.mensajes
      .createQueryBuilder('m')
      .leftJoin(LecturaCampo, 'l', 'l.contenedorId = m.contenedorId AND l.preguntaId = m.preguntaId AND l.usuarioId = :usuarioId')
      .select('m.preguntaId', 'preguntaId')
      .addSelect('COUNT(*)', 'total')
      .where('m.contenedorId = :contenedorId')
      .andWhere('m.autorId <> :usuarioId')
      .andWhere('m.eliminadoEn IS NULL')
      .andWhere('(l.leidoHasta IS NULL OR m.creadoEn > l.leidoHasta)')
      .setParameters({ contenedorId, usuarioId: usuario.id })
      .groupBy('m.preguntaId')
      .getRawMany();
    return Object.fromEntries(filas.map((f) => [f.preguntaId, Number(f.total)]));
  }

  // Aviso al iniciar sesión (mejora post-v2.23): el mensaje sin leer MÁS
  // RECIENTE en cualquier SLEP y mes al que la persona tenga acceso —
  // suficiente para que el frontend seleccione mes, SLEP y campo y la
  // lleve ahí directo. null si no hay nada nuevo. Nunca de sí misma (sus
  // propios mensajes no son "novedad" para ella), nunca eliminados, y
  // nunca de un mes que un superadmin haya eliminado de la vista
  // (contenedor soft-delete) — no tendría sentido llevarla a un lugar que
  // ya no se puede abrir.
  async proximoNoLeido(usuario: Usuario): Promise<{ mes: string; anio: string; slep: string; preguntaId: string } | null> {
    const qb = this.mensajes
      .createQueryBuilder('m')
      .innerJoin(Contenedor, 'c', 'c.id = m.contenedorId')
      .leftJoin(
        LecturaCampo,
        'l',
        'l.contenedorId = m.contenedorId AND l.preguntaId = m.preguntaId AND l.usuarioId = :usuarioId',
        { usuarioId: usuario.id },
      )
      .select('c.mesConsolidado', 'mes')
      .addSelect('c.anioConsolidado', 'anio')
      .addSelect('c.slep', 'slep')
      .addSelect('m.preguntaId', 'preguntaId')
      .where('m.autorId <> :usuarioId', { usuarioId: usuario.id })
      .andWhere('m.eliminadoEn IS NULL')
      .andWhere('(l.leidoHasta IS NULL OR m.creadoEn > l.leidoHasta)')
      .orderBy('m.creadoEn', 'DESC')
      .limit(1);
    if (!usuario.esSuperadmin && usuario.alcance !== 'todos') qb.andWhere('c.slep = :slep', { slep: usuario.alcance });
    return (await qb.getRawOne()) ?? null;
  }

  // El formulario debe existir (y no estar eliminado) y la persona debe
  // tener acceso a su SLEP — la misma regla que los formularios.
  private async contenedorAccesible(contenedorId: string, usuario: Usuario): Promise<Contenedor> {
    const [contenedor] = await this.contenedores.find({ where: { id: contenedorId } }); // 1 consulta (ver CasesService.obtenerContenedor)
    if (!contenedor) throw new NotFoundException('Formulario no encontrado.');
    verificarAccesoSlep(contenedor.slep, usuario);
    return contenedor;
  }

  private async validarPregunta(contenedor: Contenedor, preguntaId: string): Promise<void> {
    const existe = await this.recetas.count({ where: { formularioId: contenedor.formularioId, preguntaId } });
    if (!existe) throw new BadRequestException('El campo no pertenece a este formulario.');
  }

  // Editar/borrar: solo el propio autor, una única vez en total; el
  // superadmin puede siempre, sobre cualquier mensaje.
  private async mensajeModificable(contenedorId: string, mensajeId: string, usuario: Usuario): Promise<MensajeCampo> {
    await this.contenedorAccesible(contenedorId, usuario);
    const m = await this.mensajes.findOne({ where: { id: mensajeId, contenedorId } });
    if (!m) throw new NotFoundException('Mensaje no encontrado.');
    if (m.eliminadoEn) throw new BadRequestException('El mensaje ya fue eliminado.');
    if (!usuario.esSuperadmin) {
      if (m.autorId !== usuario.id) throw new ForbiddenException('Solo puedes modificar tus propios mensajes.');
      if (m.cambioUsado) throw new BadRequestException('Ya usaste la única edición o borrado permitido para este mensaje.');
    }
    return m;
  }

  private textoValido(texto: string): string {
    const limpio = (texto ?? '').trim();
    if (!limpio) throw new BadRequestException('El mensaje no puede estar vacío.');
    return limpio;
  }

  private aVista(m: MensajeCampo, usuario: Usuario): MensajeVista {
    const eliminado = !!m.eliminadoEn;
    const reacciones = Object.fromEntries(
      TIPOS_REACCION.map((tipo) => {
        const deTipo = m.reacciones.filter((r) => r.tipo === tipo);
        return [tipo, { total: deTipo.length, mia: deTipo.some((r) => r.usuarioId === usuario.id) }];
      }),
    ) as MensajeVista['reacciones'];
    const r = m.respuestaA;
    return {
      id: m.id,
      texto: eliminado ? null : m.texto,
      autor: { nombre: m.autor.nombreParaMostrar, perfil: m.autor.esSuperadmin ? 'Superadmin' : (m.autor.perfil?.nombre ?? '') },
      esMio: m.autorId === usuario.id,
      creadoEn: m.creadoEn,
      editado: !!m.editadoEn && !eliminado,
      eliminado,
      respuestaA: r
        ? { id: r.id, autor: r.autor.nombreParaMostrar, texto: r.eliminadoEn ? null : r.texto.slice(0, 140), eliminado: !!r.eliminadoEn }
        : null,
      reacciones,
      puedeModificar: !eliminado && (usuario.esSuperadmin || (m.autorId === usuario.id && !m.cambioUsado)),
    };
  }
}
