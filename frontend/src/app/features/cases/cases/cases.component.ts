import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceModeService } from '../../../core/services/workspace-mode.service';
import { MonthsPanelComponent } from '../months-panel/months-panel.component';
import { SlepPanelComponent } from '../slep-panel/slep-panel.component';
import { CaseFormPanelComponent } from '../case-form-panel/case-form-panel.component';
import { FieldInspectorComponent } from '../field-inspector/field-inspector.component';
import { DashboardComponent } from '../../dashboard/dashboard/dashboard.component';
import { HistoricoPanelComponent } from '../historico-panel/historico-panel.component';

// Workspace principal (TDD, sección 7.8): Meses y SLEP siempre visibles;
// los 2 paneles de la derecha alternan entre 3 modos (Formulario+
// Inspector, Dashboard ampliado, Histórico), según WorkspaceModeService
// — ningún componente llama a otro directamente, todos leen el mismo
// Observable. El switcher de 3 vías vive dentro de cada uno de los 3
// paneles (app-mode-switcher), no acá arriba.
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

  constructor(private readonly workspaceMode: WorkspaceModeService) {
    this.modo$ = this.workspaceMode.modo$;
  }
}
