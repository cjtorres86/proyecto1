import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { COLOR_NIVEL, HistoricoDetalle, MetricasAvance, NIVEL_TXT, NivelAvance, fmt, metricas, nivel, pct, ranking } from '../../../core/utils/avance';

export interface RankingAvanceDatos {
  detalle: HistoricoDetalle;
  mesActivo: number;
}

interface FilaRanking {
  pos: number | null;
  slep: string;
  m: MetricasAvance | null;
  nivel: NivelAvance;
}

// Ranking de avance del Histórico (su propio botón): por SLEP, en el mes
// activo — N°, SLEP, casos informados, los 5 indicadores del informe y el %
// de avance, con la barra de color (bajo / medio / alto) al final de cada
// línea. Clic en un SLEP: lo destaca en el Histórico (cierra la ventana con
// su nombre).
@Component({
  selector: 'app-ranking-avance-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  template: `
    <div class="p-5 max-h-[85vh] flex flex-col gap-3 text-gray-800 dark:text-gray-100">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Ranking de avance</p>
          <h2 class="text-lg font-bold text-[#1B4673] dark:text-[#A9C8EE]">Avance de los sumarios por SLEP · {{ mesTxt }}</h2>
          <p class="text-xs text-gray-500">% de avance = procesos cerrados / sumarios instruidos. {{ datos.detalle.alcanceCompleto ? '1° = mayor avance.' : '' }}</p>
        </div>
        <div class="flex items-center gap-2">
          @if (datos.detalle.alcanceCompleto) {
            <div class="inline-flex border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden text-xs" role="group" aria-label="Orden del ranking">
              <button type="button" class="px-3 py-1.5 font-semibold cursor-pointer" [ngClass]="{ 'bg-[#0F69B4] text-white': !invertido }" [attr.aria-pressed]="!invertido" (click)="ordenar(false)">Mayor avance primero</button>
              <button type="button" class="px-3 py-1.5 font-semibold cursor-pointer border-l border-gray-300 dark:border-gray-600" [ngClass]="{ 'bg-[#0F69B4] text-white': invertido }" [attr.aria-pressed]="invertido" (click)="ordenar(true)">Menor avance primero</button>
            </div>
          }
          <button type="button" mat-dialog-close class="w-8 h-8 rounded-md border border-gray-300 dark:border-gray-600 cursor-pointer" aria-label="Cerrar ranking">✕</button>
        </div>
      </div>
      <div class="overflow-auto border border-gray-200 dark:border-[#28324A] rounded">
        <table class="w-full text-xs border-collapse">
          <caption class="sr-only">Ranking de avance por SLEP</caption>
          <thead class="sticky top-0 bg-[#F1F3F6] dark:bg-[#1F2B3E] z-10">
            <tr class="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <th class="px-2 py-2 text-left">N°</th>
              <th class="px-2 py-2 text-left">SLEP</th>
              <th class="px-2 py-2 text-right">Casos informados</th>
              <th class="px-2 py-2 text-right">Funcionarios involucrados</th>
              <th class="px-2 py-2 text-right">Sumarios instruidos</th>
              <th class="px-2 py-2 text-right">Procesos en curso</th>
              <th class="px-2 py-2 text-right">Procesos cerrados</th>
              <th class="px-2 py-2 text-right">Sanciones aplicadas</th>
              <th class="px-2 py-2 text-right">% de avance</th>
              <th class="px-2 py-2 text-left w-[180px]">Avance</th>
            </tr>
          </thead>
          <tbody>
            @for (f of filas; track f.slep) {
              <tr class="border-t border-gray-100 dark:border-[#243147] hover:bg-[#F6F8FB] dark:hover:bg-[#1F2B3E] cursor-pointer" (click)="ref.close(f.slep)" [title]="'Destacar ' + f.slep + ' en el Histórico'">
                <td class="px-2 py-1.5 font-bold" [ngClass]="{ 'text-[#0F69B4]': f.pos && f.pos <= 3, 'text-gray-400': !f.pos || f.pos > 3 }">{{ f.pos ? f.pos + '°' : '—' }}</td>
                <td class="px-2 py-1.5 font-medium whitespace-nowrap">{{ f.slep }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums">{{ fmt(f.m?.casos) }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums">{{ fmt(f.m?.inv) }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums">{{ fmt(f.m?.ins) }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums">{{ fmt(f.m?.curso) }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums">{{ fmt(f.m?.cerr) }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums">{{ fmt(f.m?.san) }}</td>
                <td class="px-2 py-1.5 text-right tabular-nums font-bold" [style.color]="color(f.nivel)">{{ f.m ? pct(f.m.av) : '—' }}</td>
                <td class="px-2 py-1.5">
                  @if (f.m && f.m.av !== null) {
                    <div class="h-2.5 w-full bg-[#ECEFF4] dark:bg-[#1F2B3E] rounded overflow-hidden" [title]="NIVEL_TXT[f.nivel]">
                      <div class="h-full rounded" [style.width.%]="ancho(f.m.av)" [style.background]="color(f.nivel)"></div>
                    </div>
                  } @else {
                    <span class="text-[10.5px] text-gray-400">{{ f.m ? 'Sin sumarios instruidos' : 'Sin información' }}</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="text-[11px] text-gray-500">Barra: <span style="color:#d03b3b">■</span> bajo (menos de 25 %) · <span style="color:#b7791f">■</span> medio (25 % a 74,9 %) · <span style="color:#0f69b4">■</span> alto (75 % o más). Clic en un SLEP para destacarlo en el Histórico.</p>
    </div>
  `,
})
export class RankingAvanceDialogComponent {
  filas: FilaRanking[] = [];
  invertido = false;
  mesTxt = '';
  readonly fmt = fmt;
  readonly pct = pct;
  readonly NIVEL_TXT = NIVEL_TXT;

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly datos: RankingAvanceDatos,
    readonly ref: MatDialogRef<RankingAvanceDialogComponent, string>,
  ) {
    const m = datos.detalle.meses[datos.mesActivo];
    this.mesTxt = m ? `${m.mes} ${m.anio}` : '';
    this.ordenar(false);
  }

  ordenar(invertido: boolean): void {
    this.invertido = invertido;
    const d = this.datos.detalle, i = this.datos.mesActivo, rk = ranking(d.sleps, i);
    const pos = (s: string) => (d.alcanceCompleto ? rk.pos.get(s) ?? null : d.posicion?.[i]?.pos ?? null);
    const conPos: FilaRanking[] = [], sinPos: FilaRanking[] = [];
    for (const s of d.sleps) {
      const m = metricas(s.valores[i]);
      const f = { pos: pos(s.slep), slep: s.slep, m, nivel: nivel(m ? m.av : null) };
      (f.pos ? conPos : sinPos).push(f);
    }
    conPos.sort((a, b) => (invertido ? b.pos! - a.pos! : a.pos! - b.pos!));
    sinPos.sort((a, b) => a.slep.localeCompare(b.slep, 'es'));
    this.filas = [...conPos, ...sinPos];
  }

  color(nv: NivelAvance): string {
    return COLOR_NIVEL[nv];
  }

  ancho(av: number): number {
    return Math.max(2, Math.min(av, 1) * 100);
  }
}
