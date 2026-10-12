import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, switchMap, of } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { DashboardApiService } from '../services/dashboard-api.service';
import { DashboardDeMes } from '../../../core/models/dashboard.model';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';
import { escaparHtml, fmt, pct } from '../../../core/utils/avance';

// Paleta PROPIA de la aplicación (la de la línea superior del encabezado):
// azules y grises, sin rojos. El Histórico y el Informe Interactivo usan la
// paleta del informe (con rojos); el Dashboard se distingue con esta.
export const PALETA = ['#1E4FA0', '#006BB9', '#3ABFF0', '#8FB2F5', '#94A3B8', '#CBD5E1', '#25306B'];
// Niveles de avance en el Dashboard: bajo = gris acero, medio = celeste, alto = azul intenso.
export const NIVEL_DASH = { bajo: '#94A3B8', medio: '#3ABFF0', alto: '#1E4FA0', na: '#CBD5E1' } as const;
type Nivel = keyof typeof NIVEL_DASH;
const nivelDe = (av: number | null): Nivel => (av == null ? 'na' : av < 0.25 ? 'bajo' : av < 0.75 ? 'medio' : 'alto');
const NIVEL_TXT: Record<Nivel, string> = { bajo: 'Avance bajo', medio: 'Avance medio', alto: 'Avance alto', na: 'Sin sumarios instruidos' };

interface Parte { id: string | null; label: string; valor: number; color: string; pct: number }
interface Barra { titulo: string; base: string; total: number; partes: Parte[]; aviso?: string }
interface Item { id: string; label: string; valor: number | null; color: string; pct: number }
interface Cifra { id: string; label: string; valor: number | null; nota: string }

