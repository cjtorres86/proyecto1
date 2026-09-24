import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { AuthService } from '../../../core/services/auth.service';
import { UsersApiService } from '../services/users-api.service';
import { Perfil } from '../../../core/models/user.model';

// Gestión de perfiles (TDD, sección 11.2.1) — exclusiva del
// superadmin; ya la controla el backend, esto solo oculta la sección
// para quien no la puede usar.
@Component({
  selector: 'app-profile-config',
  standalone: true,
  imports: [CommonModule, TableModule],
  templateUrl: './profile-config.component.html',
})
export class ProfileConfigComponent implements OnInit {
  perfiles: Perfil[] = [];

  constructor(
    readonly authService: AuthService,
    private readonly usersApi: UsersApiService,
  ) {}

  ngOnInit(): void {
    this.usersApi.listarPerfiles().subscribe((lista) => (this.perfiles = lista));
  }
}
