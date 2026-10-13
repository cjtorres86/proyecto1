// Copia de RESPALDO de la parte de Sumarios del catálogo único del portal
// (gdp-slep-studio/catalogo/catalogo-general.json). La ventana de descargas usa
// SIEMPRE la versión del portal; esta solo se usa si el portal no responde o
// si Sumarios funciona sin portal (modo independiente). Si se cambia un
// informe, se cambia en el catálogo del portal; aquí solo conviene mantenerla
// parecida.
export interface InformeCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: 'consolidado' | 'interactivo' | 'estatico';
  formato: 'xlsx' | 'html' | 'pdf';
  estado: string;
  permiso: string;
  requiereAlcanceTodos: boolean;
  palabrasClave: string[];
  orden: number;
}

export const CATALOGO_RESPALDO: InformeCatalogo[] = [
  { id: 'sumarios_consolidado_mes', nombre: 'Informe consolidado de datos por mes', descripcion: 'Los 36 SLEP, una hoja por mes.', categoria: 'consolidado', formato: 'xlsx', estado: 'activa', permiso: 'exportar_excel_consolidado', requiereAlcanceTodos: true, palabrasClave: ['consolidado', 'datos por mes', 'excel'], orden: 1 },
  { id: 'sumarios_consolidado_slep', nombre: 'Informe consolidado de datos por SLEP', descripcion: 'Cada SLEP en su propia hoja, con todos sus meses.', categoria: 'consolidado', formato: 'xlsx', estado: 'activa', permiso: 'exportar_excel_slep', requiereAlcanceTodos: false, palabrasClave: ['consolidado', 'datos por slep', 'excel'], orden: 2 },
  { id: 'sumarios_informe_interactivo', nombre: 'Informe interactivo nacional', descripcion: 'Avance de los sumarios del país: indicadores, gráficos, ranking y tabla por SLEP.', categoria: 'interactivo', formato: 'html', estado: 'activa', permiso: 'exportar_informe', requiereAlcanceTodos: false, palabrasClave: ['interactivo', 'nacional'], orden: 3 },
  { id: 'sumarios_ranking_interactivo', nombre: 'Informe interactivo de ranking', descripcion: 'El ranking de avance de los SLEP: posiciones, cambios del mes y el detalle de cada servicio. Genera informes en Excel y PDF.', categoria: 'interactivo', formato: 'html', estado: 'activa', permiso: 'exportar_informe', requiereAlcanceTodos: false, palabrasClave: ['interactivo', 'ranking'], orden: 4 },
  { id: 'sumarios_errores_interactivo', nombre: 'Informe interactivo de errores', descripcion: 'Los errores de validación del mes, para revisar en pantalla.', categoria: 'interactivo', formato: 'html', estado: 'activa', permiso: 'exportar_informe', requiereAlcanceTodos: false, palabrasClave: ['interactivo', 'errores'], orden: 5 },
  { id: 'sumarios_informe_general_pdf', nombre: 'Informe estático nacional', descripcion: 'El informe nacional del mes, listo para guardar o imprimir.', categoria: 'estatico', formato: 'pdf', estado: 'activa', permiso: 'exportar_informe', requiereAlcanceTodos: false, palabrasClave: ['estatico', 'nacional', 'pdf'], orden: 6 },
  { id: 'sumarios_ranking_pdf', nombre: 'Informe estático de ranking', descripcion: 'El ranking del mes, listo para guardar o imprimir.', categoria: 'estatico', formato: 'pdf', estado: 'activa', permiso: 'exportar_informe', requiereAlcanceTodos: false, palabrasClave: ['estatico', 'ranking', 'pdf'], orden: 7 },
  { id: 'sumarios_errores_pdf', nombre: 'Informe estático de errores', descripcion: 'Los errores de validación del mes, listos para guardar o imprimir.', categoria: 'estatico', formato: 'pdf', estado: 'activa', permiso: 'exportar_informe', requiereAlcanceTodos: false, palabrasClave: ['estatico', 'errores', 'pdf'], orden: 8 },
];
