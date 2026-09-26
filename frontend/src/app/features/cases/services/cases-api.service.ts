import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Contenedor, CampoConValor, HistoricoSlep } from '../../../core/models/case.model';
import { Formulario } from '../../../core/models/question.model';

// Capa de datos pura (TDD, sección 13.12) — solo llamadas HTTP, sin
// estado propio. CaseStateService la consume y guarda el resultado en
// sus BehaviorSubject; ningún componente debería llamar a este servicio
// directamente (así queda un solo punto que sabe "cómo pedirle esto al
// backend", igual que MARAMARAMA en el PMV).
@Injectable({ providedIn: 'root' })
export class CasesApiService {
  constructor(private readonly http: HttpClient) {}

  listarPorMes(mes: string, anio: string): Observable<Contenedor[]> {
    return this.http.get<Contenedor[]>(`${environment.apiUrl}/cases`, { params: { mes, anio } });
  }

  crearMes(mes: string, anio: string, formularioId: string, sleps: string[]): Observable<Contenedor[]> {
    return this.http.post<Contenedor[]>(`${environment.apiUrl}/cases/crear-mes`, { mes, anio, formularioId, sleps });
  }

  // Catálogo de SLEP (endpoint ya existente, GET /forms/slep) — lo usa el
  // paso 2 del asistente "Crear mes".
  listarSlep(): Observable<{ nombre: string }[]> {
    return this.http.get<{ nombre: string }[]>(`${environment.apiUrl}/forms/slep`);
  }

  getContenedorConValores(id: string): Observable<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    return this.http.get<{ contenedor: Contenedor; campos: CampoConValor[] }>(`${environment.apiUrl}/cases/${id}`);
  }

  // Devuelve el formulario ya actualizado (con validaciones recalculadas).
  guardarValores(id: string, valores: Record<string, string>): Observable<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    return this.http.patch<{ contenedor: Contenedor; campos: CampoConValor[] }>(`${environment.apiUrl}/cases/${id}/valores`, { valores });
  }

  // Vista previa (mejora post-v2.23): valida el Excel y devuelve sus
  // valores SIN guardarlos; se registran con guardarValores().
  importarArchivo(id: string, archivo: File): Observable<{ valores: Record<string, string> }> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<{ valores: Record<string, string> }>(`${environment.apiUrl}/cases/${id}/importar`, formData);
  }

  cerrarMes(mes: string, anio: string): Observable<{ cerrados: number }> {
    return this.http.post<{ cerrados: number }>(`${environment.apiUrl}/cases/cerrar-mes`, { mes, anio });
  }

  // Exclusivo del superadmin — el backend también lo verifica.
  abrirMes(mes: string, anio: string): Observable<{ abiertos: number }> {
    return this.http.post<{ abiertos: number }>(`${environment.apiUrl}/cases/abrir-mes`, { mes, anio });
  }

  eliminarMes(mes: string, anio: string): Observable<{ eliminados: number }> {
    return this.http.post<{ eliminados: number }>(`${environment.apiUrl}/cases/eliminar-mes`, { mes, anio });
  }

  listarFormularios(): Observable<Formulario[]> {
    return this.http.get<Formulario[]>(`${environment.apiUrl}/forms/formularios`);
  }

  getHistorico(slep: string, mes: string, anio: string): Observable<HistoricoSlep> {
    return this.http.get<HistoricoSlep>(`${environment.apiUrl}/cases/historico`, { params: { slep, mes, anio } });
  }

  getTotalGeneral(mes: string, anio: string, slep?: string): Observable<{ totalContenedores: number; campos: CampoConValor[] }> {
    const params: Record<string, string> = { mes, anio };
    if (slep) params['slep'] = slep;
    return this.http.get<{ totalContenedores: number; campos: CampoConValor[] }>(`${environment.apiUrl}/cases/total-general`, { params });
  }

  getHistoricoAvance(mes: string, anio: string, slep?: string): Observable<{ mes: string; anio: string; pct: number | null }[]> {
    const params: Record<string, string> = { mes, anio };
    if (slep) params['slep'] = slep;
    return this.http.get<{ mes: string; anio: string; pct: number | null }[]>(`${environment.apiUrl}/cases/historico-avance`, { params });
  }

  getHistoricoAvanceTodos(mes: string, anio: string): Observable<{ sleps: string[]; filas: { mes: string; anio: string; valores: number[] }[] }> {
    return this.http.get<{ sleps: string[]; filas: { mes: string; anio: string; valores: number[] }[] }>(
      `${environment.apiUrl}/cases/historico-avance-todos`,
      { params: { mes, anio } },
    );
  }
}
