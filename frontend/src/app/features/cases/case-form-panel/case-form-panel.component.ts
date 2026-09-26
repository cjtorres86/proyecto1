import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest, switchMap, of, map, fromEvent, filter } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MensajesService } from '../../../core/services/mensajes.service';
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
  imports: [CommonModule, FormsModule],
  templateUrl: './case-form-panel.component.html',
  // Burbuja de mensajes sin leer (chat por campo): roja, con un rebote
  // corto al aparecer, estilo notificación de red social.
  styles: [`
    .insignia-no-leidos {
      min-width: 17px; height: 17px; padding: 0 5px; flex-shrink: 0;
      border-radius: 999px; background: #EF4444; color: #fff;
      font-size: 10px; font-weight: 700; line-height: 1;
      display: inline-flex; align-items: center; justify-content: center;
      box-shadow: 0 1px 3px rgba(239, 68, 68, 0.45);
      animation: insignia-entrada 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes insignia-entrada { from { transform: scale(0); } to { transform: scale(1); } }
  `],
})
export class CaseFormPanelComponent implements OnInit, OnDestroy {
  contenedor: Contenedor | null = null;
  campos: CampoConValor[] = [];
  valoresEditados: Record<string, string> = {};
  guardando = false;
  cargandoArchivo = false;
  esTotalGeneral = false;
  totalContenedores = 0;
  campoActivoId: string | null = null;
  // Mensajes sin leer por campo (chat por campo) del formulario abierto.
  noLeidos: Record<string, number> = {};
  private readonly subs = new Subscription();

  constructor(
    private readonly caseState: CaseStateService,
    readonly authService: AuthService,
    private readonly notification: NotificationService,
    private readonly mensajes: MensajesService,
  ) {}

  ngOnInit(): void {
    this.subs.add(combineLatest([this.caseState.mesActivo$, this.caseState.slepActivo$])
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
        // Contadores del chat de ESTE formulario (el Total general no tiene chat).
        this.mensajes.cargarNoLeidos(this.contenedor?.id ?? null);
      }));
    // Resalta la fila del campo activo (mejora post-v2.23) — antes solo
    // el Inspector de Campo reaccionaba a esto, el Formulario no mostraba
    // ningún indicador visual de cuál fila estaba seleccionada.
    this.subs.add(this.caseState.campoActivo$.subscribe((id) => (this.campoActivoId = id)));
    this.subs.add(this.mensajes.noLeidos$.subscribe((conteos) => (this.noLeidos = conteos)));
    // El chat no es en vivo: los contadores se refrescan al volver a la
    // pestaña del sistema, para ver lo que otros escribieron mientras tanto.
    this.subs.add(
      fromEvent(document, 'visibilitychange')
        .pipe(filter(() => document.visibilityState === 'visible' && !!this.contenedor))
        .subscribe(() => this.mensajes.cargarNoLeidos(this.contenedor!.id)),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get puedeEditar(): boolean {
    return this.authService.can('editar_formulario');
  }

  get esSuperadmin(): boolean {
    return !!this.authService.usuarioActual()?.esSuperadmin;
  }

  // Mes cerrado (mejora post-v2.23): nadie modifica, salvo el superadmin.
  // El backend también lo rechaza; esto solo evita que se intente.
  get mesCerrado(): boolean {
    return !!this.contenedor?.cerradoEn && !this.esSuperadmin;
  }

  get hayCambios(): boolean {
    return Object.keys(this.valoresEditados).length > 0;
  }

  // Guardar solo se activa con cambios pendientes (escritos a mano o
  // traídos desde "Cargar datos") y en un mes que se pueda modificar.
  get puedeGuardar(): boolean {
    return this.hayCambios && !this.mesCerrado && !this.guardando;
  }

  tieneCambio(campo: CampoConValor): boolean {
    return campo.preguntaId in this.valoresEditados;
  }

  esEditable(campo: CampoConValor): boolean {
    return !this.esTotalGeneral && this.puedeEditar && !this.mesCerrado && (campo.tipo === 'number' || campo.tipo === 'money');
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
      error: (err) => {
        this.guardando = false;
        // Ej.: el mes se cerró mientras se editaba — el backend explica por qué.
        this.notification.mostrar(err.error?.message ?? 'No se pudieron guardar los datos.', 7000);
      },
    });
  }

  // Cargar datos (mejora post-v2.23): el backend valida el Excel completo
  // y devuelve sus valores SIN guardarlos. Aquí se vuelcan al formulario
  // como cambios pendientes (marcados en naranjo) para que el Digitador
  // los revise; quedan registrados recién al presionar "Guardar". Si el
  // archivo no cumple el formato, el mensaje del backend dice exactamente
  // qué falló y el formulario no cambia.
  onArchivoSeleccionado(event: Event): void {
    if (!this.contenedor || this.mesCerrado) return;
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.cargandoArchivo = true;
    this.caseState.importarArchivo(this.contenedor.id, archivo).subscribe({
      next: ({ valores }) => {
        this.cargandoArchivo = false;
        let aplicados = 0;
        for (const campo of this.campos) {
          const nuevo = valores[campo.preguntaId];
          if (nuevo === undefined || nuevo === campo.valor) continue;
          campo.valor = nuevo;
          this.valoresEditados[campo.preguntaId] = nuevo;
          aplicados++;
        }
        this.notification.mostrar(
          aplicados
            ? `Datos de "${archivo.name}" cargados en el formulario (${aplicados} campos). Revísalos y presiona Guardar para registrarlos.`
            : `"${archivo.name}" tiene los mismos datos que ya están guardados: no hay cambios.`,
          7000,
        );
      },
      error: (err) => {
        this.cargandoArchivo = false;
        this.notification.mostrar(err.error?.message ?? 'No se pudo leer el archivo.', 15000);
      },
    });
  }
}
