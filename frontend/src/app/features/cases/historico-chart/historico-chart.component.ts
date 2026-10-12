import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { COLOR_NIVEL, ESTILOS_TOOLTIP, MetricasAvance, nivel, pct } from '../../../core/utils/avance';

// Serie protagonista (la General o el SLEP destacado): con todos sus
// indicadores, para los puntos de color y el tooltip completo.
export interface SeriePrincipal {
  etiqueta: string;
  metricas: (MetricasAvance | null)[];
}
// Líneas de comparación: solo el % de avance de cada mes.
export interface SerieComparacion {
  etiqueta: string;
  av: (number | null)[];
}

const NS = 'http://www.w3.org/2000/svg';

// Gráfico del Histórico con el modelo del informe de avance: % de avance mes
// a mes (de izquierda, el más antiguo, a derecha, el más reciente), meta del
// 100 % segmentada, zona "pendiente por cerrar" sombreada, puntos de color
// por nivel (bajo / medio / alto) y tooltip completo. Además (propio del
// Histórico): la línea General cuando hay un SLEP destacado y los demás SLEP
// marcados en gris. Dibujado en SVG propio (sin Chart.js).
@Component({
  selector: 'app-historico-chart',
  standalone: true,
  template: `<div #caja class="relative w-full"><svg #svg class="block w-full overflow-visible" role="img"></svg><div #tip class="tip absolute" hidden></div></div>`,
  styles: [ESTILOS_TOOLTIP],
})
export class HistoricoChartComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() etiquetas: string[] = [];
  @Input() principal: SeriePrincipal | null = null;
  @Input() general: SerieComparacion | null = null;
  @Input() otros: SerieComparacion[] = [];
  @Input() mesActivo: number | null = null;
  @Input() escala: '100' | 'aj' = '100';
  @Input() alto = 300;
  // HTML del tooltip de un mes (lo arma el panel, que conoce el ranking).
  @Input() tooltip: (i: number) => string = () => '';

  @ViewChild('caja', { static: true }) private caja!: ElementRef<HTMLDivElement>;
  @ViewChild('svg', { static: true }) private svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('tip', { static: true }) private tipRef!: ElementRef<HTMLDivElement>;
  private obs?: ResizeObserver;

  ngAfterViewInit(): void {
    this.obs = new ResizeObserver(() => this.dibujar());
    this.obs.observe(this.caja.nativeElement);
    this.dibujar();
  }
  ngOnChanges(): void {
    if (this.svgRef) this.dibujar();
  }
  ngOnDestroy(): void {
    this.obs?.disconnect();
  }

  private el(tag: string, attrs: Record<string, string | number>, parent: Element, txt?: string): SVGElement {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    if (txt != null) e.textContent = txt;
    parent.appendChild(e);
    return e;
  }

  private dibujar(): void {
    const svg = this.svgRef.nativeElement;
    const W = Math.max(280, this.caja.nativeElement.clientWidth);
    const H = this.alto, n = this.etiquetas.length, pl = W < 520 ? 44 : 54, pr = W < 520 ? 14 : 70, pt = 18, pb = 28;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('height', String(H));
    svg.innerHTML = '';
    const fg2 = 'var(--h-fg2, #46536a)', fg3 = 'var(--h-fg3, #76839a)', grid = 'var(--h-grid, #e6e9ef)', surf = 'var(--h-surface, #fff)';
    const A = (this.principal?.metricas ?? []).map((m) => (m ? m.av : null));
    const todos = [...A, ...(this.general?.av ?? []), ...this.otros.flatMap((o) => o.av)].filter((v): v is number => v != null);
    if (!n || !todos.length) {
      this.el('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', fill: fg3, 'font-size': 13 }, svg, 'Sin avance que medir hasta este mes');
      return;
    }
    // Escala: 0–100 % (distancia real a la meta) o ajustada (ver mejor los cambios).
    let hi = 1;
    if (this.escala === 'aj') {
      const mx = Math.max(...todos, 0.01);
      hi = Math.min(1, this.techo(mx * 1.3));
      if (hi < mx) hi = mx * 1.15;
    }
    const ticks = this.marcas(hi);
    const bw = (W - pl - pr) / n, x = (i: number) => pl + bw * (i + 0.5), y = (v: number) => pt + (H - pt - pb) * (1 - v / hi);
    svg.setAttribute('aria-label', `% de avance de ${this.principal?.etiqueta ?? ''}: ` + A.map((v, i) => (v == null ? null : `${this.etiquetas[i]} ${pct(v)}`)).filter(Boolean).join(', ') + '. Meta 100 %.');
    ticks.forEach((t) => {
      this.el('line', { x1: pl, x2: W - pr, y1: y(t), y2: y(t), stroke: grid, 'stroke-width': 1 }, svg);
      this.el('text', { x: pl - 8, y: y(t) + 4, 'text-anchor': 'end', fill: fg3, 'font-size': 11 }, svg, Math.round(t * 100) + ' %');
    });
    // Rótulos del eje: si no caben todos, uno por medio (el activo siempre).
    const salto = bw < 34 ? 2 : 1;
    this.etiquetas.forEach((et, i) => {
      if (i % salto && i !== this.mesActivo) return;
      this.el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', fill: A[i] == null ? fg3 : fg2, 'font-size': 10.5, 'font-weight': i === this.mesActivo ? 700 : 400 }, svg, et);
    });
    if (this.mesActivo != null) this.el('rect', { x: pl + bw * this.mesActivo, y: pt, width: bw, height: H - pt - pb, fill: 'var(--h-banda, #e2eef9)', opacity: 0.7 }, svg);
    const tramos = (v: (number | null)[]) => {
      const idx = v.map((a, i) => (a == null ? null : i)).filter((i): i is number => i != null);
      const segs: number[][] = [];
      let cur: number[] = [];
      idx.forEach((i, j) => { if (j && i !== idx[j - 1] + 1) { segs.push(cur); cur = []; } cur.push(i); });
      if (cur.length) segs.push(cur);
      return segs;
    };
    // Zona "pendiente por cerrar": entre la línea protagonista y la meta.
    const top = y(Math.min(1, hi));
    tramos(A).forEach((sg) => this.el('path', { d: `M${x(sg[0])},${top} L${sg.map((i) => `${x(i)},${y(A[i]!)}`).join(' L')} L${x(sg[sg.length - 1])},${top} Z`, fill: '#d03b3b', opacity: 0.07 }, svg));
    // Otros SLEP marcados (gris) y la General (celeste) por debajo de la protagonista.
    for (const o of this.otros) tramos(o.av).forEach((sg) => this.el('path', { d: 'M' + sg.map((i) => `${x(i)},${y(o.av[i]!)}`).join(' L'), fill: 'none', stroke: 'var(--h-gris, #b8c0cc)', 'stroke-width': 1.5 }, svg));
    if (this.general) {
      const g = this.general.av;
      tramos(g).forEach((sg) => this.el('path', { d: 'M' + sg.map((i) => `${x(i)},${y(g[i]!)}`).join(' L'), fill: 'none', stroke: '#7fb2e0', 'stroke-width': 2, 'stroke-dasharray': '5 3' }, svg));
    }
    // Meta 100 %.
    if (hi >= 1) {
      this.el('line', { x1: pl, x2: W - pr, y1: y(1), y2: y(1), stroke: fg2, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }, svg);
      if (pr > 40) { this.el('text', { x: W - pr + 6, y: y(1) - 4, fill: fg2, 'font-size': 11, 'font-weight': 600 }, svg, 'Meta'); this.el('text', { x: W - pr + 6, y: y(1) + 10, fill: fg2, 'font-size': 11 }, svg, '100 %'); }
    } else if (pr > 40) {
      this.el('text', { x: W - pr + 6, y: pt + 8, fill: fg2, 'font-size': 11, 'font-weight': 600 }, svg, 'Meta 100 %');
      this.el('text', { x: W - pr + 6, y: pt + 22, fill: fg3, 'font-size': 10 }, svg, '↑ fuera de escala');
    }
    // Línea protagonista y sus puntos de color por nivel.
    tramos(A).forEach((sg) => this.el('path', { d: 'M' + sg.map((i) => `${x(i)},${y(A[i]!)}`).join(' L'), fill: 'none', stroke: '#0f69b4', 'stroke-width': 2.2, 'stroke-linejoin': 'round' }, svg));
    A.forEach((v, i) => { if (v != null) this.el('circle', { cx: x(i), cy: y(v), r: i === this.mesActivo ? 6 : 4.5, fill: COLOR_NIVEL[nivel(v)], stroke: surf, 'stroke-width': 2 }, svg); });
    const lab = this.mesActivo != null && A[this.mesActivo] != null ? this.mesActivo : A.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).pop();
    if (lab != null && lab >= 0) this.el('text', { x: x(lab), y: y(A[lab]!) - 12, 'text-anchor': 'middle', fill: 'var(--h-fg, #111827)', 'font-size': 11.5, 'font-weight': 700 }, svg, pct(A[lab]));
    // Tooltip por mes.
    const tip = this.tipRef.nativeElement;
    const cruz = this.el('line', { y1: pt, y2: H - pb, stroke: fg3, 'stroke-width': 1, visibility: 'hidden' }, svg);
    this.etiquetas.forEach((_, i) => {
      const r = this.el('rect', { x: pl + bw * i, y: pt, width: bw, height: H - pt - pb, fill: 'transparent' }, svg);
      r.addEventListener('mouseenter', () => {
        cruz.setAttribute('x1', String(x(i))); cruz.setAttribute('x2', String(x(i))); cruz.setAttribute('visibility', 'visible');
        tip.innerHTML = this.tooltip(i);
        tip.hidden = false;
        const tw = tip.offsetWidth;
        let lx = x(i) + 14;
        if (lx + tw > W) lx = x(i) - tw - 14;
        tip.style.left = Math.max(0, lx) + 'px';
        tip.style.top = '6px';
      });
      r.addEventListener('mouseleave', () => { tip.hidden = true; cruz.setAttribute('visibility', 'hidden'); });
    });
  }

  private techo(v: number): number {
    const m = Math.pow(10, Math.floor(Math.log10(v))), e = v / m;
    return (e <= 1 ? 1 : e <= 2 ? 2 : e <= 2.5 ? 2.5 : e <= 5 ? 5 : 10) * m;
  }
  private marcas(hi: number): number[] {
    const paso = this.techo(hi / 4);
    const t: number[] = [];
    for (let v = 0; v <= hi + 1e-9; v += paso) t.push(+v.toFixed(10));
    return t;
  }
}
