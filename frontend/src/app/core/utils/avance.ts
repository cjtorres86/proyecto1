// Reglas del avance de sumarios en UN solo lugar (mismas del informe de
// avance): las usan el gráfico del Histórico, la tabla de avance por SLEP y
// el ranking, así nunca calculan ni pintan distinto.
//
// % de avance = procesos cerrados ÷ sumarios instruidos (igual que
// DashboardService.pctAvanceDe en el servidor). Niveles: bajo < 25 %,
// medio 25 % a < 75 %, alto ≥ 75 %.

// Registro mensual que entrega /cases/historico-detalle:
// [casos informados, involucrados, instruidos, en curso, resueltos,
//  impugnados, enviados CGR, cerrados, censura, multa, suspensión,
//  destitución, cerrados sin sanción]
export type RegistroAvance = number[];

export interface HistoricoDetalle {
  meses: { mes: string; anio: string }[];
  sleps: { slep: string; valores: (RegistroAvance | null)[] }[];
  alcanceCompleto: boolean;
  // Solo para quien ve un SLEP: su posición en el ranking de cada mes.
  posicion?: { pos: number | null; de: number }[];
}

export interface MetricasAvance {
  casos: number; inv: number; ins: number; curso: number; res: number; imp: number; env: number;
  cerr: number; cen: number; mul: number; sus: number; des: number; sin: number;
  san: number; av: number | null; pend: number; n: number;
}

export type NivelAvance = 'bajo' | 'medio' | 'alto' | 'na';
export const CORTE_BAJO = 0.25;
export const CORTE_ALTO = 0.75;
export const NIVEL_TXT: Record<NivelAvance, string> = { bajo: 'Avance bajo', medio: 'Avance medio', alto: 'Avance alto', na: 'Sin sumarios instruidos' };
export const COLOR_NIVEL: Record<NivelAvance, string> = { bajo: '#d03b3b', medio: '#b7791f', alto: '#0f69b4', na: '#9aa3b1' };

export function nivel(av: number | null): NivelAvance {
  return av === null ? 'na' : av < CORTE_BAJO ? 'bajo' : av < CORTE_ALTO ? 'medio' : 'alto';
}

export function metricas(r: RegistroAvance | null, n = 1): MetricasAvance | null {
  if (!r) return null;
  const [casos, inv, ins, curso, res, imp, env, cerr, cen, mul, sus, des, sin] = r;
  return { casos, inv, ins, curso, res, imp, env, cerr, cen, mul, sus, des, sin, san: cen + mul + sus + des,
    av: ins > 0 ? cerr / ins : null, pend: Math.max(ins - cerr, 0), n };
}

// Suma de varios SLEP en un mes (el "General"). null si ninguno informa.
export function sumar(regs: (RegistroAvance | null)[]): MetricasAvance | null {
  const rs = regs.filter((r): r is RegistroAvance => !!r);
  if (!rs.length) return null;
  return metricas(rs.reduce((a, r) => a.map((v, i) => v + r[i]), Array(13).fill(0)), rs.length);
}

// Ranking de un mes: posición por % de avance (empates: más cerrados, luego
// nombre) — el mismo criterio que usa el servidor para quien ve un SLEP.
export function ranking(sleps: HistoricoDetalle['sleps'], i: number) {
  const L = sleps
    .map((s) => ({ slep: s.slep, m: metricas(s.valores[i]) }))
    .filter((x): x is { slep: string; m: MetricasAvance } => !!x.m && x.m.av !== null)
    .sort((a, b) => b.m.av! - a.m.av! || b.m.cerr - a.m.cerr || a.slep.localeCompare(b.slep, 'es'));
  return { lista: L, pos: new Map(L.map((x, k) => [x.slep, k + 1])), total: L.length };
}

const NF = new Intl.NumberFormat('es-CL');
export const fmt = (v: number | null | undefined) => (v == null ? '—' : NF.format(Math.round(v)));
export const pct = (v: number | null | undefined) =>
  v == null ? '—' : (v * 100).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
export const pp = (v: number | null | undefined) =>
  v == null ? '—' : Math.abs(v) < 0.0005 ? '0,0 pp' : (v > 0 ? '+' : '−') + Math.abs(v * 100).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' pp';
