import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, filter, fromEvent, interval, merge } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { CaseStateService } from '../../../core/services/case-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WorkspaceModeService } from '../../../core/services/workspace-mode.service';
import { AgregarMesDialogComponent, NuevoMes } from '../agregar-mes-dialog/agregar-mes-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { environment } from '../../../../environments/environment';

interface MesConDatos { mes: string; anio: string; cerrado?: boolean }

// Equivalente a _renderPanelMeses() del PMV — nunca llama a "repintar":
// simplemente lee/publica el mes activo en CaseStateService, y quien
// necesite reaccionar (panel SLEP, Dashboard) ya está suscrito.
@Component({
  selector: 'app-months-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './months-panel.component.html',
})
export class MonthsPanelComponent implements OnInit, OnDestroy {
  meses: MesConDatos[] = [];
  mesActivo: MesConDatos | null = null;
  private readonly subs = new Subscription();

  // Cada cuánto se revisa si alguien creó un mes nuevo (mejora post-v2.23).
  private static readonly REFRESCO_MS = 60_000;

  constructor(
    private readonly caseState: CaseStateService,
    readonly authService: AuthService,
    private readonly dialog: MatDialog,
    private readonly notification: NotificationService,
    private readonly http: HttpClient,
    private readonly workspaceMode: WorkspaceModeService,
  ) {}

  ngOnInit(): void {
    this.subs.add(this.caseState.mesActivo$.subscribe((m) => (this.mesActivo = m)));
    this.cargarMesesDisponibles();

    // "Todos los usuarios ven el mes nuevo" (mejora post-v2.23): la lista
    // se carga al entrar, así que alguien que ya estaba conectado no vería
    // un mes creado por otro usuario hasta recargar. Se vuelve a consultar
    // cada 60 segundos y cada vez que el usuario regresa a la pestaña del
    // sistema. Liviano: es una sola consulta chica, sin infraestructura
    // nueva. No toca el mes que el usuario tiene elegido.
    this.subs.add(
      merge(
        interval(MonthsPanelComponent.REFRESCO_MS),
        fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'visible')),
      ).subscribe(() => this.cargarMesesDisponibles()),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // Los meses disponibles se derivan de /cases (año actual conocido) —
  // en un backend con más historia se agregaría un endpoint dedicado;
  // por ahora alcanza con listar el mes que ya se sabe que existe.
  private cargarMesesDisponibles(): void {
    this.http.get<MesConDatos[]>(`${environment.apiUrl}/cases/meses-disponibles`).subscribe({
      next: (lista) => (this.meses = lista),
      error: () => (this.meses = []),
    });
  }

  // Elegir un mes NUEVO pasa a modo Formulario (mejora post-v2.23) —
  // re-clickear el mes ya activo sigue respetando el modo en que ya
  // estaba el usuario (comportamiento anterior, sin cambios).
  seleccionar(mes: MesConDatos): void {
    const yaActivo = this.mesActivo?.mes === mes.mes && this.mesActivo?.anio === mes.anio;
    if (yaActivo) {
      this.caseState.setSlepActivo(null);
    } else {
      this.caseState.setMesActivo(mes);
      this.workspaceMode.irA('formulario');
    }
  }

  // El mes elegido está cerrado (según la lista, que trae el estado).
  get mesActivoCerrado(): boolean {
    return !!this.mesActivo && !!this.meses.find((m) => this.esActivo(m))?.cerrado;
  }

  // Cerrar mes (mejora post-v2.23): Admin, Validador y superadmin.
  cerrarMesActivo(): void {
    const mes = this.mesActivo;
    if (!mes || this.mesActivoCerrado) return;
    this.confirmar({
      titulo: `Cerrar ${mes.mes} ${mes.anio}`,
      mensaje: 'Al cerrar el mes, nadie podrá ingresar ni modificar datos en ningún SLEP.',
      textoConfirmar: 'Cerrar mes',
    }, () =>
      this.caseState.cerrarMes(mes).subscribe({
        next: () => {
          this.notification.mostrar(`${mes.mes} ${mes.anio} quedó cerrado.`);
          this.cargarMesesDisponibles();
        },
        error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo cerrar el mes.', 6000),
      }),
    );
  }

  // Reabrir mes (mejora post-v2.23): exclusivo del superadmin, mismo
  // botón que "Cerrar mes" — cambia de texto y de acción según el
  // estado del mes elegido (ver esActivoCerrado más abajo).
  abrirMesActivo(): void {
    const mes = this.mesActivo;
    if (!mes || !this.mesActivoCerrado) return;
    this.confirmar({
      titulo: `Abrir ${mes.mes} ${mes.anio}`,
      mensaje: 'Se podrá volver a ingresar y modificar datos en este mes.',
      textoConfirmar: 'Abrir mes',
    }, () =>
      this.caseState.abrirMes(mes).subscribe({
        next: () => {
          this.notification.mostrar(`${mes.mes} ${mes.anio} quedó abierto de nuevo.`);
          this.cargarMesesDisponibles();
        },
        error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo abrir el mes.', 6000),
      }),
    );
  }

  // Eliminar mes (mejora post-v2.23): solo superadmin. Borrado lógico:
  // los datos quedan en la base de datos.
  eliminarMesActivo(): void {
    const mes = this.mesActivo;
    if (!mes) return;
    this.confirmar({
      titulo: `Eliminar ${mes.mes} ${mes.anio}`,
      mensaje:
        `El mes dejará de verse para todos los usuarios.\n` +
        'Los datos no se borran: quedan guardados en la base de datos.\n' +
        'Si vuelves a crear este mes, empezará vacío, sin tocar los datos anteriores.',
      textoConfirmar: 'Eliminar mes',
      peligroso: true,
    }, () =>
      this.caseState.eliminarMes(mes).subscribe({
        next: () => {
          this.notification.mostrar(`${mes.mes} ${mes.anio} fue eliminado de la vista. Sus datos siguen guardados.`, 5000);
          this.cargarMesesDisponibles();
        },
        error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo eliminar el mes.', 6000),
      }),
    );
  }

  private confirmar(data: ConfirmDialogData, alConfirmar: () => void): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { width: '440px', data })
      .afterClosed()
      .subscribe((confirmado) => {
        if (confirmado) alConfirmar();
      });
  }

  esActivo(mes: MesConDatos): boolean {
    return this.mesActivo?.mes === mes.mes && this.mesActivo?.anio === mes.anio;
  }

  abrirAgregarMes(): void {
    const ref = this.dialog.open<AgregarMesDialogComponent, void, NuevoMes | null>(AgregarMesDialogComponent, { width: '460px' });
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;
      this.caseState.crearMes(resultado.mes, resultado.anio, resultado.formularioId, resultado.sleps).subscribe({
        next: (creados) => {
          this.notification.mostrar(`Mes ${resultado.mes} ${resultado.anio} creado para ${creados.length} SLEP, listos para cargar datos.`);
          this.cargarMesesDisponibles();
        },
        error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo crear el mes.', 6000),
      });
    });
  }
}
