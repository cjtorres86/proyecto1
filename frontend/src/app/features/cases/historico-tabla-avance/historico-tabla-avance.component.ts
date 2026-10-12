import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CORTE_BAJO, ESTILOS_TOOLTIP, HistoricoDetalle, MESES_CORTOS, metricas, nivel, pct, ranking, tooltipMes } from '../../../core/utils/avance';

interface Fila {
  slep: string;
  pos: number | null;
  celdas: { av: number | null; sinInfo: boolean; estilo: string }[];
}

// Tabla de avance por SLEP (modelo del informe de avance): filas = SLEP
// ordenados por su posición en el ranking del mes activo (1° = mayor
// avance), columnas = meses, % de avance de rojo (0 %) a azul (100 %).
// Reemplaza a la "Planilla general". Clic en una fila: destaca ese SLEP.
@Component({
  selector: 'app-historico-tabla-avance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historico-tabla-avance.component.html',
  styles: [
    ESTILOS_TOOLTIP,
    `.hm{border-collapse:separate;border-spacing:2px;font-size:11px;width:100%}
     .hm th{font-weight:600;color:#76839a;font-size:10px;padding:3px 2px;text-align:center;white-space:nowrap}
     .hm th.rh{text-align:left;padding:3px 6px}
     .hm td{text-align:center;padding:4px 2px;border-radius:3px;cursor:pointer;min-width:46px;white-space:nowrap}
     .hm td.pos{min-width:26px;color:#76839a;font-weight:700;cursor:pointer}
     .hm td.pos.top{color:#0f69b4}
     .hm td.nd{background:repeating-linear-gradient(135deg,#eceef2 0 4px,transparent 4px 8px);color:#76839a}
     .hm td.nom{text-align:left;padding:4px 6px;font-weight:500}
     .hm tr:hover td.nom{text-decoration:underline}
     .hm tr.dest td.nom{color:#0f69b4;font-weight:700}
     .hm tr.marc td.nom::before{content:'●';color:#b8c0cc;margin-right:4px;font-size:9px}
     .hm tr.dest td.nom::before{color:#0f69b4}
     .hm td.ref{outline:2px solid #111827;outline-offset:-2px}
     .cnt{display:block;font-weight:600;color:#d03b3b;font-size:9.5px}
     /* N° y SLEP quedan fijas a la izquierda al desplazar los meses. */
     .fijo1,.fijo2{position:sticky;z-index:2;background:#fff}
     .fijo1{left:0;min-width:28px}.fijo2{left:30px;box-shadow:6px 0 6px -6px rgba(0,0,0,.18)}
     :host-context(.dark) .fijo1,:host-context(.dark) .fijo2{background:#141B2E}
     .escala{height:8px;width:160px;border-radius:2px;background:linear-gradient(90deg,#d03b3b,#f0efec 50%,#0f69b4)}
     :host-context(.dark) .hm td.nd{background:repeating-linear-gradient(135deg,#222c3c 0 4px,transparent 4px 8px)}
     :host-context(.dark) .hm td.ref{outline-color:#e8edf5}
     :host-context(.dark) .hm tr.dest td.nom{color:#5aa7e8}`,
  ],
})
export class HistoricoTablaAvanceComponent implements OnChanges {
  @Input() detalle: HistoricoDetalle | null = null;
  @Input() mesActivo = 0;
  @Input() destacado: string | null = null;
  @Input() marcados = new Set<string>();
  @Output() elegir = new EventEmitter<string>();
  @ViewChild('tip', { static: true }) private tip!: ElementRef<HTMLDivElement>;
  @ViewChild('desplazable', { static: true }) private desplazable!: ElementRef<HTMLDivElement>;

  orden: 'rank' | 'rank-asc' | 'nom' = 'rank';
  etiquetas: string[] = [];
  bajosPorMes: number[] = [];
  filas: Fila[] = [];
  resumen = '';

  ngOnChanges(): void {
    this.armar();
  }

