import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, combineLatest, forkJoin, switchMap, of, catchError } from 'rxjs';
import { CaseStateService } from '../../../core/services/case-state.service';
import { DashboardApiService } from '../services/dashboard-api.service';
import { DashboardDeMes } from '../../../core/models/dashboard.model';
import { ModeSwitcherComponent } from '../../../shared/mode-switcher/mode-switcher.component';
import { escaparHtml, fmt, pct } from '../../../core/utils/avance';
import { Cifra, Desglose, KpiLicencia, LicenciasSlep, kpisLicencias, ParteDona, RankingLic, armarDashboard, numeracion, rem } from '../modelo-dashboard';

export { NIVEL_DASH, PALETA } from '../modelo-dashboard';

// Dashboard por bloques, cada dato con su número de campo del Formulario. El
// cálculo (cifras, cápsulas y rankings) está en modelo-dashboard.ts, común con
// el Informe de dashboard; aquí solo se pide el mes y se muestra.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ModeSwitcherComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit, OnDestroy {
  datos: DashboardDeMes | null = null;
  slepActivo: string | null = null;
  mes = '';
  anio = '';
  readonly fmt = fmt;
  readonly pct = pct;
  readonly rem = rem;

  // 1 · Consolidado (campos 4 y 5 bajo el avance)
  av: number | null = null;
  instruidos = 0;
  cerrados = 0;
  frase = '';
  capsulasAvance: string[] = [];
  origen: Cifra[] = [];
  capsulasOrigen: string[] = [];
  // 2 · Involucrados (dona)
  dona: { partes: ParteDona[]; total: number } = { partes: [], total: 0 };
  capsulasInvolucrados: string[] = [];
  // Licencias, la última tarjeta (consolidado: rankings completos, todos los
  // SLEP, como en el informe; un solo SLEP: sus datos, campos 15 a 18)
  rankingsLic: RankingLic[] = [];
  licenciasSlep: LicenciasSlep | null = null;
  // 4, 5 y 6
  desgloses: Desglose[] = [];
  // 7 · Anexo (solo con el formulario de 44 campos)
  anexo: { id: string; label: string; valor: number | null }[] = [];

  // Casos informados y licencias médicas (campos 4 y 5), bajo el avance.
  get puntos(): Cifra[] {
    return this.origen.filter((c) => c.id === 'Q04' || c.id === 'Q05');
  }

  @ViewChild('tip', { static: true }) private tip!: ElementRef<HTMLDivElement>;
  private sub?: Subscription;
  private porSlep = new Map<string, { slep: string; valor: number }[]>();
  private tipActual = '';
  private num = numeracion(undefined);

  constructor(
    private readonly caseState: CaseStateService,
    private readonly dashboardApi: DashboardApiService,
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.caseState.mesActivo$, this.caseState.contenedorActivo$])
      .pipe(
        switchMap(([mes, contenedor]) => {
          this.slepActivo = contenedor?.slep ?? null;
          this.mes = mes?.mes ?? '';
          this.anio = mes?.anio ?? '';
          this.porSlep.clear();
          if (!mes) return of(null);
          // Los rankings de licencias (campos 17 y 18) comparan a todos los
          // SLEP: se piden junto con el Dashboard.
          const desglose = (campo: string) => this.dashboardApi.getDesglose(mes.mes, mes.anio, campo).pipe(catchError(() => of([])));
          return forkJoin({
            dash: this.dashboardApi.getDashboard(mes.mes, mes.anio, this.slepActivo ?? undefined),
            q21: desglose('Q21'),
            q22: desglose('Q22'),
          });
        }),
      )
      .subscribe((r) => {
        this.datos = r?.dash ?? null;
        if (!r) return;
        this.porSlep.set('Q21', r.q21);
        this.porSlep.set('Q22', r.q22);
        this.num = numeracion(r.dash.numeros);
        Object.assign(this, armarDashboard(r.dash, { slepActivo: this.slepActivo, mes: this.mes, anio: this.anio, porSlep: this.porSlep, licenciasCompletas: true }));
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // "27. Sumarios instruidos": el número tal como aparece en el Formulario.
  n(id: string): number | string {
    return this.num.n(id);
  }
  et(id: string, label: string): string {
    return this.num.et(id, label);
  }

  // Color del % de avance (la única parte con rojo): 0 % rojo intenso →
  // 50 % neutro → 100 % azul intenso, igual que el Histórico y el informe.
  colorAvance(a: number | null): string {
    if (a == null) return '#CBD5E1';
    const t = Math.min(Math.abs(a - 0.5) / 0.5, 1) * 85 + 15, col = a < 0.5 ? '#d03b3b' : '#0f69b4';
    return `color-mix(in oklab, ${col} ${t.toFixed(0)}%, #f0efec)`;
  }
  colorTextoAvance(a: number | null): string {
    return a == null ? '#76839a' : a < 0.5 ? '#c23434' : '#0f69b4';
  }

  // Número de cada tarjeta, igual que en los informes: Licencias va al final
  // (6, o 7 si hay Anexo); los números de campo del formulario no cambian.
  numero(clave: string): number {
    const orden: Record<string, number> = { involucrados: 2, cic: 3, proc: 4, san: 5, anexo: 6 };
    return orden[clave] ?? (this.anexo.length ? 7 : 6);
  }
  sinNumero(eyebrow: string): string {
    return eyebrow.replace(/^\d+ · /, '');
  }

  // Licencias de un solo SLEP como tarjetas KPI (calculadas una vez por SLEP).
  private kpis: { L: LicenciasSlep | null; k: KpiLicencia[] } = { L: null, k: [] };
  kpisLic(L: LicenciasSlep): KpiLicencia[] {
    if (this.kpis.L !== L) this.kpis = { L, k: kpisLicencias(L) };
    return this.kpis.k;
  }

  valorLic(r: RankingLic, v: number): string {
    return r.unidad === '$' ? rem(v) : `${fmt(v)} d`;
  }

  // ---------- Tooltip completo, con los 5 SLEP que más aportan ----------
  verTip(e: MouseEvent, id: string | null, label: string, valor: number | null, baseTxt = '', base?: number | null): void {
    const clave = `${id}|${label}`;
    this.tipActual = clave;
    const pintar = () => {
      let h = `<span class="h">${escaparHtml(label)}<small>${escaparHtml(this.slepActivo ?? `Todos los SLEP · ${this.mes} ${this.anio}`)}</small></span>`;
      h += `<span class="r"><span class="big">${fmt(valor)}</span>${base ? `<span class="muted">${pct((valor ?? 0) / base)} de ${escaparHtml(baseTxt.toLowerCase())}</span>` : ''}</span>`;
      if (id && !this.slepActivo) {
        const des = this.porSlep.get(id);
        h += `<span class="sep"></span><span class="sec">SLEP que más aportan</span>`;
        if (!des) h += `<span class="muted">Cargando…</span>`;
        else {
          const top = des.filter((x) => x.valor).sort((a, b) => b.valor - a.valor).slice(0, 5);
          const tot = des.reduce((a, x) => a + (x.valor || 0), 0);
          h += top.length ? top.map((x) => `<span class="r"><span>${escaparHtml(x.slep)}</span><span>${fmt(x.valor)}${tot ? ` <span class="muted">(${pct(x.valor / tot)})</span>` : ''}</span></span>`).join('') : `<span class="muted">Ningún SLEP informa este dato.</span>`;
        }
      }
      const tip = this.tip.nativeElement;
      tip.innerHTML = h;
      tip.hidden = false;
    };
    pintar();
    this.moverTip(e);
    if (id && !this.slepActivo && !this.porSlep.has(id)) {
      this.dashboardApi.getDesglose(this.mes, this.anio, id).subscribe((des) => {
        this.porSlep.set(id, des);
        if (this.tipActual === clave) pintar();
      });
    }
  }

  moverTip(e: MouseEvent): void {
    const tip = this.tip.nativeElement;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let lx = e.clientX + 16, ly = e.clientY + 16;
    if (lx + tw > innerWidth - 8) lx = e.clientX - tw - 16;
    if (ly + th > innerHeight - 8) ly = Math.max(8, e.clientY - th - 16);
    tip.style.left = lx + 'px';
    tip.style.top = ly + 'px';
  }

  ocultarTip(): void {
    this.tipActual = '';
    this.tip.nativeElement.hidden = true;
  }
}
