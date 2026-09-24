import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { CaseStateService } from '../../../core/services/case-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WorkspaceModeService } from '../../../core/services/workspace-mode.service';
import { AgregarMesDialogComponent } from '../agregar-mes-dialog/agregar-mes-dialog.component';
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
export class MonthsPanelComponent implements OnInit {
  meses: MesConDatos[] = [];
  mesActivo: MesConDatos | null = null;

  constructor(
    private readonly caseState: CaseStateService,
    readonly authService: AuthService,
    private readonly dialog: MatDialog,
    private readonly notification: NotificationService,
    private readonly http: HttpClient,
    private readonly workspaceMode: WorkspaceModeService,
  ) {}

  ngOnInit(): void {
    this.caseState.mesActivo$.subscribe((m) => (this.mesActivo = m));
    this.cargarMesesDisponibles();
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
    const ref = this.dialog.open(AgregarMesDialogComponent, { width: '380px' });
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;
      this.caseState.crearMes(resultado.mes, resultado.anio, resultado.formularioId).subscribe({
        next: () => {
          this.notification.mostrar(`Mes ${resultado.mes} ${resultado.anio} creado, con sus 36 SLEP listos para cargar datos.`);
          this.cargarMesesDisponibles();
        },
        error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo crear el mes.'),
      });
    });
  }
}
