import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, of, switchMap } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { WorkspaceModeService } from '../../../core/services/workspace-mode.service';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';
import { CasesApiService } from '../services/cases-api.service';
import { COLOR_NIVEL, HistoricoDetalle, MetricasAvance, NIVEL_TXT, NivelAvance, fmt, metricas, nivel, pct, ranking } from '../../../core/utils/avance';

interface FilaRanking {
  pos: number | null;
  slep: string;
  m: MetricasAvance | null;
  nivel: NivelAvance;
}

// Ranking de avance (botón «Ranking» de la línea de botones, junto a
// Formulario, Dashboard e Histórico): por SLEP, en el mes elegido — N°, SLEP,
// funcionarios involucrados, sumarios instruidos, procesos en curso, procesos
// cerrados, sanciones aplicadas, la barra de avance (bajo / medio / alto) y el
// % de avance. Clic en un SLEP: lo destaca en el Histórico y abre el Histórico.
@Component({
  selector: 'app-ranking-panel',
  standalone: true,
  imports: [CommonModule, ModeSwitcherComponent],
  host: { class: 'block h-full' },
  template: `
    <div class="flex flex-col h-full min-h-0 text-gray-800 dark:text-gray-100">
      <div class="cab-panel">
        <h3 class="font-bold text-sm uppercase text-gray-500">Ranking</h3>
        <app-mode-switcher modoActivo="ranking" />
      </div>
      @if (!detalle) {
        <p class="text-sm text-gray-400">{{ cargando ? 'Cargando el ranking…' : 'Selecciona un mes en el panel Meses.' }}</p>
      } @else {
      <div class="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h4 class="text-base font-bold text-[#1B4673] dark:text-[#A9C8EE] m-0">Avance de los sumarios por SLEP · {{ mesTxt }}</h4>
          <p class="text-xs text-gray-500 m-0">% de avance = procesos cerrados / sumarios instruidos. 1° = mayor avance.</p>
        </div>
        <div class="inline-flex border border-gray-300 dark:border-gray-600 rounded overflow-hidden text-[11px]" role="group" aria-label="Orden del ranking">
          <button type="button" class="px-2 py-1 font-semibold cursor-pointer" [ngClass]="{ 'bg-[#0F69B4] text-white': !invertido }" [attr.aria-pressed]="!invertido" (click)="ordenar(false)">Mayor avance primero</button>
          <button type="button" class="px-2 py-1 font-semibold cursor-pointer border-l border-gray-300 dark:border-gray-600" [ngClass]="{ 'bg-[#0F69B4] text-white': invertido }" [attr.aria-pressed]="invertido" (click)="ordenar(true)">Menor avance primero</button>
        </div>
      </div>
      <div class="flex-1 min-h-0 overflow-auto border border-gray-200 dark:border-[#28324A] rounded">
        <table class="w-full text-xs border-collapse">
          <caption class="sr-only">Ranking de avance por SLEP</caption>
          <thead class="sticky top-0 bg-[#F1F3F6] dark:bg-[#1F2B3E] z-10">
            <tr class="text-[10px] uppercase tracking-normal text-gray-500 dark:text-gray-400">
              <th class="px-1.5 py-2 text-left">N°</th>
              <th class="px-1.5 py-2 text-left">SLEP</th>
              <th class="px-1.5 py-2 text-right">Funcionarios involucrados</th>
              <th class="px-1.5 py-2 text-right">Sumarios instruidos</th>
              <th class="px-1.5 py-2 text-right">Procesos en curso</th>
              <th class="px-1.5 py-2 text-right">Procesos cerrados</th>
              <th class="px-1.5 py-2 text-right">Sanciones aplicadas</th>
              <th class="px-1.5 py-2 text-left min-w-[44px] w-[14%]">Avance</th>
              <th class="px-1.5 py-2 text-right">% de avance</th>
            </tr>
          </thead>
          <tbody>
            @for (f of filas; track f.slep) {
              <tr class="border-t border-gray-100 dark:border-[#243147] hover:bg-[#F6F8FB] dark:hover:bg-[#1F2B3E] cursor-pointer" (click)="verEnHistorico(f.slep)" [title]="'Ver ' + f.slep + ' en el Histórico'">
                <td class="px-1.5 py-1.5 font-bold" [ngClass]="{ 'text-[#0F69B4]': f.pos && f.pos <= 3, 'text-gray-400': !f.pos || f.pos > 3 }">{{ f.pos ? f.pos + '°' : '—' }}</td>
                <td class="px-1.5 py-1.5 font-medium whitespace-nowrap">{{ f.slep }}</td>
                <td class="px-1.5 py-1.5 text-right tabular-nums">{{ fmt(f.m?.inv) }}</td>
                <td class="px-1.5 py-1.5 text-right tabular-nums">{{ fmt(f.m?.ins) }}</td>
                <td class="px-1.5 py-1.5 text-right tabular-nums">{{ fmt(f.m?.curso) }}</td>
                <td class="px-1.5 py-1.5 text-right tabular-nums">{{ fmt(f.m?.cerr) }}</td>
                <td class="px-1.5 py-1.5 text-right tabular-nums">{{ fmt(f.m?.san) }}</td>
                <td class="px-1.5 py-1.5">
                  @if (f.m && f.m.av !== null) {
                    <div class="h-2.5 w-full bg-[#ECEFF4] dark:bg-[#1F2B3E] rounded overflow-hidden" [title]="NIVEL_TXT[f.nivel]">
                      <div class="h-full rounded" [style.width.%]="ancho(f.m.av)" [style.background]="color(f.nivel)"></div>
                    </div>
                  } @else {
                    <span class="text-[10.5px] text-gray-400">{{ f.m ? 'Sin sumarios instruidos' : 'Sin información' }}</span>
                  }
                </td>
                <td class="px-1.5 py-1.5 text-right tabular-nums font-bold whitespace-nowrap" [style.color]="color(f.nivel)">{{ f.m ? pct(f.m.av) : '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="text-[11px] text-gray-500 mt-2 mb-0">Barra: <span style="color:#d03b3b">■</span> bajo (menos de 25 %) · <span style="color:#b7791f">■</span> medio (25 % a 74,9 %) · <span style="color:#0f69b4">■</span> alto (75 % o más). Clic en un SLEP para verlo en el Histórico.</p>
      }
    </div>
  `,
})
export class RankingPanelComponent implements OnInit, OnDestroy {
  detalle: HistoricoDetalle | null = null;
  cargando = false;
  filas: FilaRanking[] = [];
  invertido = false;
  mesTxt = '';
  private mesActivo = 0;
  private sub?: Subscription;
  readonly fmt = fmt;
  readonly pct = pct;
  readonly NIVEL_TXT = NIVEL_TXT;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly api: CasesApiService,
    private readonly workspaceMode: WorkspaceModeService,
  ) {}

  // Los datos de todos los SLEP del mes elegido (la misma consulta del Histórico).
  ngOnInit(): void {
    this.sub = this.caseState.mesActivo$
      .pipe(switchMap((mes) => {
        this.detalle = null;
        this.cargando = !!mes;
        this.mesTxt = mes ? `${mes.mes} ${mes.anio}` : '';
        return mes ? this.api.getHistoricoDetalle(mes.mes, mes.anio) : of(null);
      }))
      .subscribe((d) => {
        this.cargando = false;
        if (!d) return;
        const [mes, anio] = this.mesTxt.split(' ');
        this.mesActivo = Math.max(0, d.meses.findIndex((m) => m.mes === mes && m.anio === anio));
        this.detalle = d;
        this.ordenar(this.invertido);
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  verEnHistorico(slep: string): void {
    this.caseState.destacarSlepHistorico(slep);
    this.workspaceMode.irA('historico');
  }

  ordenar(invertido: boolean): void {
    this.invertido = invertido;
    const d = this.detalle;
    if (!d) return;
    const i = this.mesActivo, rk = ranking(d.sleps, i);
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
