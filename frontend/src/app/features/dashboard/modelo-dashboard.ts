import { DashboardDeMes } from '../../core/models/dashboard.model';
import { fmt, pct } from '../../core/utils/avance';

// Cálculo del Dashboard por bloques, común a la pantalla del Dashboard y al
// Informe de dashboard: mismas cifras, cápsulas y rankings en los dos lados.
// 0 · Consolidado (campos 1 a 3 y el % de avance) → 1 · Origen (4 a 6) →
// 2 · Involucrados (7 y 8) → 3 · Licencias (rankings de 17 y 18) → 4 · Origen
// de los casos (19 y sus CIC) → 5 · Procedimientos (27 y 28 a 31) → 6 ·
// Resultado (32 y 33 a 37) → 7 · Anexo → Ranking. Las "cápsulas" son
// comentarios que guían al usuario: explican una diferencia, advierten un
// dato raro o resumen lo importante del bloque.

// Paleta PROPIA de la aplicación (la de la línea superior del encabezado):
// azules y grises. La única excepción es el % de avance y su barra, que usan
// la gama de rojo a azul del informe, justo para que resalten sobre todo lo demás.
export const PALETA = ['#1E4FA0', '#006BB9', '#3ABFF0', '#8FB2F5', '#94A3B8', '#CBD5E1', '#25306B'];
// Niveles de avance del Ranking: bajo = gris acero, medio = celeste, alto = azul intenso.
export const NIVEL_DASH = { bajo: '#94A3B8', medio: '#3ABFF0', alto: '#1E4FA0', na: '#CBD5E1' } as const;
export type Nivel = keyof typeof NIVEL_DASH;
export const nivelDe = (av: number | null): Nivel => (av == null ? 'na' : av < 0.25 ? 'bajo' : av < 0.75 ? 'medio' : 'alto');
// Degradado por orden: la barra mayor, en el azul más intenso.
const DEGRADADO = ['#25306B', '#1E4FA0', '#006BB9', '#3ABFF0', '#8FB2F5', '#94A3B8', '#CBD5E1'];

// Número de cada campo en el formulario de 37 campos. Solo se usa si el
// servidor no mandó la numeración del formulario del mes.
const NUMERO_POR_DEFECTO: Record<string, number> = {
  Q01: 1, Q02: 2, Q03: 3, Q04: 4, Q05: 5, Q06: 6, Q07: 7, YA_NO_ESTAN: 8, Q21: 17, Q22: 18, Q23: 19,
  CIC_9: 20, CIC_10: 21, CIC_13: 22, CIC_14: 23, CIC_15: 24, CIC_16: 25, CIC_21: 26,
  Q37: 27, Q38: 28, Q42: 29, Q43: 30, Q44: 31, Q45: 32, CENSURA: 33, Q48: 34, Q49: 35, Q50: 36, Q51: 37,
};

export interface Cifra { id: string; label: string; valor: number | null; nota: string }
// rango: lugar de la barra por valor (0 = la mayor), para su color.
export interface FilaBarra { id: string; label: string; valor: number | null; pct: number; color: string; nota: string; rango: number }
// Bloques 4, 5 y 6: un dato principal y su desglose en barras.
export interface Desglose { clave: string; eyebrow: string; titulo: string; principal: Cifra; filas: FilaBarra[]; capsulas: string[]; orden: string }
export interface FilaRanking { slep: string; valor: number; ancho: number; pos: number; propio: boolean }
export interface RankingLic { id: string; titulo: string; unidad: 'd' | '$'; filas: FilaRanking[]; propia: FilaRanking | null; capsula: string }
export interface ParteDona { id: string; label: string; valor: number; color: string; pct: number; d: string }
// Licencias de un SLEP: duración mínima, promedio y máxima (días) y la
// remuneración promedio; "nota" resume lo importante para la ventana Notas.
export interface LicenciasSlep { minima: Cifra; promedio: Cifra; maxima: Cifra; remuneracion: Cifra; nota: string }
export interface FilaRankingAvance { pos: number | null; slep: string; casos: number; instruidos: number; cerrados: number; av: number | null; nivel: Nivel }

