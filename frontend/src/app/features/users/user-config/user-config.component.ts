import { ModoIntegracionService } from '../../../core/services/modo-integracion.service';
import { environment } from '../../../../environments/environment';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { UsersApiService } from '../services/users-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/auth.service';
import { Perfil, Usuario } from '../../../core/models/user.model';
import { UserFormDialogComponent } from '../user-form-dialog/user-form-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/confirm-dialog/confirm-dialog.component';

type Estado = 'activo' | 'inactivo' | 'pendiente';

// Pantalla de Usuarios (mejora post-v2.23): mismo estilo que la
// Bitácora — filtros arriba, tabla limpia abajo. La lista completa (hoy,
// ~40 cuentas) se trae de una sola vez; los filtros se aplican en el
// navegador, sin volver a pedirle nada al servidor — a diferencia de la
// Bitácora, que sí puede crecer mucho y por eso pagina contra el
// servidor.
@Component({
  selector: 'app-user-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule],
  templateUrl: './user-config.component.html',
})
export class UserConfigComponent implements OnInit {
  todos: Usuario[] = [];
  filas: Usuario[] = [];
  perfiles: Perfil[] = [];
  cargando = true;

  filtroPerfilId = '';
  filtroAlcance = '';
  filtroEstado: Estado | '' = '';
  filtroTexto = '';

  constructor(
    private readonly usersApi: UsersApiService,
    private readonly dialog: MatDialog,
    private readonly notification: NotificationService,
    private readonly authService: AuthService,
    readonly modo: ModoIntegracionService,
  ) {}

  // Permiso de cargar datos (mejora post-v2.23). Superadmin y Digitador
  // siempre pueden (no se cambia); a un Admin solo se lo cambia el
  // Superadmin; a un Validador, un Admin o el Superadmin. El backend
  // vuelve a verificar todo esto — acá solo se decide qué se muestra.
  cargaFija(u: Usuario): boolean {
    return u.esSuperadmin || u.perfil?.id === 'perfil_digitador';
  }

  // Ingreso único: las personas se administran en el portal; esta pantalla
  // es solo de consulta.
  readonly urlUsuariosPortal = `${environment.portalUrl}/configuracion/usuarios`;

  // Crear y editar personas aquí: solo en modo independiente (integración
  // desactivada) y solo el Superadmin ("gestionar_usuarios"). Integrado, todo
  // se hace en el portal y esta lista es de consulta.
  get puedeEditar(): boolean {
    return !this.modo.integrado() && this.authService.can('gestionar_usuarios');
  }

  puedeCambiarCarga(u: Usuario): boolean {
    if (!this.puedeEditar) return false; // integrado: se cambia en el portal
    if (!u.usuario || this.cargaFija(u)) return false;
    const yo = this.authService.usuarioActual();
    if (u.perfil?.id === 'perfil_admin') return !!yo?.esSuperadmin;
    return true;
  }

  cambiarCarga(u: Usuario): void {
    const permitir = !u.puedeCargarDatos;
    const data: ConfirmDialogData = {
      titulo: permitir ? `Permitir cargar datos a ${u.nombreParaMostrar}` : `Quitar el permiso de cargar datos a ${u.nombreParaMostrar}`,
      mensaje: permitir
        ? 'Podrá escribir valores y cargar archivos Excel en los formularios de su alcance.'
        : 'Ya no podrá guardar datos. Si tiene la sesión abierta, el bloqueo se aplica en su próximo intento de guardar.',
      textoConfirmar: permitir ? 'Permitir' : 'Quitar permiso',
      peligroso: !permitir,
    };
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { width: '420px', data })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        const accion = permitir ? this.usersApi.permitirCarga(u.id) : this.usersApi.quitarCarga(u.id);
        accion.subscribe({
          next: () => { this.notification.mostrar(permitir ? 'Ahora puede cargar datos.' : 'Permiso de cargar datos quitado.'); this.cargar(); },
          error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo cambiar el permiso.', 6000),
        });
      });
  }

  ngOnInit(): void {
    this.usersApi.listarPerfiles().subscribe((lista) => (this.perfiles = lista));
    this.cargar();
  }

  // Los alcance reales presentes hoy (SLEP con cuenta, más "todos" si
  // corresponde) — así el filtro de SLEP solo ofrece opciones que de
  // verdad existen, no los 36 sueltos sin relación a esto.
  get alcancesDisponibles(): string[] {
    return [...new Set(this.todos.map((u) => u.alcance))].sort((a, b) => a.localeCompare(b));
  }

  estadoDe(u: Usuario): Estado {
    if (!u.usuario) return 'pendiente';
    return u.activo ? 'activo' : 'inactivo';
  }

  filtrar(): void {
    const texto = this.filtroTexto.trim().toLowerCase();
    this.filas = this.todos.filter((u) => {
      if (this.filtroPerfilId && u.perfil?.id !== this.filtroPerfilId) return false;
      if (this.filtroAlcance && u.alcance !== this.filtroAlcance) return false;
      if (this.filtroEstado && this.estadoDe(u) !== this.filtroEstado) return false;
      if (texto) {
        const enTexto = [u.nombreParaMostrar, u.usuario ?? '', u.rut ?? ''].join(' ').toLowerCase();
        if (!enTexto.includes(texto)) return false;
      }
      return true;
    });
  }

  limpiarFiltros(): void {
    this.filtroPerfilId = '';
    this.filtroAlcance = '';
    this.filtroEstado = '';
    this.filtroTexto = '';
    this.filtrar();
  }

  abrirNuevoUsuario(): void {
    this.abrirDialogo({});
  }

  editar(u: Usuario): void {
    this.abrirDialogo({ usuario: u });
  }

  private abrirDialogo(data: { usuario?: Usuario }): void {
    const ref = this.dialog.open(UserFormDialogComponent, { width: '420px', data });
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;
      const accion = data.usuario
        ? this.usersApi.actualizarUsuario(data.usuario.id, resultado)
        : this.usersApi.crearUsuario(resultado);
      accion.subscribe({
        next: () => {
          this.notification.mostrar(data.usuario ? 'Cuenta actualizada.' : `Usuario "${resultado.usuario}" creado.`);
          this.cargar();
        },
        error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo guardar.', 6000),
      });
    });
  }

  cambiarActivo(u: Usuario): void {
    const activar = !u.activo;
    const data: ConfirmDialogData = {
      titulo: activar ? `Activar a ${u.nombreParaMostrar}` : `Desactivar a ${u.nombreParaMostrar}`,
      mensaje: activar
        ? 'Podrá volver a iniciar sesión con su usuario y contraseña.'
        : 'No podrá iniciar sesión mientras esté desactivada, aunque use la contraseña correcta. Nada de su historial se borra.',
      textoConfirmar: activar ? 'Activar' : 'Desactivar',
      peligroso: !activar,
    };
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, { width: '420px', data })
      .afterClosed()
      .subscribe((confirmado) => {
        if (!confirmado) return;
        const accion = activar ? this.usersApi.activarUsuario(u.id) : this.usersApi.desactivarUsuario(u.id);
        accion.subscribe({
          next: () => { this.notification.mostrar(activar ? 'Cuenta activada.' : 'Cuenta desactivada.'); this.cargar(); },
          error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo cambiar el estado.', 6000),
        });
      });
  }

  private cargar(): void {
    this.cargando = true;
    this.usersApi.listarUsuarios().subscribe({
      next: (lista) => {
        this.todos = lista;
        this.filtrar();
        this.cargando = false;
      },
      error: () => (this.cargando = false),
    });
  }
}
