import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, forkJoin, switchMap, of, catchError } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { DashboardApiService } from '../services/dashboard-api.service';
import { DashboardDeMes } from '../../../core/models/dashboard.model';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';
import { escaparHtml, fmt, pct } from '../../../core/utils/avance';

// Paleta PROPIA de la aplicación (la de la línea superior del encabezado):
// azules y grises. La única excepción es el % de avance y su barra, que usan
// la gama de rojo a azul del informe, justo para que resalten sobre todo lo demás.
export const PALETA = ['#1E4FA0', '#006BB9', '#3ABFF0', '#8FB2F5', '#94A3B8', '#CBD5E1', '#25306B'];
// Niveles de avance del Ranking: bajo = gris acero, medio = celeste, alto = azul intenso.
export const NIVEL_DASH = { bajo: '#94A3B8', medio: '#3ABFF0', alto: '#1E4FA0', na: '#CBD5E1' } as const;
type Nivel = keyof typeof NIVEL_DASH;
const nivelDe = (av: number | null): Nivel => (av == null ? 'na' : av < 0.25 ? 'bajo' : av < 0.75 ? 'medio' : 'alto');
// Degradado por orden: la barra mayor, en el azul más intenso.
const DEGRADADO = ['#25306B', '#1E4FA0', '#006BB9', '#3ABFF0', '#8FB2F5', '#94A3B8', '#CBD5E1'];

// Número de cada campo en el formulario de 37 campos. Solo se usa si el
// servidor no mandó la numeración del formulario del mes.
const NUMERO_POR_DEFECTO: Record<string, number> = {
  Q01: 1, Q02: 2, Q03: 3, Q04: 4, Q05: 5, Q06: 6, Q07: 7, YA_NO_ESTAN: 8, Q21: 17, Q22: 18, Q23: 19,
  CIC_9: 20, CIC_10: 21, CIC_13: 22, CIC_14: 23, CIC_15: 24, CIC_16: 25, CIC_21: 26,
  Q37: 27, Q38: 28, Q42: 29, Q43: 30, Q44: 31, Q45: 32, CENSURA: 33, Q48: 34, Q49: 35, Q50: 36, Q51: 37,
};

interface Cifra { id: string; label: string; valor: number | null; nota: string }
interface FilaBarra { id: string; label: string; valor: number | null; pct: number; color: string; nota: string }
// Bloques 4, 5 y 6: un dato principal y su desglose en barras.
interface Desglose { clave: string; eyebrow: string; titulo: string; principal: Cifra; filas: FilaBarra[]; capsulas: string[]; orden: string }
interface FilaRanking { slep: string; valor: number; ancho: number; pos: number; propio: boolean }
interface RankingLic { id: string; titulo: string; unidad: 'd' | '$'; filas: FilaRanking[]; propia: FilaRanking | null; capsula: string }