export interface ModeloDashboard {
  identificacion: { n: number; label: string; valor: string }[];
  av: number | null;
  instruidos: number;
  cerrados: number;
  frase: string;
  capsulasAvance: string[];
  origen: Cifra[];
  capsulasOrigen: string[];
  dona: { partes: ParteDona[]; total: number };
  capsulasInvolucrados: string[];
  rankingsLic: RankingLic[];
  // Viendo un solo SLEP: sus propios datos de licencias (campos 15 a 18), sin
  // rankings (no hay con quién comparar). null en el consolidado.
  licenciasSlep: LicenciasSlep | null;
  desgloses: Desglose[];
  anexo: { id: string; label: string; valor: number | null }[];
  ranking: FilaRankingAvance[];
}

// "27. Sumarios instruidos": el número tal como aparece en el Formulario del mes.
export function numeracion(numeros: Record<string, number> | undefined) {
  const n = (id: string): number | string => numeros?.[id] ?? NUMERO_POR_DEFECTO[id] ?? '';
  const et = (id: string, label: string): string => {
    const x = n(id);
    return x === '' ? label : `${x}. ${label}`;
  };
  return { n, et };
}

export const rem = (v: number | null): string => (v == null ? '—' : '$' + fmt(v));

// "1 día", "30 días" (o "—" sin dato).
export const dias = (v: number | null): string => (v == null ? '—' : `${fmt(v)} ${v === 1 ? 'día' : 'días'}`);

// Posición (0 a 100 %) de una duración en la línea de licencias de un SLEP,
// que va de 0 a la duración máxima.
export const posLicencia = (valor: number | null, maxima: number | null): number =>
  valor == null || !maxima ? 0 : Math.min(100, Math.max(0, (valor / maxima) * 100));

// Arco de la dona (anillo) entre dos ángulos, en un lienzo de 120 × 120.
function arco(a0: number, a1: number): string {
  const R = 54, r = 34, cx = 60, cy = 60, grande = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
  return `M${p(R, a0)} A${R},${R} 0 ${grande} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${grande} 0 ${p(r, a0)} Z`;
}

