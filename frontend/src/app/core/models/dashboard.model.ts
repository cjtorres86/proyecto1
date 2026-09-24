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
  ranking: { slep: string; pct: number | null }[];
}
