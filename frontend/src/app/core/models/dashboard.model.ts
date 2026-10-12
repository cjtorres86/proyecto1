export interface RankingFila {
  slep: string;
  pct: number | null;
  casosInformados: number;
  sumariosInstruidos: number;
  procesosCerrados: number;
}

export interface SerieItem { id: string; label: string; valor: number; pct?: number }

export interface Metricas {
  totalCasos: number; totalLicencias: number; totalFuncionarios: number;
  continuanServicio: number; yaNoEstan: number;
  casosInvestigar: number; cic: SerieItem[];
  sumariosInstruidos: number; procesosEnCurso: number; procesosResueltos: number;
  procesosImpugnados: number; enviadosCGR: number; procesosCerrados: number;
  sanciones: SerieItem[]; pctAvance: number | null;
  diferenciaInvestigar: number; diferenciaCIC: number; diferenciaSanciones: number;
}

export interface DashboardDeMes {
  totalContenedores: number;
  metricas: Metricas;
  cicPct: SerieItem[];
  procedimientosPct: SerieItem[];
  sancionesPct: SerieItem[];
  ranking: RankingFila[];
  // Todos los campos de la foto consolidada (Dashboard por bloques). null = vacío.
  campos?: Record<string, number | null>;
  // Número de cada campo en el Formulario del mes (preguntaId → número).
  numeros?: Record<string, number>;
  // Campos 1 a 3 (Ministerio, Subsecretaría, Servicio).
  textos?: { Q01: string; Q02: string; Q03: string };
}
