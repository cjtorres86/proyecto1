import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeService } from '../../../core/services/theme.service';
import { HistoricoDetalle } from '../../../core/utils/avance';
import { INTERRUPTOR_TEMA, descargarHtml, documentoAutonomo, estilosDeLaPagina, jsonParaScript } from '../../../core/utils/guardar-html';
import { ThemeToggleComponent } from '../../../shared/theme-toggle/theme-toggle.component';
import { BitacoraApiService } from '../../bitacora/services/bitacora-api.service';
import { ReportsApiService } from '../services/reports-api.service';
import { generarDocumento } from '../documentos-informe';
import { OCULTOS_AL_GUARDAR } from '../informe-guardado';
import { ConfigRanking, MotorRanking, iniciarMotorRanking } from './motor-ranking';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Informe interactivo de ranking (/informe-ranking?mes=Agosto&anio=2026): el
// ranking de avance de los SLEP con el lenguaje del Informe interactivo
// nacional. Con &imprimir=1 es el Informe estático de ranking: la misma
// página, siempre en claro, que abre sola la ventana de impresión.
@Component({
  selector: 'app-informe-ranking',
  standalone: true,
  imports: [ThemeToggleComponent],
  templateUrl: './informe-ranking.component.html',
  styleUrls: ['../informe-interactivo.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class InformeRankingComponent implements OnInit, OnDestroy {
  estado: 'cargando' | 'listo' | 'error' | 'sin-permiso' = 'cargando';
  mensaje = '';
  imprimir = false;
  guardando = false;
  private motor?: MotorRanking;
  // Para "Guardar": la página antes de que el motor la llene y sus datos.
  private plantilla = '';
  private cfg?: ConfigRanking;
  private quitarClaroAlImprimir?: () => void;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
    private readonly ruta: ActivatedRoute,
    private readonly theme: ThemeService,
    private readonly reportsApi: ReportsApiService,
    private readonly bitacora: BitacoraApiService,
  ) {}

  private get nombre(): string {
    return this.imprimir ? 'Informe estático de ranking' : 'Informe interactivo de ranking';
  }

  async ngOnInit(): Promise<void> {
    const q = this.ruta.snapshot.queryParamMap;
    this.imprimir = q.get('imprimir') === '1';
    // El estático es un documento: siempre en claro. El interactivo respeta el
    // tema (y al imprimirlo, igual sale en claro).
    if (this.imprimir) this.theme.forzarClaroSinGuardar();
    else this.quitarClaroAlImprimir = this.theme.claroAlImprimir();
    const mesTxt = q.get('mes') ?? '';
    const anio = q.get('anio') ?? '';
    document.title = `${this.nombre}${mesTxt ? ` - ${mesTxt} ${anio}` : ''} · Avance de Sumarios`;
    if (!this.auth.can('exportar_informe')) {
      this.estado = 'sin-permiso';
      return;
    }
    try {
      const [detalle, logo] = await Promise.all([
        firstValueFrom(this.http.get<HistoricoDetalle>(`${environment.apiUrl}/cases/informe-avance`)),
        this.logoComoDataUrl(),
      ]);
      if (!detalle.meses.length) {
        this.estado = 'error';
        this.mensaje = 'Todavía no hay meses con información para el ranking.';
        return;
      }
      const u = this.auth.usuarioActual();
      const mesPedido = MESES.indexOf(mesTxt);
      const cfg: ConfigRanking = {
        ...this.adaptar(detalle),
        logo,
        usuario: { nombre: u?.nombreParaMostrar ?? '', perfil: u?.esSuperadmin ? 'Superadmin' : (u?.perfil?.nombre ?? '') },
        inicial: { anio: anio || undefined, mes: mesPedido >= 0 ? mesPedido : undefined, slep: q.get('slep') ?? undefined },
        detalle: {},
        imprimir: this.imprimir,
        alSalir: () => this.auth.logout(),
        pedirDetalle: (a, m) => this.pedirDetalle(a, m),
        documento: (modelo, formato) => generarDocumento(modelo, formato, logo),
      };
      this.estado = 'listo';
      this.cfg = cfg;
      // El motor necesita la página ya dibujada (y visible) para medirla.
      setTimeout(() => {
        this.plantilla = document.querySelector('.ia')?.outerHTML ?? '';
        this.motor = iniciarMotorRanking(cfg);
        if (this.imprimir) this.abrirImpresion();
        else this.bitacora.registrarEvento('informe_visto', `Vio el ${this.nombre} — ${mesTxt} ${anio}.`);
      });
    } catch {
      this.estado = 'error';
      this.mensaje = 'No se pudo cargar el ranking. Espera un minuto y vuelve a intentarlo.';
    }
  }

  // Del formato del servidor (meses seguidos) al del motor (por año, enero a
  // diciembre), igual que el informe nacional.
  private adaptar(d: HistoricoDetalle): Pick<ConfigRanking, 'fuente' | 'posiciones' | 'alcanceCompleto'> {
    const anios: ConfigRanking['fuente']['anios'] = {};
    const posiciones: ConfigRanking['posiciones'] = {};
    d.meses.forEach((m, k) => {
      const mi = MESES.indexOf(m.mes);
      if (mi < 0) return;
      anios[m.anio] ??= d.sleps.map(() => Array(12).fill(null));
      posiciones[m.anio] ??= Array(12).fill(null);
      d.sleps.forEach((s, i) => (anios[m.anio][i][mi] = s.valores[k] ? s.valores[k]!.slice(1) : null));
      posiciones[m.anio][mi] = d.posicion?.[k] ?? null;
    });
    return { fuente: { sleps: d.sleps.map((s) => s.slep), anios }, posiciones, alcanceCompleto: d.alcanceCompleto };
  }

  // Formulario completo de cada SLEP en un mes (para su detalle): lo mismo
  // que mostraba el ranking anterior al pasar el mouse.
  private async pedirDetalle(anio: string, mes: number): Promise<Record<string, [number, string, string][]>> {
    const lista = await firstValueFrom(this.reportsApi.getRankingDetalle(MESES[mes], anio));
    return Object.fromEntries(lista.map((f) => [f.slep, f.campos.map((c) => [c.numero, c.nombre, c.valor] as [number, string, string])]));
  }

  // Estático: espera las fuentes (Roboto cambia las alturas) y abre la
  // ventana de impresión una sola vez (recargar la pestaña no la reabre).
  private abrirImpresion(): void {
    const q = this.ruta.snapshot.queryParamMap;
    this.bitacora.registrarEvento('informe_pdf_descargado', `Descargó el PDF de ${this.nombre} — ${q.get('mes') ?? ''} ${q.get('anio') ?? ''}.`);
    document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => window.print())));
  }

  // Guardar: un .html que se abre sin el sistema y conserva lo interactivo
  // (filtros, orden, detalle de cada SLEP). Lleva el formulario de todos los
  // meses del año que se está mirando. Generar informe y Salir necesitan el
  // sistema, así que en el archivo guardado no aparecen.
  async guardar(): Promise<void> {
    if (!this.cfg || !this.plantilla || !this.motor || this.guardando) return;
    this.guardando = true;
    try {
      const anio = this.motor.anio();
      await Promise.all(this.motor.mesesDelAnio().filter((m) => this.cfg!.detalle[`${anio}-${m}`] === undefined).map(async (m) => {
        try {
          this.cfg!.detalle[`${anio}-${m}`] = await this.pedirDetalle(anio, m);
        } catch {
          this.cfg!.detalle[`${anio}-${m}`] = false;
        }
      }));
      const { alSalir: _, pedirDetalle: __, documento: ___, ...datos } = this.cfg;
      const estilos = estilosDeLaPagina() + '\n' + OCULTOS_AL_GUARDAR + INTERRUPTOR_TEMA.estilos;
      const script = `var CFG=${jsonParaScript({ ...datos, imprimir: false })};CFG.alSalir=function(){};
document.addEventListener('DOMContentLoaded',function(){(${iniciarMotorRanking.toString()})(CFG);});
${INTERRUPTOR_TEMA.script}`;
      const hoy = new Date().toLocaleDateString('es-CL');
      const nombre = 'Informe interactivo de ranking';
      const aviso = `<p style="margin:0;padding:6px 16px;background:#eef4fb;color:#25306B;font:12px Roboto,Arial,sans-serif">${nombre} · guardado el ${hoy} desde Avance de Sumarios. Los datos son los de ese momento.</p>`;
      descargarHtml(nombre, documentoAutonomo({
        titulo: nombre,
        estilos,
        cuerpo: INTERRUPTOR_TEMA.cuerpo + aviso + this.plantilla,
        script,
        claseHtml: this.theme.esOscuro ? 'dark' : undefined,
      }));
    } finally {
      this.guardando = false;
    }
  }

  private async logoComoDataUrl(): Promise<string> {
    const blob = await (await fetch('/logo-dep.png')).blob();
    return new Promise((ok, ko) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result));
      r.onerror = ko;
      r.readAsDataURL(blob);
    });
  }

  ngOnDestroy(): void {
    this.motor?.destruir();
    this.quitarClaroAlImprimir?.();
  }
}
