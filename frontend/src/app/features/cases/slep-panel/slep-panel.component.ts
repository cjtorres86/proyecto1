import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, combineLatest, map, of, switchMap } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { DashboardApiService } from '../../dashboard/services/dashboard-api.service';
import { Contenedor } from '../../../core/models/case.model';

// Equivalente a _renderPanelSlep() del PMV — nombre en negrita si tiene
// datos cargados (más allá de los 3 campos fijos, TDD sección 7.2), sin
// ningún otro badge (diseño limpio, sección 4.1).
//
// Orden alfabético/por ranking (mejora post-v2.23): reutiliza el mismo
// endpoint de ranking que ya usa el Dashboard — nunca un cálculo aparte.
@Component({
  selector: 'app-slep-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './slep-panel.component.html',
})
export class SlepPanelComponent implements OnInit {
  readonly slepActivo$;
  readonly contenedoresOrdenados$;
  private slepActivo: string | null = null;

  private readonly ordenPorRankingSubject = new BehaviorSubject<boolean>(false);
  ordenPorRanking = false;

  constructor(
    private readonly caseState: CaseStateService,
    private readonly dashboardApi: DashboardApiService,
  ) {
    this.slepActivo$ = this.caseState.slepActivo$;

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
    this.slepActivo$.subscribe((id) => (this.slepActivo = id));
  }

  // Botón de 2 modos: alfabético (default) <-> por ranking, mayor a
  // menor avance. Clickear de nuevo vuelve al alfabético.
  alternarOrden(): void {
    this.ordenPorRanking = !this.ordenPorRanking;
    this.ordenPorRankingSubject.next(this.ordenPorRanking);
  }

  // Igual que Meses: clickear el mismo SLEP que ya está activo lo
  // deselecciona. Ahora es necesario para poder volver al Dashboard
  // consolidado de los 36 SLEP.
  seleccionar(c: Contenedor): void {
    this.caseState.setSlepActivo(this.slepActivo === c.id ? null : c.id);
  }

  // "filled > 3" quedó obsoleto (hallazgo real): un SLEP migrado con sus
  // 37 campos en "0" contaba como lleno igual, porque en JavaScript el
  // texto "0" no es un string vacío. tieneDatosReales ya viene calculado
  // correctamente desde el backend (ver cases.service.ts, listarPorMes).
  tieneDatos(c: Contenedor): boolean {
    return c.tieneDatosReales;
  }

  // Sin funcionalidad todavía — botón integrado a pedido, la lógica de
  // crear un SLEP nuevo (y su permiso asociado) queda para más adelante.
  agregarSlep(): void {}
}
