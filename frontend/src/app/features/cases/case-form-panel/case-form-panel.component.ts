import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, fromEvent, filter } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { MensajesService } from '../../../core/services/mensajes.service';
import { textoAutoria } from '../../../core/utils/autoria';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
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
    private readonly dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    // El formulario abierto sale del flujo COMPARTIDO de CaseStateService
    // (optimización de rendimiento): un solo pedido por formulario, que
    // también usa el Inspector de Campo, y al guardar llega ya actualizado
    // desde el servidor sin pedirlo de nuevo.
    this.subs.add(
      this.caseState.detalleActivo$.subscribe((detalle) => {
        const contenedorAnterior = this.contenedor?.id ?? null;
        this.esTotalGeneral = !!detalle && !detalle.contenedor;
        this.contenedor = detalle?.contenedor ?? null;
        this.campos = detalle?.campos ?? [];
        this.totalContenedores = detalle?.totalContenedores ?? 0;
        this.valoresEditados = {};
        // Contadores del chat: solo al cambiar de formulario (el Total
        // general no tiene chat), no después de cada guardado.
        const contenedorNuevo = this.contenedor?.id ?? null;
        if (contenedorNuevo !== contenedorAnterior) this.mensajes.cargarNoLeidos(contenedorNuevo);
      }),
    );
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
    return this.authService.puedeCargarDatos();
  }

  // Tooltip discreto de cada campo guardado: quién lo cargó y cuándo.
  // Un dato guardado sin autor registrado lo dice explícitamente, en vez de
  // no mostrar nada — así nunca pasa desapercibido.
  autoria(campo: CampoConValor): string {
    if (campo.cargadoPor) return 'Cargado por ' + textoAutoria(campo.cargadoPor);
    return campo.valor && !this.esTotalGeneral && !this.tieneCambio(campo) ? 'Sin registro de quién lo cargó' : '';
  }

  // Editar un mes cerrado: permiso "editar_mes_cerrado" (antes, solo el
  // Superadmin). Se administra en el portal, en Configuración → Perfiles.
  get esSuperadmin(): boolean {
    return this.authService.can('editar_mes_cerrado');
  }

  // Cargar un Excel: permiso "importar_excel" del perfil.
  get puedeImportarExcel(): boolean {
    return this.authService.can('importar_excel');
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
      // El formulario actualizado llega solo, por el flujo compartido.
      next: () => {
        this.guardando = false;
        this.notification.mostrar(`Datos guardados para ${this.contenedor?.slep ?? ''}.`);
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
      next: ({ valores, slepEnArchivo, nombreArchivo, slep }) => {
        this.cargandoArchivo = false;
        // Confirmación antes de cargar (mejora post-v2.23): ya no se exige
        // que el campo 3 del archivo coincida con el SLEP — quien carga ve
        // el nombre del archivo y lo que dice su campo 3, y decide.
        const coincide = this.mismoNombre(slepEnArchivo, slep);
        const data: ConfirmDialogData = {
          titulo: '¿Quieres cargar los datos de este archivo?',
          mensaje: coincide
            ? 'Revisa que sea el archivo correcto antes de cargarlo.'
            : 'Ojo: el campo 3 del archivo no dice el mismo SLEP del formulario. Revisa que sea el archivo correcto antes de cargarlo.',
          textoConfirmar: 'Cargar',
          detalles: [
            { etiqueta: 'Archivo', valor: nombreArchivo || archivo.name },
            { etiqueta: 'Campo 3 del archivo', valor: slepEnArchivo || '(vacío)', advertencia: !coincide },
            { etiqueta: 'Se cargará en', valor: slep },
          ],
        };
        this.dialog
          .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { width: '460px', data })
          .afterClosed()
          .subscribe((aceptado) => {
            if (!aceptado) {
              this.notification.mostrar('Carga cancelada: el formulario no cambió.');
              return;
            }
            this.aplicarValoresDelArchivo(valores, archivo.name);
          });
      },
      error: (err) => {
        this.cargandoArchivo = false;
        this.notification.mostrar(err.error?.message ?? 'No se pudo leer el archivo.', 15000);
      },
    });
  }

  // Compara nombres de SLEP sin que importen tildes, mayúsculas ni espacios.
  private mismoNombre(a: string, b: string): boolean {
    const n = (t: string) => (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    return n(a) === n(b);
  }

  // Vuelca los valores del Excel al formulario como cambios pendientes
  // (en naranjo): se registran recién al presionar "Guardar".
  private aplicarValoresDelArchivo(valores: Record<string, string>, nombreArchivo: string): void {
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
        ? `Datos de "${nombreArchivo}" cargados en el formulario (${aplicados} campos). Revísalos y presiona Guardar para registrarlos.`
        : `"${nombreArchivo}" tiene los mismos datos que ya están guardados: no hay cambios.`,
      7000,
    );
  }
}