export const fmtS = (v: number | null | undefined) => (v == null ? '—' : Math.round(v) === 0 ? '0' : (v > 0 ? '+' : '−') + NF.format(Math.abs(Math.round(v))));
export const MESES_CORTOS: Record<string, string> = { Enero: 'Ene', Febrero: 'Feb', Marzo: 'Mar', Abril: 'Abr', Mayo: 'May', Junio: 'Jun', Julio: 'Jul', Agosto: 'Ago', Septiembre: 'Sep', Octubre: 'Oct', Noviembre: 'Nov', Diciembre: 'Dic' };
export const escaparHtml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// Tooltip completo de un mes (mismo contenido que el informe): avance,
// nivel, lo que falta para la meta, posición en el ranking, los 5
// indicadores, otros estados y el desglose de sanciones.
export function tooltipMes(titulo: string, sub: string, m: MetricasAvance | null, ant: MetricasAvance | null, posicion?: { pos: number | null; de: number } | null, extra = ''): string {
  const fila = (a: string, b: string) => `<span class="r"><span>${a}</span><span>${b}</span></span>`;
  let h = `<span class="h">${escaparHtml(titulo)}<small>${escaparHtml(sub)}</small></span>`;
  if (!m) return h + `<span class="muted">Sin información para el mes.</span>` + extra;
  const nv = nivel(m.av);
  if (m.av !== null) {
    h += `<span class="r"><span class="big">${pct(m.av)}</span><span class="pill ${nv}">${NIVEL_TXT[nv]}</span></span>` +
      `<span class="mbar"><i style="width:${Math.min(m.av, 1) * 100}%;background:${COLOR_NIVEL[nv]}"></i></span>` +
      fila('Var. respecto del mes anterior', ant && ant.av !== null ? `<b>${pp(m.av - ant.av)}</b>` : '—') +
      fila('Falta para la meta (100 %)', `${pp(1 - m.av).replace('+', '')} · ${fmt(m.pend)} por cerrar`);
    if (posicion?.pos) h += fila('Posición en el ranking', `<b>${posicion.pos}°</b> de ${posicion.de}`);
  } else h += `<span class="muted">Sin sumarios instruidos: no hay avance que medir.</span>`;
  h += `<span class="sep"></span><span class="sec">Indicadores del proceso</span>` +
    fila('Casos informados CGR', fmt(m.casos)) +
    fila('1. Funcionarios involucrados', fmt(m.inv)) +
    fila('2. Sumarios instruidos', `${fmt(m.ins)}${m.inv ? ` <span class="muted">(${pct(m.ins / m.inv)})</span>` : ''}`) +
    fila('3. Procesos en curso', `${fmt(m.curso)}${m.ins ? ` <span class="muted">(${pct(m.curso / m.ins)})</span>` : ''}`) +
    fila('4. Procesos cerrados', `<b>${fmt(m.cerr)}</b>${ant ? ` <span class="muted">(${fmtS(m.cerr - ant.cerr)} en el mes)</span>` : ''}`) +
    fila('5. Sanciones aplicadas', `${fmt(m.san)}${m.cerr ? ` <span class="muted">(${pct(m.san / m.cerr)})</span>` : ''}`) +
    fila('Cerrados sin sanción', fmt(m.sin));
  if (m.res || m.imp || m.env) h += `<span class="sep"></span><span class="sec">Otros estados</span>` + fila('Resueltos', fmt(m.res)) + fila('Impugnados', fmt(m.imp)) + fila('Enviados a CGR', fmt(m.env));
  if (m.san) h += `<span class="sep"></span><span class="sec">Sanciones aplicadas</span>` + ([['Censura', m.cen], ['Multa', m.mul], ['Suspensión', m.sus], ['Destitución', m.des]] as [string, number][]).filter((x) => x[1]).map((x) => fila(x[0], fmt(x[1]))).join('');
  return h + extra;
}

// Estilos del tooltip (los usan el gráfico y la tabla).
export const ESTILOS_TOOLTIP = `
.tip{pointer-events:none;background:#fff;border:1px solid #d6dce5;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,.16);padding:10px 12px;font-size:12px;line-height:1.45;min-width:240px;max-width:300px;z-index:60;display:flex;flex-direction:column;gap:3px;color:#111827}
.tip .h{font-weight:700;font-size:13px;color:#1b4673}.tip .h small{display:block;font-weight:500;color:#76839a;font-size:11px}
.tip .r{display:flex;justify-content:space-between;gap:14px}.tip .r>span:first-child{color:#46536a}
.tip .sep{border-top:1px solid #e6e9ef;margin:4px 0 2px}.tip .sec{font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#76839a;font-weight:700;margin-top:2px}
.tip .big{font-size:18px;font-weight:700}.tip .muted{color:#76839a}
.tip .mbar{height:5px;border-radius:3px;background:#eceff4;overflow:hidden;margin:2px 0 3px}.tip .mbar i{display:block;height:100%}
.tip .pill{display:inline-flex;align-items:center;font-size:11px;font-weight:600;padding:1px 8px;border-radius:10px;white-space:nowrap}
.tip .pill.bajo{background:#fbe7e6;color:#d03b3b}.tip .pill.medio{background:#fbf1df;color:#b7791f}.tip .pill.alto{background:#e2eef9;color:#0f69b4}.tip .pill.na{background:#eceef2;color:#76839a}
:host-context(.dark) .tip{background:#172131;border-color:#2c3a52;color:#e8edf5}:host-context(.dark) .tip .h{color:#a9c8ee}
:host-context(.dark) .tip .r>span:first-child,:host-context(.dark) .tip .muted{color:#b3bfd2}:host-context(.dark) .tip .mbar{background:#1f2b3e}:host-context(.dark) .tip .sep{border-color:#243147}`;
