import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { UsersApiService } from '../services/users-api.service';
import { CasesApiService } from '../../cases/services/cases-api.service';
import { Perfil, Usuario } from '../../../core/models/user.model';

export interface DatosUserFormDialog {
  // Si viene, es edición de esta cuenta; si no, es una cuenta nueva.
  usuario?: Usuario;
}

// Crear una cuenta nueva, o editar/completar una existente (mejora
// post-v2.23) — un solo diálogo para los 2 casos:
//  - Nueva: usuario y contraseña obligatorios, como siempre.
//  - Editando una cuenta YA activa (usuario !== null): el nombre de
//    usuario queda fijo (no se puede renombrar por acá — ver
//    UsersService.actualizarUsuario); la contraseña es opcional, cambia
//    solo si se escribe algo.
//  - Editando una cuenta PENDIENTE (usuario === null, un SLEP registrado
//    de antemano): el nombre de usuario SÍ se puede escribir por primera
//    vez — al hacerlo, la contraseña pasa a ser obligatoria también (no
//    tendría sentido un usuario sin ninguna clave con la que entrar).
@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  templateUrl: './user-form-dialog.component.html',
})
export class UserFormDialogComponent implements OnInit {
  perfiles: Perfil[] = [];
  sleps: string[] = [];
  readonly form;
  readonly editando: boolean;
  // Cuenta pendiente (aún sin usuario) que se está completando ahora —
  // distinto de "editando una cuenta ya activa".
  readonly completandoPendiente: boolean;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<UserFormDialogComponent>,
    private readonly usersApi: UsersApiService,
    private readonly casesApi: CasesApiService,
    @Inject(MAT_DIALOG_DATA) public data: DatosUserFormDialog,
  ) {
    const u = data.usuario;
    this.editando = !!u;
    this.completandoPendiente = !!u && !u.usuario;

    this.form = this.fb.group({
      usuario: [u?.usuario ?? '', this.editando && !this.completandoPendiente ? [] : Validators.required],
      contrasena: ['', this.editando && !this.completandoPendiente ? [] : Validators.required],
      rut: [u?.rut ?? ''],
      nombreParaMostrar: [u?.nombreParaMostrar ?? '', Validators.required],
      alcance: [u?.alcance ?? 'todos', Validators.required],
      perfilId: [u?.perfil?.id ?? '', Validators.required],
    });
    // Cuenta ya activa: el nombre de usuario queda fijo, no se toca acá.
    if (this.editando && !this.completandoPendiente) this.form.controls.usuario.disable();
  }

  ngOnInit(): void {
    this.usersApi.listarPerfiles().subscribe((lista) => (this.perfiles = lista));
    this.casesApi.listarSlep().subscribe((lista) => (this.sleps = lista.map((s) => s.nombre)));
  }

  get faltaClaveParaUsuarioNuevo(): boolean {
    // Aviso en pantalla (no bloquea el botón; el backend igual lo exige):
    // si se está completando una pendiente y se escribió un usuario, hace
    // falta una contraseña también.
    return this.completandoPendiente && !!this.form.value.usuario && !this.form.value.contrasena;
  }

  confirmar(): void {
    if (this.form.invalid) return;
    const valores = this.form.getRawValue();
    // No mandar contrasena vacía al editar (el backend interpreta "no
    // vino" como "no cambiar la clave").
    if (this.editando && !valores.contrasena) delete (valores as Record<string, unknown>)['contrasena'];
    if (!valores.rut) delete (valores as Record<string, unknown>)['rut'];
    this.dialogRef.close(valores);
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
