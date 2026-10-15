import { fmt, pct } from '../../../core/utils/avance';
import { Desglose, LicenciasSlep, ModeloDashboard, Nivel, RankingLic, dias, nivelDe, rem } from '../../dashboard/modelo-dashboard';

// Gráficos del Informe de dashboard para Excel y PDF (imágenes): el lenguaje
// visual de los informes, con predominio de azules y grises. El rojo aparece
// solo cuando el avance de los sumarios es bajo (barra de avance).
const C = {
  navy: '#25306B', azul: '#1E4FA0', azul2: '#006BB9', celeste: '#3ABFF0', gris: '#94A3B8', pista: '#ECEFF4',
  texto: '#111827', texto2: '#46536A', texto3: '#76839A', linea: '#E3E7EE', rojo: '#D03B3B',
};
// Niveles de avance: alto, azul intenso; medio, celeste; bajo, rojo.
export const COLOR_NIVEL: Record<Nivel, string> = { alto: C.azul, medio: C.celeste, bajo: C.rojo, na: '#CBD5E1' };
const FUENTE = 'Arial, Helvetica, sans-serif';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const svg = (W: number, H: number, cuerpo: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FUENTE}"><rect width="${W}" height="${H}" fill="#fff"/>${cuerpo}</svg>`;
const txt = (x: number, y: number, t: string, o: { size?: number; color?: string; bold?: boolean; anchor?: string } = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.size ?? 13}" fill="${o.color ?? C.texto}"${o.bold ? ' font-weight="700"' : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${esc(t)}</text>`;
const corta = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export interface GraficoSvg { cap: string; svg: string; W: number; H: number }

// Barras horizontales: etiqueta a la izquierda, barra y su valor a la derecha.
function barras(filas: { label: string; ancho: number; color: string; valor: string; extra?: string; bold?: boolean }[], o: { W?: number; etiqueta?: number; alto?: number } = {}): { cuerpo: string; H: number } {
  const W = o.W ?? 900, ET = o.etiqueta ?? 300, AL = o.alto ?? 30, X0 = ET + 16, XV = W - 150, AN = XV - X0 - 14;
  let y = 8, cuerpo = '';
  for (const f of filas) {
    cuerpo += txt(ET, y + AL / 2 + 5, corta(f.label, 46), { anchor: 'end', size: 13, color: f.bold ? C.texto : C.texto2, bold: f.bold });
    cuerpo += `<rect x="${X0}" y="${y + 6}" width="${AN}" height="${AL - 12}" rx="3" fill="${C.pista}"/>`;
    cuerpo += `<rect x="${X0}" y="${y + 6}" width="${Math.max(0, Math.min(1, f.ancho)) * AN}" height="${AL - 12}" rx="3" fill="${f.color}"/>`;
    cuerpo += txt(XV, y + AL / 2 + 5, f.valor, { bold: true, size: 13 });
    if (f.extra) cuerpo += txt(W - 8, y + AL / 2 + 5, f.extra, { anchor: 'end', size: 12, color: C.texto3 });
    y += AL;
  }
  return { cuerpo, H: y + 8 };
}

function grafAvance(M: ModeloDashboard, ambito: string): GraficoSvg {
  const W = 900, H = 150, X0 = 20, AN = W - 40, col = M.av === null ? COLOR_NIVEL.na : COLOR_NIVEL[nivelDe(M.av)];
  let c = txt(X0, 30, 'AVANCE DE LOS SUMARIOS', { size: 12, bold: true, color: C.texto2 });
  c += txt(W - 20, 38, M.av === null ? '—' : pct(M.av), { size: 30, bold: true, color: M.av === null ? C.texto3 : col, anchor: 'end' });
  c += `<rect x="${X0}" y="56" width="${AN}" height="24" rx="5" fill="${C.pista}"/>`;
  if (M.av !== null) c += `<rect x="${X0}" y="56" width="${Math.max(0.01, Math.min(1, M.av)) * AN}" height="24" rx="5" fill="${col}"/>`;
  c += `<rect x="${X0 + AN - 3}" y="56" width="3" height="24" fill="${C.navy}"/>`;
  c += txt(X0, 98, '0 %', { size: 11, color: C.texto3 }) + txt(X0 + AN / 2, 98, '50 %', { size: 11, color: C.texto3, anchor: 'middle' }) + txt(X0 + AN, 98, 'Meta 100 %', { size: 11, color: C.texto3, anchor: 'end' });
  c += txt(X0, 128, `${fmt(M.cerrados)} procesos cerrados de ${fmt(M.instruidos)} sumarios instruidos · ${ambito}`, { size: 13, color: C.texto });
  return { cap: '% de avance de los sumarios (meta 100 %)', svg: svg(W, H, c), W, H };
}

