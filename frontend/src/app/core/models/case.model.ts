export interface MesActivo { mes: string; anio: string }

export interface Contenedor {
  id: string;
  slep: string;
  mesConsolidado: string;
  anioConsolidado: string;
  formularioId: string;
  status: 'pending' | 'ok' | 'no';
  filled: number;
  total: number;
  // Distinto de "filled" (ver cases.service.ts, listarPorMes): true solo
  // si hay al menos un campo con un valor numérico mayor que cero, sin
  // contar Ministerio/Subsecretaría/nombre del SLEP (siempre fijos).
  tieneDatosReales: boolean;
}

export interface CampoConValor {
  id: string;
  numero: number;
  preguntaId: string;
  nombre: string;
  tipo: string;
  valor: string;
  ayuda: { desc: string; notes: string[] };
  valorFijo: string | null;
  opciones: string[] | null;
  invalido: boolean;
}

export interface HistoricoSlep {
  slep: string;
  campos: { id: string; preguntaId: string; nombre: string }[];
  filas: { mes: string; anio: string; valores: string[] }[];
}
