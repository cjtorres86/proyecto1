import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, switchMap, of, forkJoin, map } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { CasesApiService } from '../services/cases-api.service';
import { HistoricoSlep } from '../../../core/models/case.model';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';
import { HistoricoChartComponent, SerieHistoricoAvance } from '../historico-chart/historico-chart.component';

// Misma escala de color que RankingComponent.colorBarra() — se repite
// acá porque este panel no reutiliza ese componente (es un gráfico de
// líneas, no barras), no porque sea una regla distinta.
function colorPorAvance(pct: number | null): string {
  if (pct === null) return '#D1D5DB';
  if (pct >= 75) return '#00E0FF';
  if (pct >= 50) return '#16A34A';
  if (pct >= 25) return '#D97706';
  return '#DC2626';
}

// Panel "Ver Histórico" — 2 niveles:
//
// GENERAL (sin ningún SLEP marcado): una línea (% de avance mes a mes,
// el mismo indicador del Dashboard) más la planilla tipo Excel
// (columnas = SLEP, filas = mes). Reutiliza CasesService.
// getHistoricoAvance()/getHistoricoAvanceTodosLosSlep() — mismo motor
// de suma que el Dashboard, nunca un cálculo aparte.
//
// POR SLEP: clickear un SLEP en el panel (estando en este modo) agrega
// su propia línea al MISMO gráfico general, en gris — clickearlo de
// nuevo la quita. El último que se marcó ("destacado") queda en SU
// PROPIO color (según su nivel de avance actual) y encima de todas las
// demás líneas, incluida la general; la planilla general se reemplaza
// por la planilla detallada de ESE SLEP (mes x 37 campos) mientras
// haya uno destacado — no se muestran las 2 a la vez.
//
// El estado de qué SLEP están marcados vive en CaseStateService,
// SEPARADO de slepActivo — así sobrevive un cambio a Formulario/
// Dashboard y de vuelta a Histórico.
@Component({
  selector: 'app-historico-panel',
  standalone: true,
  imports: [CommonModule, ModeSwitcherComponent, HistoricoChartComponent],
  templateUrl: './historico-panel.component.html',
})
export class HistoricoPanelComponent implements OnInit, OnDestroy {
  mes: string | null = null;
  anio: string | null = null;

  etiquetasMeses: string[] = [];
  series: SerieHistoricoAvance[] = [];

  tablaGeneral: { sleps: string[]; filas: { mes: string; anio: string; valores: number[] }[] } | null = null;

  slepDestacado: string | null = null;
  datosSlepDestacado: HistoricoSlep | null = null;

  cargando = false;
  private sub?: Subscription;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly api: CasesApiService,
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.slepsHistorico$, this.caseState.slepDestacadoHistorico$])
      .pipe(
        switchMap(([mes, sleps, destacado]) => {
          if (!mes) return of(null);
          this.mes = mes.mes;
          this.anio = mes.anio;
          this.cargando = true;

          const listaSleps = [...sleps];
          return forkJoin({
            // "destacado" viaja DENTRO del resultado — nunca se lee una
            // propiedad de la clase adentro del subscribe (hallazgo
            // real: eso era justo lo que podía desincronizar el color
            // del SLEP marcado con el resultado que en verdad llegó).
            destacado: of(destacado),
            general: this.api.getHistoricoAvance(mes.mes, mes.anio),
            // La planilla general solo hace falta si NO hay un SLEP
            // destacado (se reemplaza por su planilla detallada) — no
            // se pide de más cuando no se va a mostrar.
            tabla: destacado ? of(null) : this.api.getHistoricoAvanceTodos(mes.mes, mes.anio),
            porSlep: listaSleps.length
              ? forkJoin(listaSleps.map((s) => this.api.getHistoricoAvance(mes.mes, mes.anio, s).pipe(map((datos) => ({ slep: s, datos })))))
              : of([]),
            destacadoHistorico: destacado ? this.api.getHistorico(destacado, mes.mes, mes.anio) : of(null),
          });
        }),
      )
      .subscribe((resultado) => {
        this.cargando = false;
        if (!resultado) {
          this.etiquetasMeses = [];
          this.series = [];
          this.tablaGeneral = null;
          this.slepDestacado = null;
          this.datosSlepDestacado = null;
          return;
        }

        this.slepDestacado = resultado.destacado;
        this.etiquetasMeses = resultado.general.map((f) => `${f.mes} ${f.anio}`);

        const serieGeneral: SerieHistoricoAvance = {
          etiqueta: 'General (36 SLEP)',
          datos: resultado.general.map((f) => f.pct),
          color: colorPorAvance(resultado.general.at(-1)?.pct ?? null),
          prioridad: 1,
        };
        const seriesSlep: SerieHistoricoAvance[] = resultado.porSlep.map(({ slep, datos }) => {
          const esDestacado = slep === resultado.destacado;
          return {
            etiqueta: slep,
            datos: datos.map((f) => f.pct),
            color: esDestacado ? colorPorAvance(datos.at(-1)?.pct ?? null) : '#D1D5DB',
            prioridad: esDestacado ? 2 : 0,
          };
        });
        this.series = [serieGeneral, ...seriesSlep];

        this.tablaGeneral = resultado.tabla;
        this.datosSlepDestacado = resultado.destacadoHistorico;
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
