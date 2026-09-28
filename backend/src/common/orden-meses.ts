// Orden canónico de meses (Enero..Diciembre) — un solo lugar, para que
// cualquier parte del sistema que necesite ordenar meses use el mismo
// criterio (antes vivía duplicado dentro de CasesService).
export const ORDEN_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Número comparable para ordenar mes+año — más alto = más reciente.
export function claveOrdenMes(mes: string, anio: string): number {
  return Number(anio) * 100 + ORDEN_MESES.indexOf(mes);
}
