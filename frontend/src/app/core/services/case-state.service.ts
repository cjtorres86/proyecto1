import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, map, tap } from 'rxjs';
import { Contenedor, MesActivo, CampoConValor } from '../models/case.model';
import { CasesApiService } from '../../features/cases/services/cases-api.service';

// Servicio de estado reactivo (TDD, sección 13.10) — reemplaza tanto al
// eventBus del PMV como a las llamadas manuales a _renderPanelSlep() /
// _renderPanelDerecho() tras cada cambio. Ningún componente "avisa" a
// otro que algo cambió: todos se suscriben a los mismos Observables
// derivados, y Angular los actualiza solo. Las llamadas HTTP en sí
// viven en CasesApiService — este servicio solo guarda el resultado.
@Injectable({ providedIn: 'root' })
export class CaseStateService {
  private readonly mesActivoSubject = new BehaviorSubject<MesActivo | null>(null);
  readonly mesActivo$ = this.mesActivoSubject.asObservable();

  private readonly contenedoresSubject = new BehaviorSubject<Contenedor[]>([]);
  readonly contenedores$ = this.contenedoresSubject.asObservable();

  private readonly slepActivoSubject = new BehaviorSubject<string | null>(null);
  readonly slepActivo$ = this.slepActivoSubject.asObservable();

  private readonly campoActivoSubject = new BehaviorSubject<string | null>(null);
  readonly campoActivo$ = this.campoActivoSubject.asObservable();

  // Panel Histórico (mejora post-v2.23): estado SEPARADO de slepActivo,
  // a propósito — Formulario y Dashboard siempre deben mostrar el
  // general al volver desde Histórico, sin importar cuántos SLEP haya
  // marcados ahí. Se guarda por NOMBRE de SLEP (no por id de
  // contenedor, que cambia cada mes) para que la marca sobreviva un
  // cambio de mes. "destacado" es el último marcado — el único que se
  // dibuja en color y encima del resto en el gráfico (los demás quedan
  // en gris), y el único cuya planilla detallada se muestra.
  private readonly slepsHistoricoSubject = new BehaviorSubject<Set<string>>(new Set());
  readonly slepsHistorico$ = this.slepsHistoricoSubject.asObservable();

  private readonly slepDestacadoHistoricoSubject = new BehaviorSubject<string | null>(null);
  readonly slepDestacadoHistorico$ = this.slepDestacadoHistoricoSubject.asObservable();

  readonly contenedorActivo$: Observable<Contenedor | null> = combineLatest([this.contenedores$, this.slepActivoSubject]).pipe(
    map(([contenedores, slepId]) => contenedores.find((c) => c.id === slepId) ?? null),
  );

  constructor(private readonly api: CasesApiService) {}

  setMesActivo(mes: MesActivo | null): void {
    this.mesActivoSubject.next(mes);
    this.slepActivoSubject.next(null);
    this.campoActivoSubject.next(null);
    if (mes) this.recargarContenedores(mes);
  }

  setSlepActivo(contenedorId: string | null): void {
    this.slepActivoSubject.next(contenedorId);
    this.campoActivoSubject.next(null);
  }

  setCampoActivo(preguntaId: string | null): void {
    this.campoActivoSubject.next(preguntaId);
  }

  // Marca/desmarca un SLEP en el panel Histórico (nombre, no id — ver
  // comentario arriba). Al marcar uno nuevo, pasa a ser el "destacado".
  // Al desmarcar el que ya era el destacado, nadie queda destacado
  // hasta que se marque otro — los demás SLEP que sigan marcados se
  // quedan en gris, sin planilla propia visible.
  toggleSlepHistorico(slep: string): void {
    const actuales = new Set(this.slepsHistoricoSubject.value);
    if (actuales.has(slep)) {
      actuales.delete(slep);
      if (this.slepDestacadoHistoricoSubject.value === slep) this.slepDestacadoHistoricoSubject.next(null);
    } else {
      actuales.add(slep);
      this.slepDestacadoHistoricoSubject.next(slep);
    }
    this.slepsHistoricoSubject.next(actuales);
  }

  recargarContenedores(mes: MesActivo): void {
    this.api.listarPorMes(mes.mes, mes.anio).subscribe((lista) => this.contenedoresSubject.next(lista));
  }

  crearMes(mes: string, anio: string, formularioId: string): Observable<Contenedor[]> {
    return this.api.crearMes(mes, anio, formularioId).pipe(tap(() => this.recargarContenedores({ mes, anio })));
  }

  getContenedorConValores(id: string): Observable<{ contenedor: Contenedor; campos: CampoConValor[] }> {
    return this.api.getContenedorConValores(id);
  }

  getTotalGeneral(mes: string, anio: string): Observable<{ totalContenedores: number; campos: CampoConValor[] }> {
    return this.api.getTotalGeneral(mes, anio);
  }

  guardarValores(id: string, valores: Record<string, string>): Observable<unknown> {
    return this.api.guardarValores(id, valores).pipe(
      tap(() => {
        const mes = this.mesActivoSubject.value;
        if (mes) this.recargarContenedores(mes);
      }),
    );
  }

  importarArchivo(id: string, archivo: File): Observable<{ desconocidas: string[] }> {
    return this.api.importarArchivo(id, archivo).pipe(
      tap(() => {
        const mes = this.mesActivoSubject.value;
        if (mes) this.recargarContenedores(mes);
      }),
    );
  }
}
