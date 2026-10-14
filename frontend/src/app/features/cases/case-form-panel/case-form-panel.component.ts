import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, fromEvent, filter, firstValueFrom } from 'rxjs';
import { CasesApiService } from '../services/cases-api.service';
import {
  CargarDatosData, CargarDatosDialogComponent, CargarDatosResultado, ConfirmarGuardarData, ConfirmarGuardarDialogComponent,
  OPCIONES_VIDRIO, ProblemasArchivoData, ProblemasArchivoDialogComponent,
} from '../dialogos/dialogos-datos';
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
    private readonly casesApi: CasesApiService,
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

  // Guardar: primero una ventana amable con el resumen (SLEP, mes y cuántos
  // campos cambian); se guarda solo con «Sí, guardar».
  guardar(): void {
    if (!this.contenedor || !this.puedeGuardar) return;
    const c = this.contenedor;
    this.dialog
      .open<ConfirmarGuardarDialogComponent, ConfirmarGuardarData, boolean>(ConfirmarGuardarDialogComponent, {
        ...OPCIONES_VIDRIO, width: '480px',
        data: { slep: c.slep, mes: c.mesConsolidado, anio: c.anioConsolidado, cambios: Object.keys(this.valoresEditados).length },
      })
      .afterClosed()
      .subscribe((si) => { if (si) this.guardarAhora(); });
  }

  private guardarAhora(): void {
    if (!this.contenedor) return;
    this.guardando = true;
    this.caseState.guardarValores(this.contenedor.id, this.valoresEditados).subscribe({
      // El formulario actualizado llega solo, por el flujo compartido.
      next: () => {
        this.guardando = false;
        this.notification.mostrar(`¡Listo! Los datos de ${this.contenedor?.slep ?? ''} quedaron guardados.`);
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
  // Cargar datos: busca el mes anterior con datos de este SLEP y abre la
  // ventana con las dos opciones (mes anterior o archivo Excel).
  abrirCargarDatos(): void {
    const c = this.contenedor;
    if (!c || this.mesCerrado || this.cargandoArchivo) return;
    this.cargandoArchivo = true;
    this.buscarMesAnterior(c).then((r) => {
      this.cargandoArchivo = false;
      this.dialog
        .open<CargarDatosDialogComponent, CargarDatosData, CargarDatosResultado>(CargarDatosDialogComponent, {
          ...OPCIONES_VIDRIO, width: '600px',
          data: { slep: c.slep, anterior: r.anterior ? { mes: r.anterior.mes, anio: r.anterior.anio, campos: Object.keys(r.valores).length } : null, motivo: r.motivo },
        })
        .afterClosed()
        .subscribe((elegido) => {
          if (elegido?.tipo === 'anterior' && r.anterior) this.aplicarValores(r.valores, `${r.anterior.mes} ${r.anterior.anio}`, 'mes');
          if (elegido?.tipo === 'archivo') this.cargarArchivo(elegido.archivo);
        });
    });
  }

  // El mes anterior (el último mes con datos antes de este) y lo que ese
  // SLEP guardó ahí. Solo los campos que se pueden editar en este formulario.
  private async buscarMesAnterior(c: Contenedor): Promise<{ anterior: { mes: string; anio: string } | null; valores: Record<string, string>; motivo: string }> {
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const clave = (m: { mes: string; anio: string }) => +m.anio * 12 + MESES.indexOf(m.mes);
    try {
      const meses = await firstValueFrom(this.casesApi.listarMesesDisponibles());
      const actual = clave({ mes: c.mesConsolidado, anio: c.anioConsolidado });
      const anterior = meses.filter((m) => MESES.includes(m.mes) && clave(m) < actual).sort((a, b) => clave(b) - clave(a))[0];
      if (!anterior) return { anterior: null, valores: {}, motivo: 'Este es el primer mes registrado: todavía no hay un mes anterior.' };
      const r = await firstValueFrom(this.casesApi.getTotalGeneral(anterior.mes, anterior.anio, c.slep));
      const editables = new Set(this.campos.filter((x) => this.esEditable(x)).map((x) => x.preguntaId));
      const valores: Record<string, string> = {};
      for (const campo of r.campos) if (editables.has(campo.preguntaId) && campo.valor !== '' && campo.valor != null) valores[campo.preguntaId] = String(campo.valor);
      if (!r.totalContenedores || !Object.keys(valores).length) return { anterior: null, valores: {}, motivo: `${c.slep} no tiene datos guardados en ${anterior.mes.toLowerCase()} ${anterior.anio}.` };
      return { anterior, valores, motivo: '' };
    } catch {
      return { anterior: null, valores: {}, motivo: 'No pudimos consultar el mes anterior. Inténtalo de nuevo en un momento.' };
    }
  }

  private cargarArchivo(archivo: File): void {
    if (!this.contenedor || this.mesCerrado) return;
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
            this.aplicarValores(valores, archivo.name, 'archivo');
          });
      },
      error: (err) => {
        this.cargandoArchivo = false;
        // Los problemas del archivo, explicados uno por uno (con cómo resolverlos).
        const problemas: ProblemasArchivoData['problemas'] | undefined = err.error?.problemas;
        if (problemas?.length) {
          this.dialog.open<ProblemasArchivoDialogComponent, ProblemasArchivoData>(ProblemasArchivoDialogComponent, {
            ...OPCIONES_VIDRIO, width: '620px', data: { nombreArchivo: archivo.name, problemas },
          });
          return;
        }
        this.notification.mostrar(err.error?.message ?? 'No se pudo leer el archivo.', 15000);
      },
    });
  }

  // Compara nombres de SLEP sin que importen tildes, mayúsculas ni espacios.
  private mismoNombre(a: string, b: string): boolean {
    const n = (t: string) => (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    return n(a) === n(b);
  }

  // Vuelca los valores (del Excel o del mes anterior) al formulario como
  // cambios pendientes (en naranjo): se registran recién al presionar "Guardar".
  private aplicarValores(valores: Record<string, string>, origen: string, tipo: 'archivo' | 'mes'): void {
    let aplicados = 0;
    for (const campo of this.campos) {
      const nuevo = valores[campo.preguntaId];
      if (nuevo === undefined || nuevo === campo.valor) continue;
      campo.valor = nuevo;
      this.valoresEditados[campo.preguntaId] = nuevo;
      aplicados++;
    }
    const de = tipo === 'mes' ? `de ${origen}` : `de "${origen}"`;
    this.notification.mostrar(
      aplicados
        ? `¡Listo! Cargamos ${aplicados} ${aplicados === 1 ? 'campo' : 'campos'} ${de}. Ajusta lo que haya cambiado y presiona Guardar cuando quieras.`
        : `Los datos ${de} son iguales a los que ya están en el formulario: no hay nada nuevo que cargar.`,
      8000,
    );
  }
}
