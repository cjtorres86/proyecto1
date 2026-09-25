import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest } from 'rxjs';
import { CommonModule } from '@angular/common';
import { WorkspaceModeService } from '../../../core/services/workspace-mode.service';
import { AuthService } from '../../../core/services/auth.service';
import { CaseStateService } from '../../../core/services/case-state.service';
import { MonthsPanelComponent } from '../months-panel/months-panel.component';
import { SlepPanelComponent } from '../slep-panel/slep-panel.component';
import { CaseFormPanelComponent } from '../case-form-panel/case-form-panel.component';
import { FieldInspectorComponent } from '../field-inspector/field-inspector.component';
import { DashboardComponent } from '../../dashboard/dashboard/dashboard.component';
import { HistoricoPanelComponent } from '../historico-panel/historico-panel.component';

// Workspace principal (TDD, sección 7.8): Meses siempre visible; los
// paneles de la derecha alternan entre 3 modos (Formulario+Inspector,
// Dashboard ampliado, Histórico), según WorkspaceModeService — ningún
// componente llama a otro directamente, todos leen el mismo Observable.
// El switcher de 3 vías vive dentro de Inspector/Dashboard/Histórico
// (app-mode-switcher), no acá arriba — CaseFormPanel nunca lo tiene,
// justo porque es el único panel que no rota (ver esDigitador).
//
// Layout Digitador (mejora post-v2.23): un Digitador siempre ve un solo
// SLEP fijo (TDD, sección 11.2.1) — el panel SLEP no tiene nada que
// elegir ahí, así que se saca del todo. El espacio libre queda así:
// Meses(1) + Formulario(1, SIEMPRE visible, es su vista principal) +
// [Inspector | Dashboard | Histórico, col-span-2, se turnan igual que
// hoy Dashboard/Histórico]. Se detecta por alcance, no por el nombre
// del perfil — la razón real es "tiene un solo SLEP fijo", no una
// etiqueta.
@Component({
  selector: 'app-cases',
  standalone: true,
  imports: [
    CommonModule,
    MonthsPanelComponent, SlepPanelComponent, CaseFormPanelComponent, FieldInspectorComponent, DashboardComponent,
    HistoricoPanelComponent,
  ],
  templateUrl: './cases.component.html',
})
export class CasesComponent {
  readonly modo$;

  constructor(
    private readonly workspaceMode: WorkspaceModeService,
    readonly authService: AuthService,
    private readonly caseState: CaseStateService,
  ) {
    this.modo$ = this.workspaceMode.modo$;

    // Digitador: sin panel SLEP, nadie elige su contenedor a mano (hallazgo
    // real: le quedaba el "Formulario total general", de solo lectura, sin
    // poder ingresar datos). Al elegir un mes, se activa solo el contenedor
    // de SU SLEP para ESE mes — se compara también el mes, para no tomar
    // por un instante el contenedor del mes anterior mientras carga el
    // nuevo. Si algo lo deja en null (re-clickear el mes activo), se vuelve
    // a activar. takeUntilDestroyed: la suscripción se cierra sola al salir.
    combineLatest([this.caseState.mesActivo$, this.caseState.contenedores$, this.caseState.slepActivo$])
      .pipe(takeUntilDestroyed())
      .subscribe(([mes, contenedores, slepActivo]) => {
        const u = this.authService.usuarioActual();
        if (!mes || !u || u.alcance === 'todos') return;
        const propio = contenedores.find(
          (c) => c.slep === u.alcance && c.mesConsolidado === mes.mes && c.anioConsolidado === mes.anio,
        );
        if (propio && propio.id !== slepActivo) this.caseState.setSlepActivo(propio.id);
      });
  }

  get esDigitador(): boolean {
    const u = this.authService.usuarioActual();
    return !!u && u.alcance !== 'todos';
  }
}
