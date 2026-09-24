import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { UsersApiService } from '../services/users-api.service';
import { Perfil } from '../../../core/models/user.model';

// Crear un usuario nuevo (TDD, sección 11.2.1): un mismo perfil puede
// reutilizarse en cuantos usuarios haga falta — solo cambia el alcance.
@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  templateUrl: './user-form-dialog.component.html',
})
export class UserFormDialogComponent implements OnInit {
  perfiles: Perfil[] = [];
  readonly form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<UserFormDialogComponent>,
    private readonly usersApi: UsersApiService,
  ) {
    this.form = this.fb.group({
      usuario: ['', Validators.required],
      contrasena: ['', Validators.required],
      nombreParaMostrar: ['', Validators.required],
      alcance: ['todos', Validators.required],
      perfilId: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    this.usersApi.listarPerfiles().subscribe((lista) => (this.perfiles = lista));
  }

  confirmar(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.getRawValue());
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
