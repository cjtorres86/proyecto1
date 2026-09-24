import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { CasesApiService } from '../services/cases-api.service';
import { Formulario } from '../../../core/models/question.model';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Modal "Agregar Mes" (TDD, sección 7.9 y 13.9) — mes/año/formulario con
// menú desplegable, no texto libre (hallazgo del PMV, TDD v2.15). Crea
// la estructura vacía; nunca importa un archivo desde acá.
@Component({
  selector: 'app-agregar-mes-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule],
  templateUrl: './agregar-mes-dialog.component.html',
})
export class AgregarMesDialogComponent implements OnInit {
  readonly meses = MESES;
  readonly anios: string[];
  formularios: Formulario[] = [];
  readonly form;
  error: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<AgregarMesDialogComponent>,
    private readonly casesApi: CasesApiService,
  ) {
    const anioActual = new Date().getFullYear();
    this.anios = Array.from({ length: 4 }, (_, i) => String(anioActual - 1 + i));
    this.form = this.fb.group({
      mes: ['', Validators.required],
      anio: [String(anioActual), Validators.required],
      formularioId: ['seguimiento_disciplinario_37', Validators.required],
    });
  }

  ngOnInit(): void {
    this.casesApi.listarFormularios().subscribe((lista) => (this.formularios = lista));
  }

  get avisoPlantilla44(): boolean {
    return this.form.get('formularioId')?.value !== 'seguimiento_disciplinario_37';
  }

  confirmar(): void {
    if (this.form.invalid) return;
    this.error = null;
    this.dialogRef.close(this.form.getRawValue());
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