// Dashboard por bloques, cada dato con su número de campo del Formulario:
// 0 · Consolidado (campos 1 a 3 y el % de avance) → 1 · Origen (4 a 6) →
// 2 · Involucrados (7 y 8) → 3 · Licencias (rankings de 17 y 18) → 4 · Origen
// de los casos (19 y sus CIC) → 5 · Procedimientos (27 y 28 a 31) → 6 ·
// Resultado (32 y 33 a 37) → Ranking. Las "cápsulas" son comentarios que
// guían al usuario: explican una diferencia, advierten un dato raro o
// resumen lo importante del bloque.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ModeSwitcherComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  datos: DashboardDeMes | null = null;
  slepActivo: string | null = null;
  mes = '';
  anio = '';
  readonly fmt = fmt;
  readonly pct = pct;
  readonly NIVEL_DASH = NIVEL_DASH;

  // 0 · Consolidado
  identificacion: { n: number; label: string; valor: string }[] = [];
  av: number | null = null;
  instruidos = 0;
  cerrados = 0;
  frase = '';
  capsulasAvance: string[] = [];
  // 1 · Origen
  origen: Cifra[] = [];
  capsulasOrigen: string[] = [];
  // 2 · Involucrados (dona)
  dona: { partes: { id: string; label: string; valor: number; color: string; pct: number; d: string }[]; total: number } = { partes: [], total: 0 };
  capsulasInvolucrados: string[] = [];
  // 3 · Licencias
  rankingsLic: RankingLic[] = [];
  // 4, 5 y 6
  desgloses: Desglose[] = [];
  // 7 · Anexo (solo con el formulario de 44 campos)
  anexo: { id: string; label: string; valor: number | null }[] = [];
  ranking: { pos: number | null; slep: string; casos: number; instruidos: number; cerrados: number; av: number | null; nivel: Nivel }[] = [];

  @ViewChild('tip', { static: true }) private tip!: ElementRef<HTMLDivElement>;
  private sub?: Subscription;
  private porSlep = new Map<string, { slep: string; valor: number }[]>();
  private tipActual = '';
  private numeros: Record<string, number> = {};

  constructor(
    private readonly caseState: CaseStateService,
    private readonly dashboardApi: DashboardApiService,
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.contenedorActivo$])
      .pipe(
        switchMap(([mes, contenedor]) => {
          this.slepActivo = contenedor?.slep ?? null;
          this.mes = mes?.mes ?? '';
          this.anio = mes?.anio ?? '';
          this.porSlep.clear();
          if (!mes) return of(null);
          // Los rankings de licencias (campos 17 y 18) comparan a todos los
          // SLEP: se piden junto con el Dashboard.
          const desglose = (campo: string) => this.dashboardApi.getDesglose(mes.mes, mes.anio, campo).pipe(catchError(() => of([])));
          return forkJoin({
            dash: this.dashboardApi.getDashboard(mes.mes, mes.anio, this.slepActivo ?? undefined),
            q21: desglose('Q21'),
            q22: desglose('Q22'),
          });
        }),
      )
      .subscribe((r) => {
        this.datos = r?.dash ?? null;
        if (!r) return;
        this.porSlep.set('Q21', r.q21);
        this.porSlep.set('Q22', r.q22);
        this.armar(r.dash);
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // "27. Sumarios instruidos": el número tal como aparece en el Formulario.
  n(id: string): number | string {
    return this.numeros[id] ?? NUMERO_POR_DEFECTO[id] ?? '';
  }
  et(id: string, label: string): string {
    const n = this.n(id);
    return n === '' ? label : `${n}. ${label}`;
  }

  private armar(d: DashboardDeMes): void {
    this.numeros = d.numeros ?? {};
    const c = d.campos ?? {};
    const v = (id: string) => c[id] ?? null;
    const n = (id: string) => c[id] ?? 0;
    const dec = (x: number) => x.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const N = (id: string) => this.n(id);

    // 0 · Consolidado: campos 1 a 3 y el % de avance (32 ÷ 27).
    const t = d.textos;
    this.identificacion = [
      { n: +N('Q01') || 1, label: 'Ministerio', valor: t?.Q01 || 'Ministerio de Educación' },
      { n: +N('Q02') || 2, label: 'Subsecretaría', valor: t?.Q02 || 'Subsecretaría de Educación' },
      { n: +N('Q03') || 3, label: 'Servicio', valor: this.slepActivo ? t?.Q03 || this.slepActivo : `Todos los SLEP (${d.totalContenedores})` },
    ];
    this.instruidos = n('Q37');
    this.cerrados = n('Q45');
    this.av = this.instruidos > 0 ? this.cerrados / this.instruidos : null;
    const ambito = this.slepActivo ?? `los ${d.totalContenedores} SLEP`;
    this.frase = this.av == null
      ? `En ${this.mes.toLowerCase()} de ${this.anio}, ${ambito} no registra sumarios instruidos (campo ${N('Q37')}).`
      : `${fmt(this.cerrados)} procesos cerrados (campo ${N('Q45')}) de ${fmt(this.instruidos)} sumarios instruidos (campo ${N('Q37')}).`;
    this.capsulasAvance = [];
    if (this.av != null) {
      const faltan = Math.max(this.instruidos - this.cerrados, 0);
      this.capsulasAvance.push(faltan
        ? `Para llegar a la meta del 100 % faltan ${fmt(faltan)} procesos por cerrar.`
        : 'Todos los sumarios instruidos tienen su proceso cerrado: meta cumplida.');
    }

    // 1 · Origen (campos 4, 5 y 6)
    const casos = v('Q04'), lic = v('Q05'), inv = v('Q06');
    this.origen = [
      { id: 'Q04', label: 'Casos informados por la CGR', valor: casos, nota: 'Lo que reportó Contraloría' },
      { id: 'Q05', label: 'Licencias médicas incumplidas', valor: lic, nota: casos ? `${dec(lic! / casos)} licencias por caso` : '' },
      { id: 'Q06', label: 'Funcionarios involucrados', valor: inv, nota: casos ? `${dec(inv! / casos)} funcionarios por caso` : '' },
    ];
    this.capsulasOrigen = [];
    if (casos && inv != null && inv < casos) this.capsulasOrigen.push(`Hay menos funcionarios involucrados (campo ${N('Q06')}) que casos informados (campo ${N('Q04')}): revisa si algún SLEP los cargó al revés.`);
    else if (casos) this.capsulasOrigen.push(`Cada caso informado involucra, en promedio, a ${dec(inv! / casos)} funcionarios y ${dec(lic! / casos)} licencias.`);

    // 2 · Involucrados (campos 7 y 8, dona)
    const cont = n('Q07'), yaNo = n('YA_NO_ESTAN'), totInv = cont + yaNo;
    let ang = -Math.PI / 2;
    this.dona = {
      total: totInv,
      partes: [
        { id: 'Q07', label: this.et('Q07', 'Continúan en el servicio'), valor: cont, color: PALETA[0] },
        { id: 'YA_NO_ESTAN', label: this.et('YA_NO_ESTAN', 'Ya no están en el servicio'), valor: yaNo, color: PALETA[4] },
      ].map((p) => {
        const frac = totInv ? p.valor / totInv : 0, a0 = ang, a1 = ang + frac * Math.PI * 2;
        ang = a1;
        return { ...p, pct: frac, d: frac > 0 ? this.arco(a0, a1 - (frac < 1 ? 0.012 : 0)) : '' };
      }),
    };
    this.capsulasInvolucrados = [];
    if (inv != null && totInv !== inv) this.capsulasInvolucrados.push(`Los campos ${N('Q07')} y ${N('YA_NO_ESTAN')} suman ${fmt(totInv)}, pero el campo ${N('Q06')} dice ${fmt(inv)} (diferencia ${fmt(totInv - inv)}). Deberían coincidir.`);
    else if (totInv) this.capsulasInvolucrados.push(`${pct(cont / totInv)} de los involucrados sigue en el servicio; con ellos todavía se puede aplicar una medida disciplinaria.`);

    // 3 · Licencias: rankings de los campos 17 y 18
    this.rankingsLic = [
      this.rankingLic('Q21', 'Licencias más largas', 'd', v('Q21')),
      this.rankingLic('Q22', 'Remuneraciones promedio más altas', '$', v('Q22')),
    ];

    // 4 · Origen de los casos: 19 y sus CIC (20 a 26), de mayor a menor
    const CIC: [string, string][] = [['CIC_9', 'CIC N° 9 · salidas del país'], ['CIC_10', 'CIC N° 10 · partos'], ['CIC_13', 'CIC N° 13 · médicos en investigación penal'], ['CIC_14', 'CIC N° 14 · FFAA salidas del país'], ['CIC_15', 'CIC N° 15 · casinos de juego'], ['CIC_16', 'CIC N° 16 · salidas del país (regional)'], ['CIC_21', 'CIC N° 21 · trabajo con otros empleadores']];
    const aInv = n('Q23');
    const sumaCic = CIC.reduce((a, [id]) => a + n(id), 0);
    const capsCic: string[] = [];
    const m = d.metricas;
    if (m.diferenciaInvestigar > 0) capsCic.push(`El campo ${N('Q23')} tiene ${fmt(m.diferenciaInvestigar)} funcionarios menos que el campo ${N('Q06')}: algunos SLEP no cuentan a quienes ya no están en el servicio (campo ${N('YA_NO_ESTAN')}).`);
    if (m.diferenciaInvestigar < 0) capsCic.push(`El campo ${N('Q23')} supera al campo ${N('Q06')} en ${fmt(-m.diferenciaInvestigar)}: no debería haber más casos a investigar que funcionarios involucrados.`);
    if (sumaCic > aInv) capsCic.push(`Los CIC suman ${fmt(sumaCic)}, más que el campo ${N('Q23')}: una persona puede figurar en más de un CIC.`);
    const cic = this.filas(CIC, aInv, c, true);
    if (cic[0]?.valor) capsCic.push(`El origen principal es el ${cic[0].label.replace(/^\d+\. /, '')}: ${pct(cic[0].pct)} de los casos a investigar.`);

    // 5 · Procedimientos: 27 y 28 a 31
    const ins = this.instruidos;
    const PROC: [string, string][] = [['Q38', 'En curso'], ['Q42', 'Resueltos'], ['Q43', 'Impugnados'], ['Q44', 'Enviados a la CGR para toma de razón']];
    const sumaProc = PROC.reduce((a, [id]) => a + n(id), 0) + this.cerrados;
    const capsProc: string[] = [];
    if (sumaProc === ins) capsProc.push(`Los campos ${N('Q38')} a ${N('Q44')} más los procesos cerrados (campo ${N('Q45')}, en Resultado) suman el campo ${N('Q37')}.`);
    else capsProc.push(`Los campos ${N('Q38')} a ${N('Q45')} suman ${fmt(sumaProc)}, pero el campo ${N('Q37')} dice ${fmt(ins)} (diferencia ${fmt(sumaProc - ins)}). Deberían coincidir.`);
    if (aInv) capsProc.push(`Se ha instruido sumario a ${pct(ins / aInv)} de los casos a investigar (campo ${N('Q23')}).`);

    // 6 · Resultado: 32 y 33 a 37
    const SAN: [string, string][] = [['CENSURA', 'Censura o amonestación'], ['Q48', 'Multa'], ['Q49', 'Suspensión del empleo'], ['Q50', 'Destitución'], ['Q51', 'Cerrados sin sanción']];
    const sumaSan = SAN.reduce((a, [id]) => a + n(id), 0);
    const conSancion = sumaSan - n('Q51');
    const capsSan: string[] = [];
    if (m.diferenciaSanciones) capsSan.push(`Los campos ${N('CENSURA')} a ${N('Q51')} suman ${fmt(sumaSan)}, pero el campo ${N('Q45')} dice ${fmt(this.cerrados)} (diferencia ${fmt(m.diferenciaSanciones)}). Deberían coincidir.`);
    if (sumaSan) capsSan.push(`De los procesos cerrados, ${fmt(conSancion)} terminaron con sanción (${pct(conSancion / sumaSan)}) y ${fmt(n('Q51'))} sin sanción.`);

    this.desgloses = [
      { clave: 'cic', eyebrow: '4 · Origen de los casos', titulo: 'Casos a investigar, por consolidado (CIC)', orden: 'De mayor a menor.',
        principal: { id: 'Q23', label: 'Casos a investigar por sumario administrativo', valor: v('Q23'), nota: inv ? `${pct(aInv / inv)} de los funcionarios involucrados` : '' },
        filas: cic, capsulas: capsCic },
      { clave: 'proc', eyebrow: '5 · Procedimientos', titulo: 'Estado de los sumarios instruidos', orden: 'Cada barra, como parte de los sumarios instruidos.',
        principal: { id: 'Q37', label: 'Sumarios instruidos', valor: v('Q37'), nota: aInv ? `${pct(ins / aInv)} de los casos a investigar` : '' },
        filas: this.filas(PROC, ins, c, false), capsulas: capsProc },
      { clave: 'san', eyebrow: '6 · Resultado', titulo: 'Cómo terminaron los procesos cerrados', orden: 'Cada barra, como parte de los procesos cerrados.',
        principal: { id: 'Q45', label: 'Procesos cerrados', valor: v('Q45'), nota: ins ? `${pct(this.cerrados / ins)} de los sumarios instruidos` : '' },
        filas: this.filas(SAN, this.cerrados, c, false), capsulas: capsSan },
    ];

    // 7 · Anexo (solo si se cargó con el formulario de 44 campos)
    const ANEXO: [string, string][] = [['Q56', 'Renuncias antes del procedimiento'], ['Q57', 'Procedimientos instruidos'], ['Q58', 'Procedimientos en investigación'], ['Q59', 'Procedimientos con vista fiscal'], ['Q60', 'Resoluciones ejecutoriadas'], ['Q61', 'Funcionarios con descuento'], ['Q62', 'Monto total de descuentos ($)']];
    this.anexo = ANEXO.some(([id]) => v(id) != null) ? ANEXO.map(([id, label]) => ({ id, label: this.et(id, label), valor: v(id) })) : [];

    // Ranking completo
    const filas = (d.ranking ?? []).map((r) => ({ slep: r.slep, casos: r.casosInformados, instruidos: r.sumariosInstruidos, cerrados: r.procesosCerrados, av: r.pct == null ? null : r.pct / 100 }));
    const con = filas.filter((f) => f.av != null).sort((a, b) => b.av! - a.av! || b.cerrados - a.cerrados || a.slep.localeCompare(b.slep, 'es'));
    const sin = filas.filter((f) => f.av == null).sort((a, b) => a.slep.localeCompare(b.slep, 'es'));
    this.ranking = [...con.map((f, i) => ({ ...f, pos: i + 1 as number | null, nivel: nivelDe(f.av) })), ...sin.map((f) => ({ ...f, pos: null, nivel: 'na' as Nivel }))];
    if (!this.slepActivo && sin.length) this.capsulasAvance.push(`${sin.length} SLEP no registran sumarios instruidos: no entran en el % de avance.`);
  }

  // Barras de un desglose: el ancho es la parte que representa cada campo
  // del dato principal; el color, por orden (la mayor, la más intensa).
  private filas(campos: [string, string][], base: number, valores: Record<string, number | null>, ordenar: boolean): FilaBarra[] {
    const filas = campos.map(([id, label]) => ({ id, label: this.et(id, label), valor: valores[id] ?? null, pct: base ? (valores[id] ?? 0) / base : 0, color: '', nota: '' }));
    const porValor = [...filas].sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
    porValor.forEach((f, i) => (f.color = DEGRADADO[Math.min(i, DEGRADADO.length - 1)]));
    return ordenar ? porValor : filas;
  }

  // Ranking de 6 SLEP para un campo de licencias. Viendo un SLEP, se destaca
  // y, si no está entre los 6, se agrega debajo con su posición.
  private rankingLic(id: string, titulo: string, unidad: 'd' | '$', consolidado: number | null): RankingLic {
    const lista = [...(this.porSlep.get(id) ?? [])].filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
    const max = lista[0]?.valor || 1;
    const todas = lista.map((x, i) => ({ slep: x.slep, valor: x.valor, ancho: x.valor / max, pos: i + 1, propio: x.slep === this.slepActivo }));
    const filas = todas.slice(0, 6);
    const propia = this.slepActivo ? todas.find((f) => f.propio && f.pos > 6) ?? null : null;
    const val = (x: number | null) => (unidad === '$' ? this.rem(x) : `${fmt(x)} días`);
    let capsula = '';
    if (this.slepActivo) {
      const p = todas.find((f) => f.propio);
      capsula = p && todas.length > 1 ? `${this.slepActivo} ocupa el ${p.pos}° lugar de ${todas.length} SLEP (${val(p.valor)}).` : consolidado != null ? `Valor del SLEP: ${val(consolidado)}.` : '';
    } else if (id === 'Q21') {
      capsula = `Campo ${this.n(id)}: la licencia más larga de cada SLEP. En el consolidado manda la mayor de todas (${val(consolidado)}).`;
    } else {
      capsula = `Campo ${this.n(id)}: en el consolidado es el promedio ponderado por funcionarios involucrados (${val(consolidado)}).`;
    }
    return { id, titulo: this.et(id, titulo), unidad, filas, propia, capsula };
  }

  // Color del % de avance (la única parte con rojo): 0 % rojo intenso →
  // 50 % neutro → 100 % azul intenso, igual que el Histórico y el informe.
  colorAvance(a: number | null): string {
    if (a == null) return '#CBD5E1';
    const t = Math.min(Math.abs(a - 0.5) / 0.5, 1) * 85 + 15, col = a < 0.5 ? '#d03b3b' : '#0f69b4';
    return `color-mix(in oklab, ${col} ${t.toFixed(0)}%, #f0efec)`;
  }
  colorTextoAvance(a: number | null): string {
    return a == null ? '#76839a' : a < 0.5 ? '#c23434' : '#0f69b4';
  }

  // Arco de la dona (anillo) entre dos ángulos, en un lienzo de 120 × 120.
  private arco(a0: number, a1: number): string {
    const R = 54, r = 34, cx = 60, cy = 60, grande = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
    return `M${p(R, a0)} A${R},${R} 0 ${grande} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${grande} 0 ${p(r, a0)} Z`;
  }

  rem(v: number | null): string {
    return v == null ? '—' : '$' + fmt(v);
  }

  valorLic(r: RankingLic, v: number): string {
    return r.unidad === '$' ? this.rem(v) : `${fmt(v)} d`;
  }

  // ---------- Tooltip completo, con los 5 SLEP que más aportan ----------
  verTip(e: MouseEvent, id: string | null, label: string, valor: number | null, baseTxt = '', base?: number | null): void {
    const clave = `${id}|${label}`;
    this.tipActual = clave;
    const pintar = () => {
      let h = `<span class="h">${escaparHtml(label)}<small>${escaparHtml(this.slepActivo ?? `Todos los SLEP · ${this.mes} ${this.anio}`)}</small></span>`;
      h += `<span class="r"><span class="big">${fmt(valor)}</span>${base ? `<span class="muted">${pct((valor ?? 0) / base)} de ${escaparHtml(baseTxt.toLowerCase())}</span>` : ''}</span>`;
      if (id && !this.slepActivo) {
        const des = this.porSlep.get(id);
        h += `<span class="sep"></span><span class="sec">SLEP que más aportan</span>`;
        if (!des) h += `<span class="muted">Cargando…</span>`;
        else {
          const top = des.filter((x) => x.valor).sort((a, b) => b.valor - a.valor).slice(0, 5);
          const tot = des.reduce((a, x) => a + (x.valor || 0), 0);
          h += top.length ? top.map((x) => `<span class="r"><span>${escaparHtml(x.slep)}</span><span>${fmt(x.valor)}${tot ? ` <span class="muted">(${pct(x.valor / tot)})</span>` : ''}</span></span>`).join('') : `<span class="muted">Ningún SLEP informa este dato.</span>`;
        }
      }
      const tip = this.tip.nativeElement;
      tip.innerHTML = h;
      tip.hidden = false;
    };
    pintar();
    this.moverTip(e);
    if (id && !this.slepActivo && !this.porSlep.has(id)) {
      this.dashboardApi.getDesglose(this.mes, this.anio, id).subscribe((des) => {
        this.porSlep.set(id, des);
        if (this.tipActual === clave) pintar();
      });
    }
  }

  moverTip(e: MouseEvent): void {
    const tip = this.tip.nativeElement;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let lx = e.clientX + 16, ly = e.clientY + 16;
    if (lx + tw > innerWidth - 8) lx = e.clientX - tw - 16;
    if (ly + th > innerHeight - 8) ly = Math.max(8, e.clientY - th - 16);
    tip.style.left = lx + 'px';
    tip.style.top = ly + 'px';
  }

  ocultarTip(): void {
    this.tipActual = '';
    this.tip.nativeElement.hidden = true;
  }
}
