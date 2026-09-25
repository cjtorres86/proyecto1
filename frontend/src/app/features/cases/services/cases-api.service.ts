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

  crearMes(mes: string, anio: string, formularioId: string): Observable<Contenedor[]> {
    return this.http.post<Contenedor[]>(`${environment.apiUrl}/cases/crear-mes`, { mes, anio, formularioId });
  }

  getContenedorConValores(id: string): Observable<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    return this.http.get<{ contenedor: Contenedor; campos: CampoConValor[] }>(`${environment.apiUrl}/cases/${id}`);
  }

  guardarValores(id: string, valores: Record<string, string>): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/cases/${id}/valores`, { valores });
  }

  importarArchivo(id: string, archivo: File): Observable<{ desconocidas: string[] }> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    return this.http.post<{ desconocidas: string[] }>(`${environment.apiUrl}/cases/${id}/importar`, formData);
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
}
