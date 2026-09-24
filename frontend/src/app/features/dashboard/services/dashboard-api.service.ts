import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardDeMes } from '../../../core/models/dashboard.model';

// Capa de datos pura (TDD, sección 13.12) — igual que CasesApiService,
// solo llamadas HTTP, sin estado propio.
@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  constructor(private readonly http: HttpClient) {}

  getDashboard(mes: string, anio: string, slep?: string): Observable<DashboardDeMes> {
    const params: Record<string, string> = { mes, anio };
    if (slep) params['slep'] = slep;
    return this.http.get<DashboardDeMes>(`${environment.apiUrl}/dashboard`, { params });
  }

  getDesglose(mes: string, anio: string, campo: string): Observable<{ slep: string; valor: number }[]> {
    return this.http.get<{ slep: string; valor: number }[]>(`${environment.apiUrl}/dashboard/desglose`, {
      params: { mes, anio, campo },
    });
  }

  getDesgloseDiferencia(mes: string, anio: string, tipo: string): Observable<{ slep: string; diferencia: number }[]> {
    return this.http.get<{ slep: string; diferencia: number }[]>(`${environment.apiUrl}/dashboard/desglose-diferencia`, {
      params: { mes, anio, tipo },
    });
  }

  getRanking(mes: string, anio: string): Observable<{ slep: string; pct: number | null }[]> {
    return this.http.get<{ slep: string; pct: number | null }[]>(`${environment.apiUrl}/dashboard/ranking`, { params: { mes, anio } });
  }
}
