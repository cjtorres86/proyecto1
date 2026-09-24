import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { WorkspaceModeService } from '../../../core/services/workspace-mode.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly form;
  cargando = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly notification: NotificationService,
    private readonly workspaceMode: WorkspaceModeService,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      usuario: ['', Validators.required],
      contrasena: ['', Validators.required],
    });
  }

  enviar(): void {
    if (this.form.invalid) return;
    this.cargando = true;
    const { usuario, contrasena } = this.form.getRawValue();
    this.authService.login(usuario!, contrasena!).subscribe({
      next: (res) => {
        this.workspaceMode.fijarModoPorDefecto(res.usuario);
        this.notification.mostrar(`¡Hola ${usuario}! Ponte casco y cinturón de seguridad, ¡aquí vamos!`);
        this.router.navigate(['/']);
      },
      error: () => {
        this.cargando = false;
        this.notification.mostrar('Usuario o contraseña incorrectos.');
      },
    });
  }
}
