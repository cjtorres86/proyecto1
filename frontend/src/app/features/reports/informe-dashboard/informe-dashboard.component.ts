import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgClass, NgTemplateOutlet, Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { fmt, pct } from '../../../core/utils/avance';
import { INTERRUPTOR_TEMA, descargarHtml, documentoAutonomo, estilosDeLaPagina, jsonParaScript } from '../../../core/utils/guardar-html';
import { ThemeToggleComponent } from '../../../shared/theme-toggle/theme-toggle.component';
import { BitacoraApiService } from '../../bitacora/services/bitacora-api.service';
import { DashboardApiService } from '../../dashboard/services/dashboard-api.service';
import { Cifra, ModeloDashboard, RankingLic, armarDashboard, dias, nivelDe, numeracion, posLicencia, rem } from '../../dashboard/modelo-dashboard';
import { generarDocumento, svgAImagen } from '../documentos-informe';
import { graficosDashboard } from './graficos-dashboard';

type Grafico = { cap: string; img: Awaited<ReturnType<typeof svgAImagen>> };
import { OCULTOS_AL_GUARDAR } from '../informe-guardado';
import { activarTipsDashboard } from './tips-dashboard';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const NIVEL_TXT = { bajo: 'Avance bajo', medio: 'Avance medio', alto: 'Avance alto', na: 'Sin sumarios instruidos' } as const;
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

