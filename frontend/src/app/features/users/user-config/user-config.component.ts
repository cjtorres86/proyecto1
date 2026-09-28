import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { UsersApiService } from '../services/users-api.service';
import { NotificationService } from '../../../core/services/notification.service';
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
  ) {}

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
