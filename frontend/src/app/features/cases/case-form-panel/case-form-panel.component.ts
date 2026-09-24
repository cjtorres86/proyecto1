import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Subscription, combineLatest, switchMap, of, map } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CampoConValor, Contenedor } from '../../../core/models/case.model';

// Equivalente a _renderPanelFormulario() + _guardarFormulario() del PMV
// (TDD, sección 7.10) — MAKEMAKE (este componente) nunca escribe el
// contenedor directamente; solo lee lo que el Digitador tipeó y le pide
// a CaseStateService que lo guarde. Enfocar un campo también lo activa
// en el Inspector (mismo comportamiento que clickear la fila).
//
// "Total general" (mejora post-v2.23): si hay mes elegido pero ningún
// SLEP, muestra la suma de los 36 en el mismo formato — de solo
// lectura, sin botón Guardar ni Cargar Datos (una suma no se puede
// "editar de vuelta" en 36 SLEP distintos).
@Component({
  selector: 'app-case-form-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule],
  templateUrl: './case-form-panel.component.html',
})
export class CaseFormPanelComponent implements OnInit, OnDestroy {
  contenedor: Contenedor | null = null;
  campos: CampoConValor[] = [];
  valoresEditados: Record<string, string> = {};
  guardando = false;
  esTotalGeneral = false;
  totalContenedores = 0;
  campoActivoId: string | null = null;
  private sub?: Subscription;
  private subCampoActivo?: Subscription;

  constructor(
    private readonly caseState: CaseStateService,
    readonly authService: AuthService,
    private readonly notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.slepActivo$])
      .pipe(
        switchMap(([mes, slepId]) => {
          this.esTotalGeneral = !slepId && !!mes;
          if (slepId) {
            return this.caseState
              .getContenedorConValores(slepId)
              .pipe(map((r) => ({ contenedor: r.contenedor, campos: r.campos, totalContenedores: 0 })));
          }
          if (mes) {
            return this.caseState
              .getTotalGeneral(mes.mes, mes.anio)
              .pipe(map((r) => ({ contenedor: null, campos: r.campos, totalContenedores: r.totalContenedores })));
          }
          return of(null);
        }),
      )
      .subscribe((resultado) => {
        this.contenedor = resultado?.contenedor ?? null;
        this.campos = resultado?.campos ?? [];
        this.totalContenedores = resultado?.totalContenedores ?? 0;
        this.valoresEditados = {};
      });
    // Resalta la fila del campo activo (mejora post-v2.23) — antes solo
    // el Inspector de Campo reaccionaba a esto, el Formulario no mostraba
    // ningún indicador visual de cuál fila estaba seleccionada.
    this.subCampoActivo = this.caseState.campoActivo$.subscribe((id) => (this.campoActivoId = id));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.subCampoActivo?.unsubscribe();
  }

  get puedeEditar(): boolean {
    return this.authService.can('editar_formulario');
  }

  esEditable(campo: CampoConValor): boolean {
    return !this.esTotalGeneral && this.puedeEditar && (campo.tipo === 'number' || campo.tipo === 'money');
  }

  activarCampo(campo: CampoConValor): void {
    this.caseState.setCampoActivo(campo.preguntaId);
  }

  onValorChange(campo: CampoConValor, valor: string): void {
    this.valoresEditados[campo.preguntaId] = valor;
  }

  guardar(): void {
    if (!this.contenedor) return;
    this.guardando = true;
    this.caseState.guardarValores(this.contenedor.id, this.valoresEditados).subscribe({
      next: () => {
        this.guardando = false;
        this.notification.mostrar(`Datos guardados para ${this.contenedor!.slep}.`);
        this.caseState.getContenedorConValores(this.contenedor!.id).subscribe((r) => {
          this.contenedor = r.contenedor;
          this.campos = r.campos;
          this.valoresEditados = {};
        });
      },
      error: () => {
        this.guardando = false;
        this.notification.mostrar('No se pudieron guardar los datos.');
      },
    });
  }

  onArchivoSeleccionado(event: Event): void {
    if (!this.contenedor) return;
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.caseState.importarArchivo(this.contenedor.id, archivo).subscribe({
      next: (res) => {
        const msg = `Datos cargados para ${this.contenedor!.slep} desde "${archivo.name}".` +
          (res.desconocidas.length ? ` (${res.desconocidas.length} columnas no reconocidas)` : '');
        this.notification.mostrar(msg);
        this.caseState.getContenedorConValores(this.contenedor!.id).subscribe((r) => {
          this.contenedor = r.contenedor;
          this.campos = r.campos;
        });
      },
      error: () => this.notification.mostrar('No se pudo leer el archivo.'),
    });
    input.value = '';
  }
}