// porSlep: el valor de cada SLEP en los campos 17 y 18 (rankings de licencias).
export function armarDashboard(
  d: DashboardDeMes,
  ctx: { slepActivo: string | null; mes: string; anio: string; porSlep: Map<string, { slep: string; valor: number }[]>; licenciasCompletas?: boolean },
): ModeloDashboard {
  const { slepActivo, mes, anio, porSlep } = ctx;
  // Rankings de licencias: los 6 primeros (Dashboard) o todos los SLEP (informe).
  const tope = ctx.licenciasCompletas ? Infinity : 6;
  const { n: N, et } = numeracion(d.numeros);
  const c = d.campos ?? {};
  const v = (id: string) => c[id] ?? null;
  const n = (id: string) => c[id] ?? 0;
  const dec = (x: number) => x.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // Barras de un desglose: el ancho es la parte que representa cada campo
  // del dato principal; el color, por orden (la mayor, la más intensa).
  const filas = (campos: [string, string][], base: number, ordenar: boolean): FilaBarra[] => {
    const fs = campos.map(([id, label]) => ({ id, label: et(id, label), valor: c[id] ?? null, pct: base ? (c[id] ?? 0) / base : 0, color: '', nota: '', rango: 0 }));
    const porValor = [...fs].sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
    porValor.forEach((f, i) => {
      f.color = DEGRADADO[Math.min(i, DEGRADADO.length - 1)];
      f.rango = i;
    });
    return ordenar ? porValor : fs;
  };

  // Ranking de un campo de licencias (6 SLEP o todos). Viendo un SLEP, se
  // destaca y, si no está entre los mostrados, se agrega debajo con su posición.
  const rankingLic = (id: string, titulo: string, unidad: 'd' | '$', consolidado: number | null): RankingLic => {
    const lista = [...(porSlep.get(id) ?? [])].filter((x) => x.valor > 0).sort((a, b) => b.valor - a.valor);
    const max = lista[0]?.valor || 1;
    const todas = lista.map((x, i) => ({ slep: x.slep, valor: x.valor, ancho: x.valor / max, pos: i + 1, propio: x.slep === slepActivo }));
    const propia = slepActivo ? todas.find((f) => f.propio && f.pos > tope) ?? null : null;
    const val = (x: number | null) => (unidad === '$' ? rem(x) : `${fmt(x)} días`);
    let capsula = '';
    if (slepActivo) {
      const p = todas.find((f) => f.propio);
      capsula = p && todas.length > 1 ? `${slepActivo} ocupa el ${p.pos}° lugar de ${todas.length} SLEP (${val(p.valor)}).` : consolidado != null ? `Valor del SLEP: ${val(consolidado)}.` : '';
    } else if (id === 'Q21') {
      capsula = `Campo ${N(id)}: la licencia más larga de cada SLEP. En el consolidado manda la mayor de todas (${val(consolidado)}).`;
    } else {
      capsula = `Campo ${N(id)}: en el consolidado es el promedio ponderado por funcionarios involucrados (${val(consolidado)}).`;
    }
    return { id, titulo: et(id, titulo), unidad, filas: todas.slice(0, tope), propia, capsula };
  };

  // 0 · Consolidado: campos 1 a 3 y el % de avance (32 ÷ 27).
  const t = d.textos;
  const identificacion = [
    { n: +N('Q01') || 1, label: 'Ministerio', valor: t?.Q01 || 'Ministerio de Educación' },
    { n: +N('Q02') || 2, label: 'Subsecretaría', valor: t?.Q02 || 'Subsecretaría de Educación' },
    { n: +N('Q03') || 3, label: 'Servicio', valor: slepActivo ? t?.Q03 || slepActivo : `Todos los SLEP (${d.totalContenedores})` },
  ];
  const instruidos = n('Q37');
  const cerrados = n('Q45');
  const av = instruidos > 0 ? cerrados / instruidos : null;
  const ambito = slepActivo ?? `los ${d.totalContenedores} SLEP`;
  const frase = av == null
    ? `En ${mes.toLowerCase()} de ${anio}, ${ambito} no registra sumarios instruidos (campo ${N('Q37')}).`
    : `${fmt(cerrados)} procesos cerrados (campo ${N('Q45')}) de ${fmt(instruidos)} sumarios instruidos (campo ${N('Q37')}).`;
  const capsulasAvance: string[] = [];
  if (av != null) {
    const faltan = Math.max(instruidos - cerrados, 0);
    capsulasAvance.push(faltan
      ? `Para llegar a la meta del 100 % faltan ${fmt(faltan)} procesos por cerrar.`
      : 'Todos los sumarios instruidos tienen su proceso cerrado: meta cumplida.');
  }

  // 1 · Origen (campos 4, 5 y 6)
  const casos = v('Q04'), lic = v('Q05'), inv = v('Q06');
  const origen: Cifra[] = [
    { id: 'Q04', label: 'Casos informados por la CGR', valor: casos, nota: 'Lo que reportó Contraloría' },
    { id: 'Q05', label: 'Licencias médicas incumplidas', valor: lic, nota: casos ? `${dec(lic! / casos)} licencias por caso` : '' },
    { id: 'Q06', label: 'Funcionarios involucrados', valor: inv, nota: casos ? `${dec(inv! / casos)} funcionarios por caso` : '' },
  ];
  const capsulasOrigen: string[] = [];
  if (casos && inv != null && inv < casos) capsulasOrigen.push(`Hay menos funcionarios involucrados (campo ${N('Q06')}) que casos informados (campo ${N('Q04')}): revisa si algún SLEP los cargó al revés.`);
  else if (casos) capsulasOrigen.push(`Cada caso informado involucra, en promedio, a ${dec(inv! / casos)} funcionarios y ${dec(lic! / casos)} licencias.`);

  // 2 · Involucrados (campos 7 y 8, dona)
  const cont = n('Q07'), yaNo = n('YA_NO_ESTAN'), totInv = cont + yaNo;
  let ang = -Math.PI / 2;
  const dona = {
    total: totInv,
    partes: [
      { id: 'Q07', label: et('Q07', 'Continúan en el servicio'), valor: cont, color: PALETA[0] },
      { id: 'YA_NO_ESTAN', label: et('YA_NO_ESTAN', 'Ya no están en el servicio'), valor: yaNo, color: PALETA[4] },
    ].map((p) => {
      const frac = totInv ? p.valor / totInv : 0, a0 = ang, a1 = ang + frac * Math.PI * 2;
      ang = a1;
      return { id: p.id, label: p.label, valor: p.valor, color: p.color, pct: frac, d: frac > 0 ? arco(a0, a1 - (frac < 1 ? 0.012 : 0)) : '' };
    }),
  };
  const capsulasInvolucrados: string[] = [];
  if (inv != null && totInv !== inv) capsulasInvolucrados.push(`Los campos ${N('Q07')} y ${N('YA_NO_ESTAN')} suman ${fmt(totInv)}, pero el campo ${N('Q06')} dice ${fmt(inv)} (diferencia ${fmt(totInv - inv)}). Deberían coincidir.`);
  else if (totInv) capsulasInvolucrados.push(`${pct(cont / totInv)} de los involucrados sigue en el servicio; con ellos todavía se puede aplicar una medida disciplinaria.`);

  // 3 · Licencias: rankings de los campos 17 y 18
  const rankingsLic = [
    rankingLic('Q21', 'Licencias más largas', 'd', v('Q21')),
    rankingLic('Q22', 'Remuneraciones promedio más altas', '$', v('Q22')),
  ];

  // Licencias de un solo SLEP (campos 15 a 18): sus propios datos, ordenados.
  const licenciasSlep: LicenciasSlep | null = slepActivo ? {
    minima: { id: 'Q20', label: 'Duración mínima', valor: v('Q20'), nota: 'días' },
    promedio: { id: 'Q19', label: 'Duración promedio', valor: v('Q19'), nota: 'días' },
    maxima: { id: 'Q21', label: 'Duración máxima', valor: v('Q21'), nota: 'días' },
    remuneracion: { id: 'Q22', label: 'Remuneración promedio', valor: v('Q22'), nota: 'de los funcionarios involucrados' },
    nota: v('Q21') != null && v('Q19') != null
      ? `En ${slepActivo}, las licencias duran en promedio ${fmt(v('Q19'))} días (campo ${N('Q19')}); la más larga, ${fmt(v('Q21'))} días (campo ${N('Q21')}).`
      : `${slepActivo} no informa la duración de las licencias (campos ${N('Q19')} a ${N('Q21')}).`,
  } : null;

  // 4 · Origen de los casos: 19 y sus CIC (20 a 26), de mayor a menor
  const CIC: [string, string][] = [['CIC_9', 'CIC N° 9 · salidas del país'], ['CIC_10', 'CIC N° 10 · partos'], ['CIC_13', 'CIC N° 13 · médicos en investigación penal'], ['CIC_14', 'CIC N° 14 · FFAA salidas del país'], ['CIC_15', 'CIC N° 15 · casinos de juego'], ['CIC_16', 'CIC N° 16 · salidas del país (regional)'], ['CIC_21', 'CIC N° 21 · trabajo con otros empleadores']];
  const aInv = n('Q23');
  const sumaCic = CIC.reduce((a, [id]) => a + n(id), 0);
  const capsCic: string[] = [];
  const m = d.metricas;
  if (m.diferenciaInvestigar > 0) capsCic.push(`El campo ${N('Q23')} tiene ${fmt(m.diferenciaInvestigar)} funcionarios menos que el campo ${N('Q06')}: algunos SLEP no cuentan a quienes ya no están en el servicio (campo ${N('YA_NO_ESTAN')}).`);
  if (m.diferenciaInvestigar < 0) capsCic.push(`El campo ${N('Q23')} supera al campo ${N('Q06')} en ${fmt(-m.diferenciaInvestigar)}: no debería haber más casos a investigar que funcionarios involucrados.`);
  if (sumaCic > aInv) capsCic.push(`Los CIC suman ${fmt(sumaCic)}, más que el campo ${N('Q23')}: una persona puede figurar en más de un CIC.`);
  const cic = filas(CIC, aInv, true);
  if (cic[0]?.valor) capsCic.push(`El origen principal es el ${cic[0].label.replace(/^\d+\. /, '')}: ${pct(cic[0].pct)} de los casos a investigar.`);

  // 5 · Procedimientos: 27 y 28 a 31
  const PROC: [string, string][] = [['Q38', 'En curso'], ['Q42', 'Resueltos'], ['Q43', 'Impugnados'], ['Q44', 'Enviados a la CGR para toma de razón']];
  const sumaProc = PROC.reduce((a, [id]) => a + n(id), 0) + cerrados;
  const capsProc: string[] = [];
  if (sumaProc === instruidos) capsProc.push(`Los campos ${N('Q38')} a ${N('Q44')} más los procesos cerrados (campo ${N('Q45')}, en Resultado) suman el campo ${N('Q37')}.`);
  else capsProc.push(`Los campos ${N('Q38')} a ${N('Q45')} suman ${fmt(sumaProc)}, pero el campo ${N('Q37')} dice ${fmt(instruidos)} (diferencia ${fmt(sumaProc - instruidos)}). Deberían coincidir.`);
  if (aInv) capsProc.push(`Se ha instruido sumario a ${pct(instruidos / aInv)} de los casos a investigar (campo ${N('Q23')}).`);

  // 6 · Resultado: 32 y 33 a 37
  const SAN: [string, string][] = [['CENSURA', 'Censura o amonestación'], ['Q48', 'Multa'], ['Q49', 'Suspensión del empleo'], ['Q50', 'Destitución'], ['Q51', 'Cerrados sin sanción']];
  const sumaSan = SAN.reduce((a, [id]) => a + n(id), 0);
  const conSancion = sumaSan - n('Q51');
  const capsSan: string[] = [];
  if (m.diferenciaSanciones) capsSan.push(`Los campos ${N('CENSURA')} a ${N('Q51')} suman ${fmt(sumaSan)}, pero el campo ${N('Q45')} dice ${fmt(cerrados)} (diferencia ${fmt(m.diferenciaSanciones)}). Deberían coincidir.`);
  if (sumaSan) capsSan.push(`De los procesos cerrados, ${fmt(conSancion)} terminaron con sanción (${pct(conSancion / sumaSan)}) y ${fmt(n('Q51'))} sin sanción.`);

  const desgloses: Desglose[] = [
    { clave: 'cic', eyebrow: '4 · Origen de los casos', titulo: 'Casos a investigar, por consolidado (CIC)', orden: 'De mayor a menor.',
      principal: { id: 'Q23', label: 'Casos a investigar por sumario administrativo', valor: v('Q23'), nota: inv ? `${pct(aInv / inv)} de los funcionarios involucrados` : '' },
      filas: cic, capsulas: capsCic },
    { clave: 'proc', eyebrow: '5 · Procedimientos', titulo: 'Estado de los sumarios instruidos', orden: 'Cada barra, como parte de los sumarios instruidos.',
      principal: { id: 'Q37', label: 'Sumarios instruidos', valor: v('Q37'), nota: aInv ? `${pct(instruidos / aInv)} de los casos a investigar` : '' },
      filas: filas(PROC, instruidos, false), capsulas: capsProc },
    { clave: 'san', eyebrow: '6 · Resultado', titulo: 'Cómo terminaron los procesos cerrados', orden: 'Cada barra, como parte de los procesos cerrados.',
      principal: { id: 'Q45', label: 'Procesos cerrados', valor: v('Q45'), nota: instruidos ? `${pct(cerrados / instruidos)} de los sumarios instruidos` : '' },
      filas: filas(SAN, cerrados, false), capsulas: capsSan },
  ];

  // 7 · Anexo (solo si se cargó con el formulario de 44 campos)
  const ANEXO: [string, string][] = [['Q56', 'Renuncias antes del procedimiento'], ['Q57', 'Procedimientos instruidos'], ['Q58', 'Procedimientos en investigación'], ['Q59', 'Procedimientos con vista fiscal'], ['Q60', 'Resoluciones ejecutoriadas'], ['Q61', 'Funcionarios con descuento'], ['Q62', 'Monto total de descuentos ($)']];
  const anexo = ANEXO.some(([id]) => v(id) != null) ? ANEXO.map(([id, label]) => ({ id, label: et(id, label), valor: v(id) })) : [];

  // Ranking completo
  const fr = (d.ranking ?? []).map((r) => ({ slep: r.slep, casos: r.casosInformados, instruidos: r.sumariosInstruidos, cerrados: r.procesosCerrados, av: r.pct == null ? null : r.pct / 100 }));
  const con = fr.filter((f) => f.av != null).sort((a, b) => b.av! - a.av! || b.cerrados - a.cerrados || a.slep.localeCompare(b.slep, 'es'));
  const sin = fr.filter((f) => f.av == null).sort((a, b) => a.slep.localeCompare(b.slep, 'es'));
  const ranking: FilaRankingAvance[] = [
    ...con.map((f, i) => ({ ...f, pos: i + 1 as number | null, nivel: nivelDe(f.av) })),
    ...sin.map((f) => ({ ...f, pos: null, nivel: 'na' as Nivel })),
  ];
  if (!slepActivo && sin.length) capsulasAvance.push(`${sin.length} SLEP no registran sumarios instruidos: no entran en el % de avance.`);

  return { identificacion, av, instruidos, cerrados, frase, capsulasAvance, origen, capsulasOrigen, dona, capsulasInvolucrados, rankingsLic, licenciasSlep, desgloses, anexo, ranking };
}
