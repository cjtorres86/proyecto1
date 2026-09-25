import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatStepperModule } from '@angular/material/stepper';
import { MatListModule } from '@angular/material/list';
import { CasesApiService } from '../services/cases-api.service';
import { Formulario } from '../../../core/models/question.model';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export interface NuevoMes {
  mes: string;
  anio: string;
  sleps: string[];
  formularioId: string;
}

// Asistente "Crear mes" en 3 pasos (mejora post-v2.23), con el Stepper de
// Angular Material (lineal: no se avanza sin completar el paso actual):
//   1. Mes y año (menú desplegable, no texto libre — hallazgo del PMV).
//   2. SLEP: todos marcados; el usuario desmarca los que no correspondan
//      (mat-selection-list, que ya se integra con formularios reactivos).
//   3. Formulario, más "Cargar formulario nuevo" (visible, sin función
//      todavía).
// Solo crea la estructura vacía; nunca importa un archivo desde acá.
@Component({
  selector: 'app-agregar-mes-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatSelectModule, MatButtonModule,
    MatStepperModule, MatListModule,
  ],
  templateUrl: './agregar-mes-dialog.component.html',
})
export class AgregarMesDialogComponent implements OnInit {
  readonly meses = MESES;
  readonly anios: string[];
  formularios: Formulario[] = [];
  catalogoSleps: string[] = [];

  readonly pasoMes;
  readonly pasoSleps;
  readonly pasoFormulario;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<AgregarMesDialogComponent, NuevoMes | null>,
    private readonly casesApi: CasesApiService,
  ) {
    const anioActual = new Date().getFullYear();
    this.anios = Array.from({ length: 4 }, (_, i) => String(anioActual - 1 + i));
    this.pasoMes = this.fb.group({
      mes: ['', Validators.required],
      anio: [String(anioActual), Validators.required],
    });
    // Validators.required rechaza un arreglo vacío: al menos 1 SLEP.
    this.pasoSleps = this.fb.group({
      sleps: this.fb.control<string[]>([], Validators.required),
    });
    this.pasoFormulario = this.fb.group({
      formularioId: ['seguimiento_disciplinario_37', Validators.required],
    });
  }

  ngOnInit(): void {
    this.casesApi.listarFormularios().subscribe((lista) => (this.formularios = lista));
    this.casesApi.listarSlep().subscribe((lista) => {
      this.catalogoSleps = lista.map((s) => s.nombre);
      this.pasoSleps.controls.sleps.setValue([...this.catalogoSleps]);
    });
  }

  get cantidadMarcados(): number {
    return this.pasoSleps.controls.sleps.value?.length ?? 0;
  }

  get todosMarcados(): boolean {
    return this.catalogoSleps.length > 0 && this.cantidadMarcados === this.catalogoSleps.length;
  }

  alternarTodos(): void {
    this.pasoSleps.controls.sleps.setValue(this.todosMarcados ? [] : [...this.catalogoSleps]);
  }

  get avisoPlantilla44(): boolean {
    return this.pasoFormulario.controls.formularioId.value !== 'seguimiento_disciplinario_37';
  }

  crear(): void {
    if (this.pasoMes.invalid || this.pasoSleps.invalid || this.pasoFormulario.invalid) return;
    const { mes, anio } = this.pasoMes.getRawValue();
    this.dialogRef.close({
      mes: mes!,
      anio: anio!,
      sleps: this.pasoSleps.controls.sleps.value ?? [],
      formularioId: this.pasoFormulario.controls.formularioId.value!,
    });
  }

  cancelar(): void {
    this.dialogRef.close(null);
  }
}
