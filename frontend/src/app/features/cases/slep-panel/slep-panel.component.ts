import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, Subscription, combineLatest, map, of, switchMap } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { WorkspaceModeService, ModoWorkspace } from '../../../core/services/workspace-mode.service';
import { DashboardApiService } from '../../dashboard/services/dashboard-api.service';
import { Contenedor } from '../../../core/models/case.model';

// Equivalente a _renderPanelSlep() del PMV — nombre en negrita si tiene
// datos cargados (más allá de los 3 campos fijos, TDD sección 7.2), sin
// ningún otro badge (diseño limpio, sección 4.1).
//
// Orden alfabético/por ranking (mejora post-v2.23): reutiliza el mismo
// endpoint de ranking que ya usa el Dashboard — nunca un cálculo aparte.
//
// Clic sensible al modo (mejora post-v2.23): en Formulario/Dashboard,
// un SLEP a la vez (slepActivo, como siempre). En Histórico, varios a
// la vez (slepsHistorico, un Set aparte en CaseStateService) — el clic
// se comporta distinto según en qué modo está el usuario en ese momento.
@Component({
  selector: 'app-slep-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slep-panel.component.html',
})
export class SlepPanelComponent implements OnInit, OnDestroy {
  readonly slepActivo$;
  readonly slepsHistorico$;
  readonly slepDestacadoHistorico$;
  readonly contenedoresOrdenados$;
  private slepActivo: string | null = null;
  private modo: ModoWorkspace = 'formulario';
  slepsHistorico = new Set<string>();
  slepDestacadoHistorico: string | null = null;
  private sub?: Subscription;

  private readonly ordenPorRankingSubject = new BehaviorSubject<boolean>(false);
  ordenPorRanking = false;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly workspaceMode: WorkspaceModeService,
    private readonly dashboardApi: DashboardApiService,
  ) {
    this.slepActivo$ = this.caseState.slepActivo$;
    this.slepsHistorico$ = this.caseState.slepsHistorico$;
    this.slepDestacadoHistorico$ = this.caseState.slepDestacadoHistorico$;

    const ranking$ = this.caseState.mesActivo$.pipe(
      switchMap((mes) => (mes ? this.dashboardApi.getRanking(mes.mes, mes.anio) : of([]))),
    );

    this.contenedoresOrdenados$ = combineLatest([this.caseState.contenedores$, ranking$, this.ordenPorRankingSubject]).pipe(
      map(([contenedores, ranking, porRanking]) => {
        if (!porRanking) return [...contenedores].sort((a, b) => a.slep.localeCompare(b.slep));
        const pctPorSlep = new Map(ranking.map((r) => [r.slep, r.pct]));
        return [...contenedores].sort((a, b) => (pctPorSlep.get(b.slep) ?? -1) - (pctPorSlep.get(a.slep) ?? -1));
      }),
    );
  }

  ngOnInit(): void {
    this.sub = combineLatest([
      this.slepActivo$,
      this.workspaceMode.modo$,
      this.slepsHistorico$,
      this.slepDestacadoHistorico$,
    ]).subscribe(([id, modo, sleps, destacado]) => {
      this.slepActivo = id;
      this.modo = modo;
      this.slepsHistorico = sleps;
      this.slepDestacadoHistorico = destacado;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Cómo pintar la fila de un SLEP en el panel, según el modo actual —
  // se usan como clases en la plantilla, en vez de repetir "| async"
  // varias veces por fila.
  esDestacado(c: Contenedor): boolean {
    return this.modo === 'historico' ? this.slepDestacadoHistorico === c.slep : this.slepActivo === c.id;
  }

  esMarcadoSecundario(c: Contenedor): boolean {
    return this.modo === 'historico' && this.slepsHistorico.has(c.slep) && this.slepDestacadoHistorico !== c.slep;
  }

  // Botón de 2 modos: alfabético (default) <-> por ranking, mayor a
  // menor avance. Clickear de nuevo vuelve al alfabético.
  alternarOrden(): void {
    this.ordenPorRanking = !this.ordenPorRanking;
    this.ordenPorRankingSubject.next(this.ordenPorRanking);
  }

  seleccionar(c: Contenedor): void {
    if (this.modo === 'historico') {
      this.caseState.toggleSlepHistorico(c.slep);
    } else {
      // Igual que Meses: clickear el mismo SLEP que ya está activo lo
      // deselecciona — vuelve al consolidado de los 36.
      this.caseState.setSlepActivo(this.slepActivo === c.id ? null : c.id);
    }
  }

  // "filled > 3" quedó obsoleto (hallazgo real): un SLEP migrado con sus
  // 37 campos en "0" contaba como lleno igual, porque en JavaScript el
  // texto "0" no es un string vacío. tieneDatosReales ya viene calculado
  // correctamente desde el backend (ver cases.service.ts, listarPorMes).
  tieneDatos(c: Contenedor): boolean {
    return c.tieneDatosReales;
  }
}