// Dona: continúan en el servicio (azul) y ya no están (gris).
function grafDona(M: ModeloDashboard): GraficoSvg {
  const W = 900, H = 240, cx = 130, cy = 120, R = 100, r = 62, colores = [C.azul, C.gris];
  let c = '', ang = -Math.PI / 2;
  const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  M.dona.partes.forEach((x, i) => {
    if (!x.pct) return;
    if (x.pct >= 0.9999) {
      c += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${colores[i]}" stroke-width="${R - r}"/>`;
      return;
    }
    const a0 = ang, a1 = ang + x.pct * Math.PI * 2, g = a1 - a0 > Math.PI ? 1 : 0;
    ang = a1;
    c += `<path d="M${p(R, a0)} A${R},${R} 0 ${g} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${g} 0 ${p(r, a0)} Z" fill="${colores[i]}" stroke="#fff" stroke-width="2"/>`;
  });
  c += txt(cx, cy + 4, fmt(M.dona.total), { size: 24, bold: true, anchor: 'middle' }) + txt(cx, cy + 24, 'involucrados', { size: 12, color: C.texto3, anchor: 'middle' });
  M.dona.partes.forEach((x, i) => {
    const y = 95 + i * 44;
    c += `<rect x="290" y="${y - 13}" width="16" height="16" rx="3" fill="${colores[i]}"/>`;
    c += txt(316, y, x.label, { size: 14 }) + txt(760, y, fmt(x.valor), { size: 14, bold: true, anchor: 'end' }) + txt(860, y, pct(x.pct), { size: 13, color: C.texto3, anchor: 'end' });
  });
  return { cap: 'Situación de los funcionarios involucrados', svg: svg(W, H, c), W, H };
}

function grafLicencias(r: RankingLic): GraficoSvg {
  const filas = [...r.filas, ...(r.propia ? [r.propia] : [])];
  const b = barras(filas.map((f) => ({ label: `${f.pos}°  ${f.slep}`, ancho: f.ancho, color: f.propio ? C.navy : f.pos === 1 ? C.azul : '#8FB2F5', valor: r.unidad === '$' ? rem(f.valor) : `${fmt(f.valor)} días`, bold: f.propio })), { etiqueta: 260, alto: filas.length > 10 ? 22 : 30 });
  return { cap: r.titulo, svg: svg(900, b.H, b.cuerpo), W: 900, H: b.H };
}

function grafDesglose(d: Desglose, et: (id: string, l: string) => string): GraficoSvg {
  const b = barras(d.filas.map((x) => ({ label: x.label, ancho: Math.min(1, x.pct), color: x.color, valor: fmt(x.valor), extra: d.principal.valor ? pct(x.pct) : '' })), { etiqueta: 340 });
  const cab = txt(20, 26, `${et(d.principal.id, d.principal.label)}: ${fmt(d.principal.valor)}`, { size: 14, bold: true, color: C.navy });
  const H = b.H + 36;
  return { cap: d.titulo, svg: svg(900, H, cab + `<g transform="translate(0,36)">${b.cuerpo}</g>`), W: 900, H };
}

// Licencias de un solo SLEP: la línea de duración (mínima → promedio → máxima)
// y la remuneración promedio destacada. Azul y gris.
function grafLicenciasSlep(L: LicenciasSlep, et: (id: string, l: string) => string): GraficoSvg {
  const W = 900, H = 170, X0 = 40, AN = 560, max = L.maxima.valor || 1;
  const x = (v: number | null) => X0 + (v == null ? 0 : Math.min(1, v / max)) * AN;
  let c = txt(X0 - 10, 26, 'DURACIÓN DE LAS LICENCIAS (DÍAS)', { size: 12, bold: true, color: C.texto2 });
  c += `<rect x="${X0}" y="58" width="${AN}" height="6" rx="3" fill="${C.pista}"/>`;
  c += `<rect x="${x(L.minima.valor)}" y="57" width="${x(L.maxima.valor) - x(L.minima.valor)}" height="8" rx="4" fill="#8FB2F5"/>`;
  [L.minima, L.promedio, L.maxima].forEach((p, k) => {
    const cx = x(p.valor), prom = k === 1;
    c += `<circle cx="${cx}" cy="61" r="${prom ? 11 : 8}" fill="${prom ? C.azul : '#fff'}" stroke="${prom ? '#fff' : C.azul}" stroke-width="${prom ? 3 : 4}"/>`;
    const anchor = k === 0 ? 'start' : k === 2 ? 'end' : 'middle', tx = k === 0 ? X0 - 8 : k === 2 ? X0 + AN + 8 : cx;
    c += txt(tx, 104, et(p.id, p.label), { size: 12, color: C.texto3, anchor });
    c += txt(tx, 126, dias(p.valor), { size: 17, bold: true, color: prom ? C.azul : C.texto, anchor });
  });
  c += `<rect x="660" y="30" width="220" height="110" rx="10" fill="#EEF4FB" stroke="${C.azul}" stroke-width="1.5"/>`;
  c += txt(676, 58, corta(et(L.remuneracion.id, L.remuneracion.label), 30).toUpperCase(), { size: 11, bold: true, color: C.texto2 });
  c += txt(676, 96, rem(L.remuneracion.valor), { size: 26, bold: true, color: C.navy });
  c += txt(676, 122, L.remuneracion.nota, { size: 11, color: C.texto3 });
  return { cap: 'Duración de las licencias y remuneración promedio', svg: svg(W, H, c), W, H };
}

// Los gráficos de cada apartado del documento, por clave del apartado.
export function graficosDashboard(M: ModeloDashboard, o: { ambito: string; consolidado: boolean; et: (id: string, l: string) => string }): Record<string, GraficoSvg[]> {
  const g: Record<string, GraficoSvg[]> = {
    avance: [grafAvance(M, o.ambito)],
    involucrados: M.dona.total ? [grafDona(M)] : [],
  };
  if (M.licenciasSlep) g['lic-slep'] = [grafLicenciasSlep(M.licenciasSlep, o.et)];
  else for (const r of M.rankingsLic) g[`lic-${r.id}`] = r.filas.length ? [grafLicencias(r)] : [];
  for (const d of M.desgloses) g[`des-${d.clave}`] = [grafDesglose(d, o.et)];
  return g;
}