// Dashboard por bloques: el formulario contado como una historia, en el orden
// del proceso (lo que informó Contraloría → quiénes son los involucrados →
// las licencias → casos a investigar por origen → avance de los
// procedimientos → cómo terminaron los cerrados), con la síntesis arriba y el
// ranking completo al final. Mismo lenguaje visual del Histórico y del
// Informe Interactivo, con la paleta azul y gris de la aplicación.
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
  readonly NIVEL_TXT = NIVEL_TXT;

  av: number | null = null;
  nivel: Nivel = 'na';
  frase = '';
  sintesis: Cifra[] = [];
  contraloria: Cifra[] = [];
  barrasInvolucrados: Barra[] = [];
  licencias: { min: number | null; prom: number | null; max: number | null; remu: number | null } = { min: null, prom: null, max: null, remu: null };
  cic: Item[] = [];
  aInvestigar = 0;
  avisosInvestigar: string[] = [];
  embudo: { id: string; label: string; valor: number; ancho: number; conv: string }[] = [];
  estados: Barra | null = null;
  dona: { partes: (Parte & { d: string })[]; total: number; aviso?: string } = { partes: [], total: 0 };
  anexo: { id: string; label: string; valor: number | null }[] = [];
  ranking: { pos: number | null; slep: string; casos: number; instruidos: number; cerrados: number; av: number | null; nivel: Nivel }[] = [];

  @ViewChild('tip', { static: true }) private tip!: ElementRef<HTMLDivElement>;
  private sub?: Subscription;
  private desgloses = new Map<string, { slep: string; valor: number }[]>();
  private tipActual = '';

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
          this.desgloses.clear();
          return mes ? this.dashboardApi.getDashboard(mes.mes, mes.anio, this.slepActivo ?? undefined) : of(null);
        }),
      )
      .subscribe((datos) => {
        this.datos = datos;
        if (datos) this.armar(datos);
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private armar(d: DashboardDeMes): void {
    const c = d.campos ?? {};
    const v = (id: string) => c[id] ?? null;
    const n = (id: string) => c[id] ?? 0;
    const razon = (a: number | null, b: number | null) => (a != null && b ? a / b : null);
    const dec = (x: number | null) => (x == null ? '' : x.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
    const ins = n('Q37'), cerr = n('Q45');
    this.av = ins > 0 ? cerr / ins : null;
    this.nivel = nivelDe(this.av);
    const ambito = this.slepActivo ?? `los ${d.totalContenedores} SLEP`, verbo = this.slepActivo ? 'tiene' : 'tienen';
    this.frase = this.av == null
      ? `En ${this.mes.toLowerCase()} de ${this.anio}, ${ambito} no registra sumarios instruidos.`
      : `En ${this.mes.toLowerCase()} de ${this.anio}, ${ambito} ${verbo} ${fmt(cerr)} de ${fmt(ins)} sumarios instruidos con proceso cerrado: un avance de ${pct(this.av)}. Quedan ${fmt(Math.max(ins - cerr, 0))} procesos por cerrar.`;

    this.sintesis = [
      { id: 'Q04', label: 'Casos informados CGR', valor: v('Q04'), nota: 'Origen del proceso' },
      { id: 'Q06', label: 'Funcionarios involucrados', valor: v('Q06'), nota: razon(v('Q06'), v('Q04')) != null ? `${dec(razon(v('Q06'), v('Q04')))} por caso` : '' },
      { id: 'Q37', label: 'Sumarios instruidos', valor: v('Q37'), nota: razon(v('Q37'), v('Q06')) != null ? `${pct(razon(v('Q37'), v('Q06')))} de los involucrados` : '' },
      { id: 'Q45', label: 'Procesos cerrados', valor: v('Q45'), nota: this.av != null ? `${pct(this.av)} de los instruidos` : '' },
    ];

    // 1. Lo que informó Contraloría
    this.contraloria = [
      { id: 'Q04', label: 'Casos informados', valor: v('Q04'), nota: 'Reportados por la CGR' },
      { id: 'Q05', label: 'Licencias incumplidas', valor: v('Q05'), nota: razon(v('Q05'), v('Q04')) != null ? `${dec(razon(v('Q05'), v('Q04')))} licencias por caso` : '' },
      { id: 'Q06', label: 'Funcionarios involucrados', valor: v('Q06'), nota: razon(v('Q06'), v('Q04')) != null ? `${dec(razon(v('Q06'), v('Q04')))} por caso` : '' },
    ];

    // 2. Quiénes son los involucrados (barras 100 % apiladas)
    const barra = (titulo: string, base: string, partes: { id: string | null; label: string; valor: number }[], esperado?: number): Barra => {
      const total = partes.reduce((a, p) => a + p.valor, 0);
      const b: Barra = { titulo, base, total, partes: partes.map((p, i) => ({ ...p, color: [PALETA[0], PALETA[4], PALETA[2], PALETA[5]][i] ?? PALETA[5], pct: total ? p.valor / total : 0 })) };
      if (esperado != null && total !== esperado) b.aviso = `Las partes suman ${fmt(total)}; los involucrados son ${fmt(esperado)} (diferencia ${fmt(total - esperado)}).`;
      return b;
    };
    const inv = n('Q06'), yaNo = n('YA_NO_ESTAN');
    this.barrasInvolucrados = [
      barra('Situación actual', 'Funcionarios involucrados', [{ id: 'Q07', label: 'Continúan en el servicio', valor: n('Q07') }, { id: 'YA_NO_ESTAN', label: 'Ya no están', valor: yaNo }], inv),
      barra('De los que ya no están', 'Funcionarios que ya no están', [{ id: 'CESARON', label: 'Cesaron después del 20-05-2025', valor: n('CESARON') }, { id: null, label: 'Cesaron antes', valor: Math.max(yaNo - n('CESARON'), 0) }]),
      barra('Sumariados antes del 20-05-2025', 'Funcionarios involucrados', [{ id: 'YA_SUMARIADOS', label: 'Ya sumariados', valor: n('YA_SUMARIADOS') }, { id: null, label: 'No sumariados antes', valor: Math.max(inv - n('YA_SUMARIADOS'), 0) }]),
      barra('Ingreso al servicio (corte 11-03-2022)', 'Funcionarios involucrados', [{ id: 'Q15', label: 'Desde el 11-03-2022', valor: n('Q15') }, { id: 'Q16', label: 'Antes del 11-03-2022', valor: n('Q16') }], inv),
    ];
    if (v('Q17') != null || v('Q18') != null) {
      this.barrasInvolucrados.push(barra('Ingreso al servicio (corte 11-03-2026)', 'Funcionarios involucrados', [{ id: 'Q17', label: 'Desde el 11-03-2026', valor: n('Q17') }, { id: 'Q18', label: 'Antes del 11-03-2026', valor: n('Q18') }], inv));
    }

    // 3. Las licencias (rango mínima–máxima con el promedio)
    this.licencias = { min: v('Q20'), prom: v('Q19'), max: v('Q21'), remu: v('Q22') };

    // 4. Casos a investigar, por origen (CIC)
    const CIC: [string, string][] = [['CIC_9', 'CIC N° 9 · salidas del país'], ['CIC_10', 'CIC N° 10 · partos'], ['CIC_13', 'CIC N° 13 · médicos en investigación penal'], ['CIC_14', 'CIC N° 14 · FFAA salidas del país'], ['CIC_15', 'CIC N° 15 · casinos de juego'], ['CIC_16', 'CIC N° 16 · salidas del país (regional)'], ['CIC_21', 'CIC N° 21 · trabajo con otros empleadores']];
    this.aInvestigar = n('Q23');
    const maxCic = Math.max(...CIC.map(([id]) => n(id)), 1);
    // Degradado por orden: el origen con más casos, en el azul más intenso.
    const DEGRADADO = ['#25306B', '#1E4FA0', '#006BB9', '#3ABFF0', '#8FB2F5', '#94A3B8', '#CBD5E1'];
    this.cic = CIC.map(([id, label]) => ({ id, label, valor: v(id), color: '', pct: n(id) / maxCic }))
      .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1))
      .map((x, i) => ({ ...x, color: DEGRADADO[i] }));
    const m = d.metricas;
    this.avisosInvestigar = [];
    if (m.diferenciaInvestigar) this.avisosInvestigar.push(`Involucrados − a investigar = ${fmt(m.diferenciaInvestigar)}: algunos SLEP excluyen a quienes ya no están.`);
    if (m.diferenciaCIC) this.avisosInvestigar.push(`Suma de los CIC − sumarios instruidos = ${fmt(m.diferenciaCIC)}.`);

    // 5. El avance de los procedimientos (embudo + estados + medidor)
    const pasos = [{ id: 'Q23', label: 'A investigar', valor: this.aInvestigar }, { id: 'Q37', label: 'Sumarios instruidos', valor: ins }, { id: 'Q45', label: 'Procesos cerrados', valor: cerr }];
    const maxE = Math.max(...pasos.map((p) => p.valor), 1);
    this.embudo = pasos.map((p, i) => ({ ...p, ancho: Math.max(p.valor / maxE, 0.04), conv: i === 0 ? '' : pasos[i - 1].valor ? `${pct(p.valor / pasos[i - 1].valor)} del paso anterior` : '' }));
    const est = [{ id: 'Q38', label: 'En curso', valor: n('Q38') }, { id: 'Q42', label: 'Resueltos', valor: n('Q42') }, { id: 'Q43', label: 'Impugnados', valor: n('Q43') }, { id: 'Q44', label: 'Enviados a CGR', valor: n('Q44') }, { id: 'Q45', label: 'Cerrados', valor: cerr }];
    const sumaEst = est.reduce((a, p) => a + p.valor, 0);
    const resto = Math.max(ins - sumaEst, 0);
    const partesEst = [...est, ...(resto ? [{ id: null, label: 'Sin clasificar', valor: resto }] : [])];
    const totalEst = partesEst.reduce((a, p) => a + p.valor, 0);
    this.estados = {
      titulo: 'Estado de los sumarios instruidos', base: 'Sumarios instruidos', total: totalEst,
      partes: partesEst.map((p, i) => ({ ...p, color: [PALETA[2], PALETA[3], PALETA[4], PALETA[6], PALETA[0], PALETA[5]][i], pct: totalEst ? p.valor / totalEst : 0 })),
      aviso: sumaEst > ins ? `Los estados suman ${fmt(sumaEst)}, más que los ${fmt(ins)} sumarios instruidos (una persona puede figurar en más de un estado).` : undefined,
    };

    // 6. Cómo terminaron los cerrados (dona)
    const SAN = [{ id: 'CENSURA', label: 'Censura / amonestación' }, { id: 'Q48', label: 'Multa' }, { id: 'Q49', label: 'Suspensión' }, { id: 'Q50', label: 'Destitución' }, { id: 'Q51', label: 'Sin sanción' }];
    const vals = SAN.map((s) => ({ ...s, valor: n(s.id) }));
    const totSan = vals.reduce((a, p) => a + p.valor, 0);
    let ang = -Math.PI / 2;
    const colSan = [PALETA[6], PALETA[0], PALETA[1], PALETA[2], PALETA[5]];
    this.dona = {
      total: totSan,
      partes: vals.map((p, i) => {
        const frac = totSan ? p.valor / totSan : 0, a0 = ang, a1 = ang + frac * Math.PI * 2;
        ang = a1;
        return { ...p, color: colSan[i], pct: frac, d: frac > 0 ? this.arco(a0, a1 - (frac < 1 ? 0.012 : 0)) : '' };
      }),
      aviso: d.metricas.diferenciaSanciones ? `Sanciones + sin sanción suman ${fmt(totSan)}; los procesos cerrados son ${fmt(cerr)} (diferencia ${fmt(totSan - cerr)}).` : undefined,
    };

    // 7. Anexo (solo si se cargó con el formulario de 44 campos)
    const ANEXO: [string, string][] = [['Q56', 'Renuncias antes del procedimiento'], ['Q57', 'Procedimientos instruidos'], ['Q58', 'Procedimientos en investigación'], ['Q59', 'Procedimientos con vista fiscal'], ['Q60', 'Resoluciones ejecutoriadas'], ['Q61', 'Funcionarios con descuento'], ['Q62', 'Monto total de descuentos ($)']];
    this.anexo = ANEXO.some(([id]) => v(id) != null) ? ANEXO.map(([id, label]) => ({ id, label, valor: v(id) })) : [];

    // Ranking completo
    const filas = (d.ranking ?? []).map((r) => ({ slep: r.slep, casos: r.casosInformados, instruidos: r.sumariosInstruidos, cerrados: r.procesosCerrados, av: r.pct == null ? null : r.pct / 100 }));
    const con = filas.filter((f) => f.av != null).sort((a, b) => b.av! - a.av! || b.cerrados - a.cerrados || a.slep.localeCompare(b.slep, 'es'));
    const sin = filas.filter((f) => f.av == null).sort((a, b) => a.slep.localeCompare(b.slep, 'es'));
    this.ranking = [...con.map((f, i) => ({ ...f, pos: i + 1 as number | null, nivel: nivelDe(f.av) })), ...sin.map((f) => ({ ...f, pos: null, nivel: 'na' as Nivel }))];
  }

  // Arco de la dona (anillo) entre dos ángulos, en un lienzo de 120 × 120.
  private arco(a0: number, a1: number): string {
    const R = 54, r = 34, cx = 60, cy = 60, grande = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
    return `M${p(R, a0)} A${R},${R} 0 ${grande} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${grande} 0 ${p(r, a0)} Z`;
  }

  // Medidor semicircular del % de avance (arco relleno hasta el avance).
  medidor(av: number | null): string {
    const f = Math.min(Math.max(av ?? 0, 0), 1), R = 80, cx = 100, cy = 92;
    const p = (a: number) => `${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`;
    return f <= 0 ? '' : `M${p(Math.PI)} A${R},${R} 0 0 1 ${p(Math.PI + f * Math.PI)}`;
  }

  rem(v: number | null): string {
    return v == null ? '—' : '$' + fmt(v);
  }

  // Las etiquetas del rango no se salen del bloque: cerca de un borde, se
  // alinean hacia adentro.
  alineaLic(pos: number): string {
    return pos < 18 ? 'translateX(0)' : pos > 82 ? 'translateX(-100%)' : 'translateX(-50%)';
  }

  // Posición (0–100 %) de un valor en la barra de rango de las licencias.
  posLic(v: number | null): number {
    const { min, max } = this.licencias;
    if (v == null || min == null || max == null || max === min) return 50;
    return ((v - min) / (max - min)) * 100;
  }

  // ---------- Tooltip completo, con los 5 SLEP que más aportan ----------
  verTip(e: MouseEvent, id: string | null, label: string, valor: number | null, baseTxt = '', base?: number | null): void {
    const clave = `${id}|${label}`;
    this.tipActual = clave;
    const pintar = () => {
      let h = `<span class="h">${escaparHtml(label)}<small>${escaparHtml(this.slepActivo ?? `Todos los SLEP · ${this.mes} ${this.anio}`)}</small></span>`;
      h += `<span class="r"><span class="big">${fmt(valor)}</span>${base ? `<span class="muted">${pct((valor ?? 0) / base)} de ${escaparHtml(baseTxt.toLowerCase())}</span>` : ''}</span>`;
      if (id && !this.slepActivo) {
        const des = this.desgloses.get(id);
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
    if (id && !this.slepActivo && !this.desgloses.has(id)) {
      this.dashboardApi.getDesglose(this.mes, this.anio, id).subscribe((des) => {
        this.desgloses.set(id, des);
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