// Informe interactivo de dashboard (/informe-dashboard?mes=&anio=&slep=): el
// Dashboard de la aplicación (mismo cálculo: modelo-dashboard.ts) con el
// lenguaje de los informes. Con &imprimir=1 es el Informe estático de
// dashboard: la misma página, siempre en claro, que abre sola la impresión.
@Component({
  selector: 'app-informe-dashboard',
  standalone: true,
  imports: [NgClass, NgTemplateOutlet, ThemeToggleComponent],
  templateUrl: './informe-dashboard.component.html',
  styleUrls: ['../informe-interactivo.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class InformeDashboardComponent implements OnInit, OnDestroy {
  estado: 'cargando' | 'listo' | 'error' | 'sin-permiso' = 'cargando';
  mensaje = '';
  imprimir = false;
  logo = '';
  usuario = { nombre: '', perfil: '' };
  alcanceTodos = false;
  // Meses con información, por año (enero a diciembre).
  private meses: { mes: string; anio: string }[] = [];
  anios: string[] = [];
  sleps: string[] = [];
  anio = '';
  mes = '';
  slep: string | null = null;

  modelo: ModeloDashboard | null = null;
  cargandoDatos = false;
  private totalSleps = 0;
  private num = numeracion(undefined);
  private porSlep = new Map<string, { slep: string; valor: number }[]>();
  // Desgloses por SLEP de cada campo (tooltip "SLEP que más aportan").
  private des: Record<string, { slep: string; valor: number }[]> = {};

  panel: 'informe' | 'ayuda' | null = null;
  formato: 'pdf' | 'xlsx' | 'html' = 'pdf';
  generando = false;
  estadoInforme: { tipo: '' | 'ok' | 'err'; texto: string } = { tipo: '', texto: '' };
  guardando = false;
  barraPegada = false;

  readonly fmt = fmt;
  readonly pct = pct;
  readonly rem = rem;
  readonly posLic = posLicencia;
  readonly dias = dias;
  @ViewChild('barra') private barra?: ElementRef<HTMLElement>;
  private quitarTips?: () => void;
  private quitarClaroAlImprimir?: () => void;
  private impreso = false;
  private vistaRegistrada = false;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly ruta: ActivatedRoute,
    private readonly location: Location,
    private readonly theme: ThemeService,
    private readonly dashboardApi: DashboardApiService,
    private readonly bitacora: BitacoraApiService,
  ) {}

  private get nombre(): string {
    return this.imprimir ? 'Informe estático de dashboard' : 'Informe interactivo de dashboard';
  }

  get mesesDelAnio(): string[] {
    return this.meses.filter((m) => m.anio === this.anio).map((m) => m.mes);
  }

  async ngOnInit(): Promise<void> {
    const q = this.ruta.snapshot.queryParamMap;
    this.imprimir = q.get('imprimir') === '1';
    if (this.imprimir) this.theme.forzarClaroSinGuardar();
    else this.quitarClaroAlImprimir = this.theme.claroAlImprimir();
    if (!this.auth.can('exportar_informe') || !this.auth.can('dashboard')) {
      this.estado = 'sin-permiso';
      return;
    }
    const u = this.auth.usuarioActual();
    this.usuario = { nombre: u?.nombreParaMostrar ?? '', perfil: u?.esSuperadmin ? 'Superadmin' : (u?.perfil?.nombre ?? '') };
    this.alcanceTodos = !!u && (u.esSuperadmin || u.alcance === 'todos');
    try {
      const [meses, sleps, logo] = await Promise.all([
        firstValueFrom(this.http.get<{ mes: string; anio: string }[]>(`${environment.apiUrl}/cases/meses-disponibles`)),
        this.alcanceTodos ? firstValueFrom(this.http.get<{ nombre: string }[]>(`${environment.apiUrl}/forms/slep`)) : Promise.resolve([]),
        this.logoComoDataUrl(),
      ]);
      const clave = (m: { mes: string; anio: string }) => +m.anio * 12 + MESES.indexOf(m.mes);
      this.meses = meses.filter((m) => MESES.includes(m.mes)).sort((a, b) => clave(a) - clave(b));
      if (!this.meses.length) {
        this.estado = 'error';
        this.mensaje = 'Todavía no hay meses con información para el dashboard.';
        return;
      }
      this.anios = [...new Set(this.meses.map((m) => m.anio))];
      this.sleps = sleps.map((s) => s.nombre).sort((a, b) => a.localeCompare(b, 'es'));
      this.logo = logo;
      // Mes pedido (o el más reciente) y SLEP pedido (quien ve uno solo, el suyo).
      const pedido = this.meses.find((m) => m.mes === q.get('mes') && m.anio === q.get('anio')) ?? this.meses[this.meses.length - 1];
      this.anio = pedido.anio;
      this.mes = pedido.mes;
      const slepPedido = q.get('slep');
      this.slep = !this.alcanceTodos ? (u?.alcance ?? null) : slepPedido && this.sleps.includes(slepPedido) ? slepPedido : null;
      this.estado = 'listo';
      this.cargar();
    } catch {
      this.estado = 'error';
      this.mensaje = 'No se pudo cargar el dashboard. Espera un minuto y vuelve a intentarlo.';
    }
  }

  // Pide el Dashboard del mes y SLEP elegidos (sin salir de la página) y deja
  // la dirección al día, para que un enlace o F5 abran lo mismo.
  private cargar(): void {
    this.cargandoDatos = true;
    this.notasAbiertas = null;
    this.modelo = null;
    this.des = {};
    this.porSlep.clear();
    document.title = `${this.nombre} - ${this.mes} ${this.anio}${this.slep ? ` - ${this.slep}` : ''} · Avance de Sumarios`;
    const p = new URLSearchParams({ mes: this.mes, anio: this.anio });
    if (this.slep && this.alcanceTodos) p.set('slep', this.slep);
    if (this.imprimir) p.set('imprimir', '1');
    this.location.replaceState(`/informe-dashboard?${p.toString()}`);
    const { mes, anio } = this;
    const desglose = (campo: string) => this.dashboardApi.getDesglose(mes, anio, campo).pipe(catchError(() => of([])));
    forkJoin({ dash: this.dashboardApi.getDashboard(mes, anio, this.slep ?? undefined), q21: desglose('Q21'), q22: desglose('Q22') }).subscribe({
      next: (r) => {
        if (mes !== this.mes || anio !== this.anio) return; // llegó tarde: ya se pidió otro mes
        this.porSlep.set('Q21', r.q21);
        this.porSlep.set('Q22', r.q22);
        this.des = { Q21: r.q21, Q22: r.q22 };
        this.totalSleps = r.dash.totalContenedores;
        this.num = numeracion(r.dash.numeros);
        this.modelo = armarDashboard(r.dash, { slepActivo: this.slep, mes, anio, porSlep: this.porSlep, licenciasCompletas: true });
        this.cargandoDatos = false;
        setTimeout(() => this.alDibujar());
      },
      error: () => {
        this.cargandoDatos = false;
        this.estado = 'error';
        this.mensaje = 'No se pudo cargar el dashboard de ese mes. Espera un minuto y vuelve a intentarlo.';
      },
    });
  }

  // Ya dibujado: detalle al pasar el mouse, barra acomodada y, en el
  // estático, la ventana de impresión (una sola vez).
  private alDibujar(): void {
    this.quitarTips?.();
    const raiz = document.querySelector<HTMLElement>('.ia.id');
    if (raiz) {
      this.quitarTips = activarTipsDashboard(raiz, {
        ambito: this.slep ?? `Todos los SLEP · ${this.mes} ${this.anio}`,
        consolidado: !this.slep,
        des: this.des,
        pedir: (campo) => firstValueFrom(this.dashboardApi.getDesglose(this.mes, this.anio, campo)),
      });
    }
    this.acomodarBarra();
    // Hojas del PDF listas también para Ctrl+P (de nuevo cuando llegan las fuentes).
    this.ajustarHojas();
    document.fonts.ready.then(() => this.ajustarHojas());
    if (!this.vistaRegistrada && !this.imprimir) {
      this.vistaRegistrada = true;
      this.bitacora.registrarEvento('informe_visto', `Vio el ${this.nombre} — ${this.mes} ${this.anio}${this.slep ? ` — ${this.slep}` : ''}.`);
    }
    if (this.imprimir && !this.impreso) {
      this.impreso = true;
      this.bitacora.registrarEvento('informe_pdf_descargado', `Descargó el PDF de ${this.nombre} — ${this.mes} ${this.anio}${this.slep ? ` — ${this.slep}` : ''}.`);
      document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        this.ajustarHojas();
        window.print();
      })));
    }
  }

  elegirAnio(a: string): void {
    if (a === this.anio) return;
    this.anio = a;
    const meses = this.mesesDelAnio;
    this.mes = meses.includes(this.mes) ? this.mes : meses[meses.length - 1];
    this.cargar();
  }
  elegirMes(m: string): void {
    this.mes = m;
    this.cargar();
  }
  elegirSlep(s: string): void {
    this.slep = s || null;
    this.cargar();
  }

  alternarPanel(p: 'informe' | 'ayuda' | null): void {
    this.panel = this.panel === p ? null : p;
    if (this.panel === 'informe') this.estadoInforme = { tipo: '', texto: '' };
  }

  salir(): void {
    this.auth.logout();
  }

  // ---------- Ayudas de la plantilla ----------
  n(id: string): number | string {
    return this.num.n(id);
  }
  et(id: string, label: string): string {
    return this.num.et(id, label);
  }
  nivel(av: number | null): string {
    return nivelDe(av);
  }
  textoNivel(av: number | null): string {
    return NIVEL_TXT[nivelDe(av)];
  }
  valorLic(r: RankingLic, v: number): string {
    return r.unidad === '$' ? rem(v) : `${fmt(v)} d`;
  }
  // % de avance, del color de su nivel: alto azul, medio celeste y solo el
  // bajo en rojo (en oscuro neón: cian, azul y rosado).
  colorAvance(a: number): string {
    return `var(--${nivelDe(a)})`;
  }
  // Barras de los desgloses: la mayor, en el color más intenso.
  colorBarra(rango: number): string {
    const fuerza = [100, 80, 64, 50, 40, 32, 26][Math.min(rango, 6)];
    return `color-mix(in srgb, var(--accent) ${fuerza}%, var(--surface-2))`;
  }
  tip(id: string | null, l: string, v: number | null, bt = '', b: number | null = null): string {
    return JSON.stringify({ id, l, v, bt, b });
  }

  // ---------- Barra fija ----------
  @HostListener('window:scroll')
  alDesplazar(): void {
    const b = this.barra?.nativeElement;
    this.barraPegada = !!b && b.getBoundingClientRect().top <= 1 && scrollY > 0;
  }
  // Acciones en la misma fila que los filtros; si no caben, se compactan y,
  // si ni así, pasan juntas a su propia fila (ver .compacta / .apilada).
  @HostListener('window:resize')
  acomodarBarra(): void {
    const tb = this.barra?.nativeElement;
    const acc = tb?.querySelector<HTMLElement>('.tb-acc'), ref = tb?.querySelector<HTMLElement>('.tb-in>.field');
    if (!tb || !acc || !ref) return;
    tb.classList.remove('compacta', 'apilada');
    const baja = () => acc.offsetTop >= ref.offsetTop + ref.offsetHeight - 1;
    if (!baja()) return;
    tb.classList.add('compacta');
    if (baja()) {
      tb.classList.remove('compacta');
      tb.classList.add('apilada');
    }
  }

  @HostListener('document:keydown.escape')
  alEscape(): void {
    if (this.notasAbiertas) this.cerrarNotas();
    else this.panel = null;
  }

  // ---------- Avance en una sola línea ----------
  // Cerrados de instruidos y cuánto falta para la meta (sin cápsulas aparte).
  lineaAvance(M: ModeloDashboard): string {
    if (M.av === null) return M.frase;
    const faltan = Math.max(M.instruidos - M.cerrados, 0);
    return `${M.frase.replace(/\.$/, '')}; ${faltan ? `faltan ${fmt(faltan)} para la meta del 100 %` : 'meta cumplida: todos tienen su proceso cerrado'}.`;
  }

  // Bajo el avance, en la tarjeta 1: casos informados y licencias médicas
  // (campos 4 y 5); los funcionarios involucrados están en la dona.
  puntosResumen(M: ModeloDashboard): Cifra[] {
    return M.origen.filter((c) => c.id === 'Q04' || c.id === 'Q05');
  }

  // ---------- Notas (ⓘ) por sección ----------
  // No se muestran a la vista: cada sección con notas tiene su botón «Notas»
  // que abre la ventana con todas, ordenadas por sección.
  notasAbiertas: string | null = null;
  get seccionesNotas(): { clave: string; eyebrow: string; titulo: string; notas: string[] }[] {
    const M = this.modelo;
    if (!M) return [];
    return [
      { clave: 'resumen', eyebrow: `${this.numero('resumen')} · ${this.slep ? 'Servicio Local' : 'Consolidado'}`, titulo: this.slep ?? 'Todos los SLEP', notas: M.capsulasOrigen },
      { clave: 'involucrados', eyebrow: `${this.numero('involucrados')} · Involucrados`, titulo: 'Situación de los funcionarios involucrados', notas: M.capsulasInvolucrados },
      ...M.desgloses.map((b) => ({ clave: b.clave, eyebrow: `${this.numero(b.clave)} · ${this.sinNumero(b.eyebrow)}`, titulo: b.titulo, notas: b.capsulas })),
      M.licenciasSlep
        ? { clave: 'licencias', eyebrow: `${this.numero('licencias')} · Licencias`, titulo: 'Duración de las licencias y remuneración promedio', notas: [M.licenciasSlep.nota] }
        : { clave: 'licencias', eyebrow: `${this.numero('licencias')} · Licencias`, titulo: 'Los SLEP con las licencias más largas y las remuneraciones más altas', notas: M.rankingsLic.map((r) => r.capsula).filter(Boolean) },
    ].filter((s) => s.notas.length);
  }

  // Número de cada tarjeta en el informe: Licencias va al final (6, o 7 si
  // hay Anexo); los números de campo del formulario no cambian.
  numero(clave: string): number {
    const orden: Record<string, number> = { resumen: 1, involucrados: 2, cic: 3, proc: 4, san: 5, anexo: 6 };
    return orden[clave] ?? (this.modelo?.anexo.length ? 7 : 6);
  }
  sinNumero(eyebrow: string): string {
    return eyebrow.replace(/^\d+ · /, '');
  }

  // ---------- Hojas del PDF ----------
  // Cada hoja mide el área imprimible de una carta vertical (con los márgenes
  // de @page). Si su contenido no cabe, se reduce entero (zoom uniforme, sin
  // cortar ninguna tarjeta); si sobra espacio, lo ocupa la nota de relleno.
  ajustarHojas(): void {
    document.querySelectorAll<HTMLElement>('.hojas-pdf .hoja-pdf').forEach((hoja) => {
      const cont = hoja.querySelector<HTMLElement>('.hoja-cont'), nota = hoja.querySelector<HTMLElement>('.nota-relleno');
      if (!cont) return;
      const alto = hoja.clientHeight, ancho = hoja.clientWidth;
      cont.style.zoom = '';
      cont.style.width = '';
      // Alto natural del contenido, sin la nota ni el alto mínimo de la hoja.
      cont.style.minHeight = '0';
      if (nota) nota.hidden = true;
      let h = cont.scrollHeight;
      cont.style.minHeight = '';
      if (h > alto) {
        let z = alto / h;
        cont.style.minHeight = '0';
        for (let i = 0; i < 3; i++) {
          cont.style.width = `${ancho / z}px`;
          cont.style.zoom = String(z);
          h = cont.scrollHeight;
          if (h * z <= alto) break;
          z = Math.min(z, (alto / h) * 0.995);
        }
      } else if (hoja.classList.contains('llenar') && h < alto) {
        // Hoja 1: se agranda (hasta 1,5 veces) hasta ocupar la hoja completa.
        let z = Math.min(1.5, alto / h);
        cont.style.minHeight = '0';
        for (let i = 0; i < 4 && z > 1; i++) {
          cont.style.width = `${ancho / z}px`;
          cont.style.zoom = String(z);
          h = cont.scrollHeight;
          if (h * z <= alto) break;
          z = Math.max(1, (alto / h) * 0.995);
        }
        // Alto mínimo = la hoja, en la escala agrandada (para la nota, si va).
        cont.style.minHeight = `${alto / z}px`;
        if (nota && alto - h * z >= 90) nota.hidden = false;
      } else if (nota && alto - h >= 90) {
        nota.hidden = false;
      }
    });
  }
  notasDe(clave: string): string[] {
    return this.seccionesNotas.find((s) => s.clave === clave)?.notas ?? [];
  }
  abrirNotas(clave: string): void {
    this.notasAbiertas = clave;
    setTimeout(() => {
      document.querySelector(`#notas [data-sec="${clave}"]`)?.scrollIntoView({ block: 'nearest' });
      document.querySelector<HTMLElement>('#notas [data-cerrar-notas]')?.focus();
    });
  }
  cerrarNotas(): void {
    const clave = this.notasAbiertas;
    this.notasAbiertas = null;
    if (clave) setTimeout(() => document.querySelector<HTMLElement>(`[data-notas="${clave}"]`)?.focus());
  }

  // ---------- Generar informe (PDF, Excel o HTML interactivo) ----------
  async generar(): Promise<void> {
    if (!this.modelo || this.generando) return;
    if (this.formato === 'pdf') return this.imprimirPdf();
    this.generando = true;
    this.estadoInforme = { tipo: '', texto: 'Preparando el informe…' };
    if (this.formato === 'html') {
      try {
        this.estadoInforme = { tipo: 'ok', texto: `Informe guardado: ${await this.guardar()}` };
      } catch (e) {
        this.estadoInforme = { tipo: 'err', texto: `No fue posible guardar el informe: ${(e as Error).message}` };
      } finally {
        this.generando = false;
      }
      return;
    }
    try {
      // Gráficos de cada bloque como imagen (azules y grises; rojo solo si el avance es bajo).
      const G = graficosDashboard(this.modelo, { ambito: this.slep ?? 'todos los SLEP', consolidado: !this.slep, et: (id, l) => this.et(id, l) });
      const imagenes: Record<string, Grafico[]> = {};
      for (const [clave, lista] of Object.entries(G)) {
        imagenes[clave] = await Promise.all(lista.map(async (g) => ({ cap: g.cap, img: await svgAImagen(g.svg, g.W, g.H) })));
      }
      const nombre = await generarDocumento(this.modeloDocumento(this.modelo, imagenes), this.formato, this.logo);
      this.estadoInforme = { tipo: 'ok', texto: `Informe generado: ${nombre}` };
    } catch (e) {
      this.estadoInforme = { tipo: 'err', texto: `No fue posible generar el informe: ${(e as Error).message}` };
    } finally {
      this.generando = false;
    }
  }

  // PDF: esta misma página con el diseño del informe estático (en claro, hoja
  // carta). Se abre la ventana de impresión del navegador ("Guardar como PDF");
  // el título de la pestaña es el nombre que se propone para el archivo.
  private imprimirPdf(): void {
    const titulo = document.title;
    document.title = `Informe de dashboard - ${this.mes} ${this.anio}${this.slep ? ` - ${this.slep}` : ''}`;
    window.addEventListener('afterprint', () => (document.title = titulo), { once: true });
    this.bitacora.registrarEvento('informe_pdf_descargado', `Descargó el PDF de ${this.nombre} — ${this.mes} ${this.anio}${this.slep ? ` — ${this.slep}` : ''}.`);
    this.estadoInforme = { tipo: 'ok', texto: 'Se abrió la ventana de impresión: elige «Guardar como PDF».' };
    this.ajustarHojas();
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  // El dashboard como modelo de documento (documentos-informe.ts): un
  // apartado por bloque, en el orden de la pantalla, con su gráfico, su tabla
  // y sus observaciones.
  private modeloDocumento(M: ModeloDashboard, g: Record<string, Grafico[]>) {
    const sinMarca = () => new Set<number>();
    const fila = (c: unknown[], o: { bold?: boolean; txtRow?: boolean; over?: Set<number> } = {}) => ({ c, over: o.over ?? sinMarca(), bold: o.bold, txtRow: o.txtRow });
    const hoy = new Date().toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const mm = String(MESES.indexOf(this.mes) + 1).padStart(2, '0');
    const secs: unknown[] = [];
    secs.push({ h: `${this.numero('resumen')} · Avance de los sumarios`, sheet: 'Resumen', p: [this.lineaAvance(M), ...M.capsulasOrigen], charts: g['avance'],
      table: { cols: [{ h: 'Dato', t: 'txt', w: 2.6 }, { h: 'Valor', t: 'txt', w: 1.4 }], rows: [
        fila([this.et('Q37', 'Sumarios instruidos'), fmt(M.instruidos)], { txtRow: true }),
        fila([this.et('Q45', 'Procesos cerrados'), fmt(M.cerrados)], { txtRow: true }),
        fila(['Por cerrar para la meta (100 %)', fmt(Math.max(M.instruidos - M.cerrados, 0))], { txtRow: true }),
        fila(['% de avance', M.av === null ? 'Sin sumarios instruidos' : `${pct(M.av)} · ${this.textoNivel(M.av).toLowerCase()}`], { txtRow: true, bold: true }),
        ...this.puntosResumen(M).map((c) => fila([this.et(c.id, c.label), fmt(c.valor)], { txtRow: true })),
      ] } });
    secs.push({ h: `${this.numero('involucrados')} · Involucrados: situación de los funcionarios`, sheet: 'Involucrados', p: M.capsulasInvolucrados, charts: g['involucrados'],
      table: { cols: [{ h: 'Campo', t: 'txt', w: 2.6 }, { h: 'Funcionarios', t: 'n' }, { h: '% de los involucrados', t: 'p' }],
        rows: [...M.dona.partes.map((p) => fila([p.label, p.valor, p.pct])), fila(['Total involucrados', M.dona.total, M.dona.total ? 1 : null], { bold: true })] } });
    for (const b of M.desgloses) {
      secs.push({ h: `${this.numero(b.clave)} · ${this.sinNumero(b.eyebrow)}: ${b.titulo}`, sheet: this.sinNumero(b.eyebrow), p: [b.orden, ...b.capsulas], charts: g[`des-${b.clave}`],
        table: { cols: [{ h: 'Campo', t: 'txt', w: 2.8 }, { h: 'Valor', t: 'n' }, { h: `% de ${b.principal.label.toLowerCase()}`.slice(0, 40), t: 'p' }],
          rows: [fila([this.et(b.principal.id, b.principal.label), b.principal.valor, b.principal.valor ? 1 : null], { bold: true }), ...b.filas.map((x) => fila([x.label, x.valor, b.principal.valor ? x.pct : null]))] } });
    }
    if (M.anexo.length) {
      secs.push({ h: `${this.numero('anexo')} · Anexo: seguimiento adicional`, sheet: 'Anexo', p: [],
        table: { cols: [{ h: 'Campo', t: 'txt', w: 2.8 }, { h: 'Valor', t: 'txt', w: 1.2 }], rows: M.anexo.map((c) => fila([c.label, c.id === 'Q62' ? rem(c.valor) : fmt(c.valor)], { txtRow: true })) } });
    }
    // Licencias de un solo SLEP: sus datos (campos 15 a 18), sin rankings.
    if (M.licenciasSlep) {
      const L = M.licenciasSlep;
      secs.push({ h: `${this.numero('licencias')} · Licencias: duración y remuneración promedio`, sheet: 'Licencias', p: [L.nota], charts: g['lic-slep'],
        table: { cols: [{ h: 'Campo', t: 'txt', w: 2.6 }, { h: 'Valor', t: 'txt', w: 1.2 }],
          rows: [L.minima, L.promedio, L.maxima].map((c) => fila([this.et(c.id, c.label), dias(c.valor)], { txtRow: true }))
            .concat([fila([this.et(L.remuneracion.id, L.remuneracion.label), rem(L.remuneracion.valor)], { txtRow: true, bold: true })]) } });
    }
    for (const r of M.licenciasSlep ? [] : M.rankingsLic) {
      secs.push({ h: `${this.numero('licencias')} · Licencias: ${r.titulo}`, sheet: r.id === 'Q21' ? 'Licencias' : 'Remuneraciones', p: r.capsula ? [r.capsula] : [], charts: g[`lic-${r.id}`],
        table: { cols: [{ h: 'N°', t: 'txt', w: 0.45 }, { h: 'Servicio Local', t: 'txt', w: 2 }, { h: r.unidad === '$' ? 'Remuneración promedio' : 'Días', t: 'txt', w: 1.2 }],
          rows: [...r.filas, ...(r.propia ? [r.propia] : [])].map((f) => fila([`${f.pos}°`, f.slep, this.valorLic(r, f.valor)], { txtRow: true, bold: f.propio })) } });
    }
    secs.push({ h: 'Nota metodológica', p: [`Cada dato lleva su número de campo del Formulario del mes; el consolidado suma los SLEP que informan. El % de avance corresponde a los procesos cerrados (campo ${this.n('Q45')}) divididos por los sumarios instruidos (campo ${this.n('Q37')}); la meta es el 100 %. Nivel de avance: bajo, menos de 25 %; medio, de 25 % a menos de 75 %; alto, 75 % o más. En los bloques 3, 4 y 5 cada valor se expresa como parte del dato principal del bloque. Las observaciones señalan diferencias entre campos que deberían coincidir o resumen lo importante del bloque.`] });
    return {
      title: `Informe de dashboard · ${this.mes} ${this.anio}`,
      scope: this.slep ?? `${this.totalSleps} Servicios Locales de Educación Pública`,
      file: `Informe_dashboard_sumarios_${this.anio}_${mm}${this.slep ? `_${slug(this.slep)}` : ''}`,
      fecha: hoy,
      fuente: `Fuente: Avance de Sumarios (${this.mes} ${this.anio}). Emitido el ${hoy}.`,
      secs,
    };
  }

  // ---------- HTML interactivo (formato de Generar informe) ----------
  // El dashboard del mes tal como se ve, que se abre sin el sistema y conserva
  // el detalle al pasar el mouse (con los desgloses por SLEP ya incluidos).
  // Cambiar de mes o de SLEP, Generar informe y Salir necesitan el sistema.
  async guardar(): Promise<string> {
    if (!this.modelo) throw new Error('el informe todavía no está listo.');
    if (this.guardando) throw new Error('ya se está guardando.');
    this.guardando = true;
    try {
      const raiz = document.querySelector<HTMLElement>('.ia.id');
      if (!raiz) throw new Error('el informe todavía no está listo.');
      if (!this.slep) {
        const ids = [...new Set([...raiz.querySelectorAll('[data-tip]')].map((e) => JSON.parse(e.getAttribute('data-tip') || '{}').id).filter(Boolean))] as string[];
        await Promise.all(ids.filter((id) => !this.des[id]).map(async (id) => {
          try {
            this.des[id] = await firstValueFrom(this.dashboardApi.getDesglose(this.mes, this.anio, id));
          } catch {
            this.des[id] = [];
          }
        }));
      }
      const copia = raiz.cloneNode(true) as HTMLElement;
      copia.querySelectorAll('.tb-in .field, #rpanel').forEach((x) => x.remove());
      copia.querySelector('#tip-d')?.setAttribute('hidden', '');
      const nombre = `Informe interactivo de dashboard - ${this.mes} ${this.anio}${this.slep ? ` - ${this.slep}` : ''}`;
      const hoy = new Date().toLocaleDateString('es-CL');
      const aviso = `<p style="margin:0;padding:6px 16px;background:#eef4fb;color:#25306B;font:12px Roboto,Arial,sans-serif">${nombre} · guardado el ${hoy} desde Avance de Sumarios. Los datos son los de ese momento.</p>`;
      const ctx = { ambito: this.slep ?? `Todos los SLEP · ${this.mes} ${this.anio}`, consolidado: !this.slep, des: this.des };
      const script = `document.addEventListener('DOMContentLoaded',function(){var r=document.querySelector('.ia.id');(${activarTipsDashboard.toString()})(r,${jsonParaScript(ctx)});
var b=document.getElementById('h-open'),p=document.getElementById('hpanel');if(b&&p){b.onclick=function(){p.hidden=!p.hidden;b.setAttribute('aria-expanded',String(!p.hidden))};p.querySelectorAll('[data-cerrar]').forEach(function(x){x.onclick=function(){p.hidden=true;b.setAttribute('aria-expanded','false')}})}
var v=document.getElementById('notas');if(v){var cerrar=function(){v.hidden=true};v.onclick=cerrar;v.querySelector('.notas-ventana').onclick=function(e){e.stopPropagation()};v.querySelectorAll('[data-cerrar-notas]').forEach(function(x){x.onclick=cerrar});
document.querySelectorAll('[data-notas]').forEach(function(x){x.onclick=function(){var c=x.getAttribute('data-notas');v.querySelectorAll('[data-sec]').forEach(function(s){s.classList.toggle('activa',s.getAttribute('data-sec')===c)});v.hidden=false;var s=v.querySelector('[data-sec="'+c+'"]');if(s)s.scrollIntoView({block:'nearest'})}});
document.addEventListener('keydown',function(e){if(e.key==='Escape')cerrar()})}});
${INTERRUPTOR_TEMA.script}`;
      descargarHtml(nombre, documentoAutonomo({
        titulo: nombre,
        estilos: estilosDeLaPagina() + '\n' + OCULTOS_AL_GUARDAR + INTERRUPTOR_TEMA.estilos,
        cuerpo: INTERRUPTOR_TEMA.cuerpo + aviso + copia.outerHTML,
        script,
        claseHtml: this.theme.esOscuro ? 'dark' : undefined,
      }));
      return `${nombre}.html`;
    } finally {
      this.guardando = false;
    }
  }

  private async logoComoDataUrl(): Promise<string> {
    const blob = await (await fetch('/logo-dep.png')).blob();
    return new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = ko;
      r.readAsDataURL(blob);
    });
  }

  ngOnDestroy(): void {
    this.quitarTips?.();
    this.quitarClaroAlImprimir?.();
  }
}
