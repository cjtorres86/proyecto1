import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { UsersApiService } from '../services/users-api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Usuario } from '../../../core/models/user.model';
import { UserFormDialogComponent } from '../user-form-dialog/user-form-dialog.component';

// Gestión de usuarios (TDD, sección 11.2.1) — tabla con PrimeNG (sección
// 13.9): puede crecer bastante, y no necesita ordenarse/filtrar como un
// selector simple.
@Component({
  selector: 'app-user-config',
  standalone: true,
  imports: [CommonModule, TableModule, MatButtonModule],
  templateUrl: './user-config.component.html',
})
export class UserConfigComponent implements OnInit {
  usuarios: Usuario[] = [];

  constructor(
    private readonly usersApi: UsersApiService,
    private readonly dialog: MatDialog,
    private readonly notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.usersApi.listarUsuarios().subscribe((lista) => (this.usuarios = lista));
  }

  abrirNuevoUsuario(): void {
    const ref = this.dialog.open(UserFormDialogComponent, { width: '380px' });
    ref.afterClosed().subscribe((resultado) => {
      if (!resultado) return;
      this.usersApi.crearUsuario(resultado).subscribe({
        next: () => { this.notification.mostrar(`Usuario "${resultado.usuario}" creado.`); this.cargar(); },
        error: (err) => this.notification.mostrar(err.error?.message ?? 'No se pudo crear el usuario.'),
      });
    });
  }
}
