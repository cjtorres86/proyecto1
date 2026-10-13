import { ModoIntegracionService } from '../core/services/modo-integracion.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../shared/confirm-dialog/confirm-dialog.component';
import { environment } from '../../environments/environment';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
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
  imports: [CommonModule, RouterOutlet, RouterLink, ThemeToggleComponent],
  templateUrl: './layout.component.html',
  styles: [`
    /* Línea de la aplicación: seis tramos parejos de azules y grises (el
       portal usa los seis colores del logo; las aplicaciones, esta). Ningún
       tramo es del mismo navy del encabezado, para que se vean los seis. */
    .barra-aplicacion {
      height: 6px; /* igual que la línea del portal */
      background: linear-gradient(90deg,
        #1E4FA0 0 16.666%, #006BB9 0 33.333%, #3ABFF0 0 50%,
        #8FB2F5 0 66.666%, #94A3B8 0 83.333%, #CBD5E1 0);
    }
    /* Tipografía de títulos del portal (gobCL / Museo Sans si están
       instaladas; si no, la del sistema). Sin descargar nada de internet:
       las redes corporativas lo bloquean. */
    .fuente-marca {
      font-family: 'gobCL', 'Museo Sans', 'Segoe UI', system-ui, sans-serif;
    }
  `],
})
export class LayoutComponent implements OnInit {
  // Botón "Volver al portal" (ingreso único: todos entran por el portal).
  readonly urlPortal = environment.portalUrl;

  readonly mesActivo$;
  private slepActivoNombre: string | null = null;

  // Perfiles a los que se les esconde "Inicio" (mejora post-v2.23) —
  // siempre están ya en esa vista, así que sobra. Todo lo demás
  // (incluido Superadmin, que no tiene fila de perfil) sí lo ve.

  // "Inicio" sirve para volver de Usuarios, Perfiles o Bitácora: lo ve quien
  // puede entrar a alguna de ellas (el Superadmin, siempre).
  get mostrarInicio(): boolean {
    return ['ver_usuarios', 'ver_perfiles', 'ver_bitacora'].some((p) => this.authService.can(p));
  }

  // Aviso antes de entrar a Usuarios, Perfiles o Bitácora: según si Sumarios
  // está integrado al portal o funciona independiente.
  avisarAntesDeEntrar(e: Event, destino: 'usuarios' | 'perfiles' | 'bitacora'): void {
    e.preventDefault();
    const integrado = this.modo.integrado();
    const textos = {
      usuarios: integrado
        ? 'Estás en una copia de consulta. Las personas se administran en el portal GDP-SLEP Studio (Configuración → Usuarios y accesos), y los cambios que se hagan allá llegan aquí al instante. Aquí no se puede modificar nada.'
        : 'Avance de Sumarios está funcionando independiente del portal. Los cambios que hagas aquí no se reflejan en el portal. Cuando se vuelva a activar la integración, el portal vuelve a mandar, y los cambios que se hagan allá reemplazarán a los de aquí.',
      perfiles: integrado
        ? 'Estás en una copia de consulta. Los perfiles y sus permisos se administran en el portal GDP-SLEP Studio (Configuración → Perfiles), y los cambios que se hagan allá llegan aquí al instante. Aquí no se puede modificar nada.'
        : 'Avance de Sumarios está funcionando independiente del portal. Esta es la lista de perfiles de Sumarios, solo para consultar. Cuando se vuelva a activar la integración, el portal vuelve a mandar.',
      bitacora: integrado
        ? 'Esta es la bitácora propia de Avance de Sumarios. Todo lo que aparece aquí también llega a la Bitácora central del portal GDP-SLEP Studio (Configuración → Bitácora), que reúne además lo que pasa en el portal.'
        : 'Avance de Sumarios está funcionando independiente del portal. Esta es su bitácora propia. Lo que ocurra aquí se enviará a la Bitácora central del portal cada vez que el portal esté disponible.',
    };
    const titulos = { usuarios: 'Usuarios de Avance de Sumarios', perfiles: 'Perfiles de Avance de Sumarios', bitacora: 'Bitácora de Avance de Sumarios' };
    const data: ConfirmDialogData = {
      titulo: titulos[destino],
      mensaje: textos[destino],
      textoConfirmar: 'Entendido, continuar',
      detalles: [{ etiqueta: 'Modo', valor: integrado ? 'Integrado al portal' : 'Independiente del portal', advertencia: !integrado }],
    };
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { width: '480px', data })
      .afterClosed()
      .subscribe((seguir) => {
        if (seguir) this.router.navigateByUrl(`/${destino}`);
      });
  }

  constructor(
    readonly authService: AuthService,
    private readonly caseState: CaseStateService,
    private readonly dialog: MatDialog,
    private readonly router: Router,
    readonly modo: ModoIntegracionService,
  ) {
    this.mesActivo$ = this.caseState.mesActivo$;
    this.modo.cargar();
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
    // Ventana ancha (tres columnas) con acabado de vidrio: ver .dialogo-vidrio en styles.scss.
    this.dialog.open(DownloadModalComponent, {
      width: '1060px',
      maxWidth: '96vw',
      panelClass: 'dialogo-vidrio',
      backdropClass: 'fondo-dialogo-vidrio',
      data: { ...mes, slep: this.slepActivoNombre },
    });
  }
}