  armar(): void {
    const d = this.detalle;
    if (!d) { this.filas = []; return; }
    this.etiquetas = d.meses.map((m) => `${MESES_CORTOS[m.mes] ?? m.mes} ${m.anio.slice(2)}`);
    this.bajosPorMes = d.meses.map((_, i) => d.sleps.filter((s) => { const m = metricas(s.valores[i]); return !!m && m.av !== null && m.av < CORTE_BAJO; }).length);
    const rk = ranking(d.sleps, this.mesActivo);
    const posDe = (slep: string) => (d.alcanceCompleto ? rk.pos.get(slep) ?? null : d.posicion?.[this.mesActivo]?.pos ?? null);
    let filas: Fila[] = d.sleps.map((s) => ({
      slep: s.slep,
      pos: posDe(s.slep),
      celdas: s.valores.map((r) => {
        const m = metricas(r);
        return { av: m ? m.av : null, sinInfo: !m, estilo: m && m.av !== null ? this.color(m.av) : '' };
      }),
    }));
    const porNombre = (a: Fila, b: Fila) => a.slep.localeCompare(b.slep, 'es');
    if (this.orden === 'nom') filas.sort(porNombre);
    else {
      const dir = this.orden === 'rank-asc' ? -1 : 1;
      filas.sort((a, b) => (a.pos && b.pos ? dir * (a.pos - b.pos) : a.pos ? -1 : b.pos ? 1 : porNombre(a, b)));
    }
    this.filas = filas;
    // Parte mostrando los meses más recientes: desplaza hasta el mes activo.
    setTimeout(() => {
      const caja = this.desplazable.nativeElement, celda = caja.querySelector<HTMLElement>('td.ref');
      if (celda) caja.scrollLeft = Math.max(0, celda.offsetLeft + celda.offsetWidth - caja.clientWidth + 8);
    });
    const cuenta = (nv: string) => rk.lista.filter((x) => nivel(x.m.av) === nv).length;
    const mes = d.meses[this.mesActivo];
    this.resumen = d.alcanceCompleto && mes
      ? `En ${mes.mes.toLowerCase()} de ${mes.anio}, de ${rk.total} SLEP con sumarios instruidos: ${cuenta('alto')} con avance alto, ${cuenta('medio')} medio y ${cuenta('bajo')} bajo.`
      : '';
  }

  // 0 % rojo intenso → 50 % neutro → 100 % azul intenso (igual que el informe).
  private color(a: number): string {
    const t = Math.min(Math.abs(a - 0.5) / 0.5, 1) * 78, col = a < 0.5 ? '#d03b3b' : '#0f69b4';
    return `background:color-mix(in oklab, ${col} ${t.toFixed(0)}%, #f0efec);color:${t > 55 ? '#fff' : '#111827'}`;
  }

  texto(av: number | null): string {
    return pct(av).replace(' %', '%');
  }

  mostrarTip(e: MouseEvent, slep: string, i: number): void {
    const d = this.detalle!;
    const s = d.sleps.find((x) => x.slep === slep)!;
    const rk = ranking(d.sleps, i);
    const posicion = d.alcanceCompleto ? { pos: rk.pos.get(slep) ?? null, de: rk.total } : d.posicion?.[i] ?? null;
    const m = d.meses[i];
    const tip = this.tip.nativeElement;
    tip.innerHTML = tooltipMes(`${m.mes} ${m.anio}`, slep, metricas(s.valores[i]), metricas(s.valores[i - 1] ?? null), posicion);
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let lx = e.clientX + 16, ly = e.clientY + 16;
    if (lx + tw > innerWidth - 8) lx = e.clientX - tw - 16;
    if (ly + th > innerHeight - 8) ly = Math.max(8, e.clientY - th - 16);
    tip.style.left = lx + 'px';
    tip.style.top = ly + 'px';
  }

  ocultarTip(): void {
    this.tip.nativeElement.hidden = true;
  }
}
