import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BitacoraApiService, RegistroBitacora } from '../services/bitacora-api.service';
import { UsersApiService } from '../../users/services/users-api.service';
import { Usuario } from '../../../core/models/user.model';

// Etiquetas legibles para cada "accion" (mejora post-v2.23) — la lista de
// tipos válidos vive en el backend (bitacora.decorator.ts); acá solo se
// traduce el código a algo que se lea bien, para el filtro y la tabla.
const ETIQUETAS_ACCION: Record<string, string | undefined> = {
  sesion_iniciada: 'Inició sesión',
  sesion_cerrada: 'Cerró sesión',
  formulario_visto: 'Vio un formulario',
  formulario_guardado: 'Guardó un formulario',
  excel_cargado: 'Cargó un Excel',
  excel_descargado: 'Descargó un Excel',
  informe_visto: 'Vio un Informe',
  informe_pdf_descargado: 'Descargó un PDF',
  mensaje_creado: 'Escribió en el chat',
  mensaje_editado: 'Editó un mensaje',
  mensaje_eliminado: 'Borró un mensaje',
  mensaje_reaccion: 'Reaccionó a un mensaje',
  mes_creado: 'Creó un mes',
  mes_cerrado: 'Cerró un mes',
  mes_abierto: 'Reabrió un mes',
  mes_eliminado: 'Eliminó un mes',
  usuario_creado: 'Creó un usuario',
  usuario_editado: 'Editó un usuario',
  perfil_creado: 'Creó un perfil',
  perfil_editado: 'Editó un perfil',
};

@Component({
  selector: 'app-bitacora',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './bitacora.component.html',
})
export class BitacoraComponent implements OnInit {
  readonly etiquetas = ETIQUETAS_ACCION;
  readonly opcionesAccion = Object.entries(ETIQUETAS_ACCION);

  usuarios: Usuario[] = [];
  filas: RegistroBitacora[] = [];
  total = 0;
  cargando = true;

  // Filtros — se aplican recién al presionar "Filtrar" (filtroAplicado),
  // no en cada tecla: evita disparar un pedido al servidor por cada letra.
  filtroUsuarioId = '';
  filtroAccion = '';
  filtroDesde = '';
  filtroHasta = '';
  filtroTexto = '';

  pagina = 1;
  readonly porPagina = 50;

  constructor(
    private readonly bitacoraApi: BitacoraApiService,
    private readonly usersApi: UsersApiService,
  ) {}

  ngOnInit(): void {
    this.usersApi.listarUsuarios().subscribe((lista) => (this.usuarios = lista));
    this.cargar();
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.total / this.porPagina));
  }

  filtrar(): void {
    this.pagina = 1;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroUsuarioId = '';
    this.filtroAccion = '';
    this.filtroDesde = '';
    this.filtroHasta = '';
    this.filtroTexto = '';
    this.filtrar();
  }

  irAPagina(nueva: number): void {
    if (nueva < 1 || nueva > this.totalPaginas) return;
    this.pagina = nueva;
    this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    this.bitacoraApi
      .listar({
        usuarioId: this.filtroUsuarioId || undefined,
        accion: this.filtroAccion || undefined,
        desde: this.filtroDesde || undefined,
        hasta: this.filtroHasta || undefined,
        texto: this.filtroTexto || undefined,
        pagina: this.pagina,
        porPagina: this.porPagina,
      })
      .subscribe({
        next: (r) => {
          this.filas = r.filas;
          this.total = r.total;
          this.cargando = false;
        },
        error: () => (this.cargando = false),
      });
  }
}
