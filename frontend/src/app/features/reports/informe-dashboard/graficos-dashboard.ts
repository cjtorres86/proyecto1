import { fmt, pct } from '../../../core/utils/avance';
import { Desglose, ModeloDashboard, Nivel, RankingLic, nivelDe, rem } from '../../dashboard/modelo-dashboard';

// Gráficos del Informe de dashboard para Excel y PDF (imágenes): el lenguaje
// visual de los informes, con predominio de azules y grises. El rojo aparece
// solo cuando el avance de los sumarios es bajo (barra de avance y ranking).
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

function grafOrigen(M: ModeloDashboard, et: (id: string, l: string) => string): GraficoSvg {
  const max = Math.max(1, ...M.origen.map((c) => c.valor ?? 0));
  const b = barras(M.origen.map((c, i) => ({ label: et(c.id, c.label), ancho: (c.valor ?? 0) / max, color: [C.navy, C.azul2, C.celeste][i] ?? C.gris, valor: fmt(c.valor), extra: c.nota })), { etiqueta: 280 });
  return { cap: 'Lo que informó Contraloría', svg: svg(900, b.H, b.cuerpo), W: 900, H: b.H };
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

// Ranking: una barra por SLEP, del color de su nivel (rojo solo si es bajo).
function grafRanking(M: ModeloDashboard): GraficoSvg {
  const filas = M.ranking.filter((f) => f.av !== null);
  const b = barras(filas.map((f) => ({ label: `${f.pos}°  ${f.slep}`, ancho: Math.max(0.01, f.av ?? 0), color: COLOR_NIVEL[f.nivel], valor: pct(f.av), extra: `${fmt(f.cerrados)} de ${fmt(f.instruidos)}` })), { etiqueta: 230, alto: 22 });
  const ley = [['Alto (75 % o más)', COLOR_NIVEL.alto], ['Medio (25 % a 74,9 %)', COLOR_NIVEL.medio], ['Bajo (menos de 25 %)', COLOR_NIVEL.bajo]]
    .map(([t, col], i) => `<rect x="${20 + i * 230}" y="10" width="14" height="14" rx="2" fill="${col}"/>` + txt(40 + i * 230, 22, t, { size: 12, color: C.texto2 })).join('');
  const H = b.H + 34;
  return { cap: 'Avance de los sumarios por SLEP (1° = mayor avance)', svg: svg(900, H, ley + `<g transform="translate(0,34)">${b.cuerpo}</g>`), W: 900, H };
}

// Los gráficos de cada apartado del documento, por clave del apartado.
export function graficosDashboard(M: ModeloDashboard, o: { ambito: string; consolidado: boolean; et: (id: string, l: string) => string }): Record<string, GraficoSvg[]> {
  const g: Record<string, GraficoSvg[]> = {
    avance: [grafAvance(M, o.ambito)],
    origen: [grafOrigen(M, o.et)],
    involucrados: M.dona.total ? [grafDona(M)] : [],
  };
  for (const r of M.rankingsLic) g[`lic-${r.id}`] = r.filas.length ? [grafLicencias(r)] : [];
  for (const d of M.desgloses) g[`des-${d.clave}`] = [grafDesglose(d, o.et)];
  g['ranking'] = o.consolidado && M.ranking.some((f) => f.av !== null) ? [grafRanking(M)] : [];
  return g;
}
