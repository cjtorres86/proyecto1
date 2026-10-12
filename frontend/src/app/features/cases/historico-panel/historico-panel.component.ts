import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, combineLatest, forkJoin, of, switchMap, tap } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { CasesApiService } from '../services/cases-api.service';
import { HistoricoSlep } from '../../../core/models/case.model';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';
import { HistoricoChartComponent, SerieComparacion, SeriePrincipal } from '../historico-chart/historico-chart.component';
import { HistoricoTablaAvanceComponent } from '../historico-tabla-avance/historico-tabla-avance.component';
import { RankingAvanceDialogComponent } from '../ranking-avance-dialog/ranking-avance-dialog.component';
import { HistoricoDetalle, MESES_CORTOS, MetricasAvance, escaparHtml, metricas, pct, ranking, sumar, tooltipMes } from '../../../core/utils/avance';

// Histórico con el modelo del informe de avance (gráfico, tabla de avance por
// SLEP y ranking). Mantiene lo propio del Histórico: la línea General, los
// SLEP marcados en el panel SLEP (en gris), el destacado (el último marcado,
// en color y con su planilla detallada de 37 campos) y, para quien ve un solo
// SLEP, solo su información.
//
// Los datos de TODOS los SLEP llegan en una sola consulta por mes
// (/cases/historico-detalle): marcar o destacar SLEP no vuelve a consultar.
@Component({
  selector: 'app-historico-panel',
  standalone: true,
  imports: [CommonModule, ModeSwitcherComponent, HistoricoChartComponent, HistoricoTablaAvanceComponent],
  templateUrl: './historico-panel.component.html',
  host: { class: 'block h-full' },
})
export class HistoricoPanelComponent implements OnInit, OnDestroy {
  mes: string | null = null;
  anio: string | null = null;
  detalle: HistoricoDetalle | null = null;
  mesActivoIdx = 0;
  etiquetas: string[] = [];
  principal: SeriePrincipal | null = null;
  general: SerieComparacion | null = null;
  otros: SerieComparacion[] = [];
  slepDestacado: string | null = null;
  marcados = new Set<string>();
  datosSlepDestacado: HistoricoSlep | null = null;
  tituloGrafico = 'General';
  escala: '100' | 'aj' = '100';
  private generalM: (MetricasAvance | null)[] = [];
  private cache: { clave: string; detalle: HistoricoDetalle } | null = null;
  private sub?: Subscription;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly api: CasesApiService,
    private readonly authService: AuthService,
    private readonly dialog: MatDialog,
  ) {}

  // Quien ve un solo SLEP (ej. Digitador): siempre es SU SLEP.
  private get slepPropio(): string | null {
    const u = this.authService.usuarioActual();
    return u && !u.esSuperadmin && u.alcance !== 'todos' ? u.alcance : null;
  }

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.slepsHistorico$, this.caseState.slepDestacadoHistorico$])
      .pipe(
        switchMap(([mes, sleps, destacado]) => {
          if (!mes) return of(null);
          const propio = this.slepPropio;
          const dest = propio ?? destacado;
          const clave = `${mes.mes}|${mes.anio}`;
          return forkJoin({
            mesActivo: of(mes),
            marcados: of(propio ? new Set<string>() : new Set(sleps)),
            destacado: of(dest),
            // Una consulta por mes: si solo cambian los SLEP marcados, se reutiliza.
            detalle: this.cache?.clave === clave ? of(this.cache.detalle) : this.api.getHistoricoDetalle(mes.mes, mes.anio).pipe(tap((d) => (this.cache = { clave, detalle: d }))),
            planilla: dest ? this.api.getHistorico(dest, mes.mes, mes.anio) : of(null),
          });
        }),
      )
      .subscribe((r) => {
        if (!r) {
          this.mes = this.anio = null;
          this.detalle = null;
          this.principal = this.general = null;
          this.otros = [];
          this.slepDestacado = null;
          this.datosSlepDestacado = null;
          return;
        }
        this.mes = r.mesActivo.mes;
        this.anio = r.mesActivo.anio;
        this.detalle = r.detalle;
        this.marcados = r.marcados;
        this.datosSlepDestacado = r.planilla;
        this.armar(r.destacado);
      });
  }

  private armar(destacado: string | null): void {
    const d = this.detalle!;
    this.mesActivoIdx = Math.max(0, d.meses.findIndex((m) => m.mes === this.mes && m.anio === this.anio));
    this.etiquetas = d.meses.map((m) => `${MESES_CORTOS[m.mes] ?? m.mes} ${m.anio.slice(2)}`);
    const avDe = (slep: string) => (d.sleps.find((s) => s.slep === slep)?.valores ?? []).map((v) => metricas(v)?.av ?? null);
    const fila = destacado ? d.sleps.find((s) => s.slep === destacado) : undefined;
    this.slepDestacado = fila ? destacado : null;
    this.generalM = d.meses.map((_, i) => sumar(d.sleps.map((s) => s.valores[i])));
    if (!d.alcanceCompleto) {
      // Un solo SLEP: su línea, sin General ni comparaciones.
      const s = d.sleps[0];
      this.tituloGrafico = s?.slep ?? 'Mi SLEP';
      this.principal = { etiqueta: this.tituloGrafico, metricas: (s?.valores ?? []).map((v) => metricas(v)) };
      this.general = null;
      this.otros = [];
      return;
    }
    const otros = [...this.marcados].filter((s) => s !== this.slepDestacado && d.sleps.some((x) => x.slep === s));
    this.otros = otros.map((s) => ({ etiqueta: s, av: avDe(s) }));
    if (fila) {
      this.tituloGrafico = fila.slep;
      this.principal = { etiqueta: fila.slep, metricas: fila.valores.map((v) => metricas(v)) };
      this.general = { etiqueta: `General (${d.sleps.length} SLEP)`, av: this.generalM.map((m) => (m ? m.av : null)) };
    } else {
      this.tituloGrafico = `General (${d.sleps.length} SLEP)`;
      this.principal = { etiqueta: this.tituloGrafico, metricas: this.generalM };
      this.general = null;
    }
  }

  // Tooltip completo de un mes del gráfico (mismo contenido que el informe),
  // más el % de la General y de los demás SLEP marcados en ese mes.
  readonly tooltipFn = (i: number): string => {
    const d = this.detalle;
    if (!d || !this.principal) return '';
    const m = d.meses[i], titulo = `${m.mes} ${m.anio}`;
    const ms = this.principal.metricas;
    const esGeneral = d.alcanceCompleto && !this.slepDestacado;
    let posicion: { pos: number | null; de: number } | null = null;
    if (!esGeneral) {
      if (d.alcanceCompleto) { const rk = ranking(d.sleps, i); posicion = { pos: rk.pos.get(this.slepDestacado!) ?? null, de: rk.total }; }
      else posicion = d.posicion?.[i] ?? null;
    }
    let extra = '';
    const comp = [...(this.general ? [this.general] : []), ...this.otros].map((s) => [s.etiqueta, s.av[i]] as [string, number | null]);
    if (comp.length) extra = `<span class="sep"></span><span class="sec">Comparación del mes</span>` + comp.map(([e, v]) => `<span class="r"><span>${escaparHtml(e)}</span><span>${pct(v)}</span></span>`).join('');
    const sub = esGeneral ? `General · informan ${ms[i]?.n ?? 0} de ${d.sleps.length} SLEP` : this.principal.etiqueta;
    return tooltipMes(titulo, sub, ms[i], ms[i - 1] ?? null, posicion, extra);
  };

  // Clic en una fila de la tabla o en el ranking: destaca ese SLEP.
  elegirSlep(slep: string): void {
    if (this.detalle?.alcanceCompleto) this.caseState.destacarSlepHistorico(slep);
  }

  abrirRanking(): void {
    if (!this.detalle) return;
    this.dialog
      .open(RankingAvanceDialogComponent, { data: { detalle: this.detalle, mesActivo: this.mesActivoIdx }, width: '1120px', maxWidth: '96vw' })
      .afterClosed()
      .subscribe((slep?: string) => { if (slep) this.elegirSlep(slep); });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
