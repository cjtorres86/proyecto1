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
import { environment } from '../../../../environments/environment';

interface MesConDatos { mes: string; anio: string }

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
    this.http.get<{ mes: string; anio: string }[]>(`${environment.apiUrl}/cases/meses-disponibles`).subscribe({
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
