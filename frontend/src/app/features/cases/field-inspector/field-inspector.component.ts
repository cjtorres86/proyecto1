import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, switchMap, of, map } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { CampoConValor } from '../../../core/models/case.model';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';
import { FieldChatComponent } from '../field-chat/field-chat.component';

// Equivalente al Inspector de Campo del PMV (TDD, sección 7.3) — ficha
// de detalle de la pregunta activa. Si no hay ninguna elegida todavía,
// muestra la bienvenida genérica (sección 7.8.1) en vez de una ficha vacía.
//
// "Total general" (mejora post-v2.23): reacciona igual que
// CaseFormPanelComponent — sin SLEP pero con mes elegido, corre las
// mismas validaciones sobre la suma de los 36. Si cada SLEP cumple una
// regla, la suma también debería cumplirla — que no la cumpla es una
// señal real de que algo anda mal en algún SLEP, vale la pena mostrarlo
// acá igual que para un SLEP puntual.
@Component({
  selector: 'app-field-inspector',
  standalone: true,
  imports: [CommonModule, ModeSwitcherComponent, FieldChatComponent],
  templateUrl: './field-inspector.component.html',
})
export class FieldInspectorComponent implements OnInit, OnDestroy {
  campos: CampoConValor[] = [];
  preguntaIdActivo: string | null = null;
  // Formulario (SLEP + mes) abierto — el chat del campo es de ESE
  // formulario. null en el "Total general", que no tiene chat.
  contenedorId: string | null = null;
  private sub?: Subscription;

  constructor(private readonly caseState: CaseStateService) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.slepActivo$, this.caseState.campoActivo$])
      .pipe(
        switchMap(([mes, slepId, campoId]) => {
          if (slepId) {
            return this.caseState.getContenedorConValores(slepId).pipe(map((r) => ({ campos: r.campos, campoId, contenedorId: slepId })));
          }
          if (mes) {
            return this.caseState.getTotalGeneral(mes.mes, mes.anio).pipe(map((r) => ({ campos: r.campos, campoId, contenedorId: null })));
          }
          return of(null);
        }),
      )
      .subscribe((resultado) => {
        this.campos = resultado?.campos ?? [];
        this.preguntaIdActivo = resultado?.campoId ?? null;
        this.contenedorId = resultado?.contenedorId ?? null;
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get campoActivo(): CampoConValor | null {
    return this.campos.find((c) => c.preguntaId === this.preguntaIdActivo) ?? null;
  }
}
