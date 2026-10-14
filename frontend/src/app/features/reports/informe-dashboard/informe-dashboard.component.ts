import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgClass, Location } from '@angular/common';
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
import { ModeloDashboard, RankingLic, armarDashboard, nivelDe, numeracion, rem } from '../../dashboard/modelo-dashboard';
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
  imports: [NgClass, ThemeToggleComponent],
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
        this.modelo = armarDashboard(r.dash, { slepActivo: this.slep, mes, anio, porSlep: this.porSlep });
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
    if (!this.vistaRegistrada && !this.imprimir) {
      this.vistaRegistrada = true;
      this.bitacora.registrarEvento('informe_visto', `Vio el ${this.nombre} — ${this.mes} ${this.anio}${this.slep ? ` — ${this.slep}` : ''}.`);
    }
    if (this.imprimir && !this.impreso) {
      this.impreso = true;
      this.bitacora.registrarEvento('informe_pdf_descargado', `Descargó el PDF de ${this.nombre} — ${this.mes} ${this.anio}${this.slep ? ` — ${this.slep}` : ''}.`);
      document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => window.print())));
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
    this.panel = null;
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
    secs.push({ h: 'Avance de los sumarios', sheet: 'Resumen', p: M.capsulasAvance, charts: g['avance'],
      table: { cols: [{ h: 'Dato', t: 'txt', w: 2.6 }, { h: 'Valor', t: 'txt', w: 1.4 }], rows: [
        ...M.identificacion.map((i) => fila([`${i.n}. ${i.label}`, i.valor], { txtRow: true })),
        fila([this.et('Q37', 'Sumarios instruidos'), fmt(M.instruidos)], { txtRow: true }),
        fila([this.et('Q45', 'Procesos cerrados'), fmt(M.cerrados)], { txtRow: true }),
        fila(['Por cerrar para la meta (100 %)', fmt(Math.max(M.instruidos - M.cerrados, 0))], { txtRow: true }),
        fila(['% de avance', M.av === null ? 'Sin sumarios instruidos' : `${pct(M.av)} · ${this.textoNivel(M.av).toLowerCase()}`], { txtRow: true, bold: true }),
      ] } });
    secs.push({ h: '1 · Origen: lo que informó Contraloría', sheet: 'Origen', p: M.capsulasOrigen, charts: g['origen'],
      table: { cols: [{ h: 'Campo', t: 'txt', w: 2.4 }, { h: 'Valor', t: 'n' }, { h: 'Nota', t: 'txt', w: 1.6 }],
        rows: M.origen.map((c) => fila([this.et(c.id, c.label), c.valor, c.nota])) } });
    secs.push({ h: '2 · Involucrados: situación de los funcionarios', sheet: 'Involucrados', p: M.capsulasInvolucrados, charts: g['involucrados'],
      table: { cols: [{ h: 'Campo', t: 'txt', w: 2.6 }, { h: 'Funcionarios', t: 'n' }, { h: '% de los involucrados', t: 'p' }],
        rows: [...M.dona.partes.map((p) => fila([p.label, p.valor, p.pct])), fila(['Total involucrados', M.dona.total, M.dona.total ? 1 : null], { bold: true })] } });
    for (const r of M.rankingsLic) {
      secs.push({ h: `3 · Licencias: ${r.titulo}`, sheet: r.id === 'Q21' ? 'Licencias' : 'Remuneraciones', p: r.capsula ? [r.capsula] : [], charts: g[`lic-${r.id}`],
        table: { cols: [{ h: 'N°', t: 'txt', w: 0.45 }, { h: 'Servicio Local', t: 'txt', w: 2 }, { h: r.unidad === '$' ? 'Remuneración promedio' : 'Días', t: 'txt', w: 1.2 }],
          rows: [...r.filas, ...(r.propia ? [r.propia] : [])].map((f) => fila([`${f.pos}°`, f.slep, this.valorLic(r, f.valor)], { txtRow: true, bold: f.propio })) } });
    }
    for (const b of M.desgloses) {
      secs.push({ h: `${b.eyebrow}: ${b.titulo}`, sheet: b.eyebrow.replace(/^\d+ · /, ''), p: [b.orden, ...b.capsulas], charts: g[`des-${b.clave}`],
        table: { cols: [{ h: 'Campo', t: 'txt', w: 2.8 }, { h: 'Valor', t: 'n' }, { h: `% de ${b.principal.label.toLowerCase()}`.slice(0, 40), t: 'p' }],
          rows: [fila([this.et(b.principal.id, b.principal.label), b.principal.valor, b.principal.valor ? 1 : null], { bold: true }), ...b.filas.map((x) => fila([x.label, x.valor, b.principal.valor ? x.pct : null]))] } });
    }
    if (M.anexo.length) {
      secs.push({ h: '7 · Anexo: seguimiento adicional', sheet: 'Anexo', p: [],
        table: { cols: [{ h: 'Campo', t: 'txt', w: 2.8 }, { h: 'Valor', t: 'txt', w: 1.2 }], rows: M.anexo.map((c) => fila([c.label, c.id === 'Q62' ? rem(c.valor) : fmt(c.valor)], { txtRow: true })) } });
    }
    if (!this.slep && M.ranking.length) {
      secs.push({ h: `Ranking de avance por SLEP · ${this.mes} ${this.anio}`, sheet: 'Ranking', p: ['1° = mayor avance; en empate, más procesos cerrados. Se destacan en rojo los servicios con avance bajo.'], charts: g['ranking'],
        table: { small: true, cols: [{ h: 'N°', t: 'txt', w: 0.45 }, { h: 'Servicio Local', t: 'txt', w: 1.9 }, { h: 'Casos', t: 'n' }, { h: 'Instruidos', t: 'n' }, { h: 'Cerrados', t: 'n' }, { h: '% de avance', t: 'p' }, { h: 'Nivel', t: 'txt', w: 1 }],
          rows: M.ranking.map((f) => fila([f.pos ? `${f.pos}°` : '—', f.slep, f.casos, f.instruidos, f.cerrados, f.av, f.av === null ? 'Sin instruidos' : NIVEL_TXT[f.nivel].replace('Avance ', '')], { over: new Set(f.nivel === 'bajo' ? [5, 6] : []) })) } });
    }
    secs.push({ h: 'Nota metodológica', p: [`Cada dato lleva su número de campo del Formulario del mes; el consolidado suma los SLEP que informan. El % de avance corresponde a los procesos cerrados (campo ${this.n('Q45')}) divididos por los sumarios instruidos (campo ${this.n('Q37')}); la meta es el 100 %. Nivel de avance: bajo, menos de 25 %; medio, de 25 % a menos de 75 %; alto, 75 % o más. En los bloques 4, 5 y 6 cada valor se expresa como parte del dato principal del bloque. Las observaciones señalan diferencias entre campos que deberían coincidir o resumen lo importante del bloque.`] });
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
var b=document.getElementById('h-open'),p=document.getElementById('hpanel');if(b&&p){b.onclick=function(){p.hidden=!p.hidden;b.setAttribute('aria-expanded',String(!p.hidden))};p.querySelectorAll('[data-cerrar]').forEach(function(x){x.onclick=function(){p.hidden=true;b.setAttribute('aria-expanded','false')}})}});
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
