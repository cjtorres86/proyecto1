import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../core/services/auth.service';
import { CaseStateService } from '../core/services/case-state.service';
import { DownloadModalComponent } from '../features/reports/download-modal/download-modal.component';
import { ThemeToggleComponent } from '../shared/theme-toggle/theme-toggle.component';

// Hallazgo real (reportado directamente por el usuario, confirmado con
// CSS calculado real vía Puppeteer): mat-toolbar[color="primary"] y
// mat-flat-button[color="primary"] NO aplican el color de fondo en
// Angular Material 19 con el sistema de theming nuevo (mat.theme()) tal
// como se configuró — el resultado era texto blanco sobre fondo casi
// blanco (rgb(250,249,253)), literalmente invisible. Se dejó de depender
// de esa coloración automática y se aplica el color de marca real del
// PMV (--color-primary: #1E3A8A) explícito en cada componente. Los
// íconos de Material Icons (<mat-icon>) dependían de un CDN externo de
// Google Fonts, bloqueado en redes corporativas — se reemplazaron por
// PrimeIcons, que ya viaja empaquetado localmente sin CDN.
@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, MatToolbarModule, MatButtonModule, ThemeToggleComponent],
  templateUrl: './layout.component.html',
  styles: [`
    .boton-salir {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      border: none;
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.25s ease;
    }
    .boton-salir:hover, .boton-salir:focus-visible {
      background: rgba(239, 68, 68, 0.4);
      outline: none;
    }
    .boton-salir i {
      font-size: 14px;
      transition: transform 0.25s ease;
    }
    .boton-salir:hover i {
      transform: translateX(2px);
    }
  `],
})
export class LayoutComponent implements OnInit {
  readonly mesActivo$;
  private slepActivoNombre: string | null = null;

  constructor(
    readonly authService: AuthService,
    private readonly caseState: CaseStateService,
    private readonly dialog: MatDialog,
  ) {
    this.mesActivo$ = this.caseState.mesActivo$;
  }

  ngOnInit(): void {
    // Se guarda como propiedad simple (no async pipe) para poder leerlo
    // de inmediato al clickear el ícono de descarga — mismo patrón que
    // ya usan slep-panel y months-panel para sus propios toggles.
    this.caseState.contenedorActivo$.subscribe((c) => (this.slepActivoNombre = c?.slep ?? null));
  }

  cerrarSesion(): void {
    this.authService.logout();
  }

  abrirDescargas(mes: { mes: string; anio: string } | null): void {
    if (!mes) return;
    this.dialog.open(DownloadModalComponent, { width: '340px', data: { ...mes, slep: this.slepActivoNombre } });
  }
}
