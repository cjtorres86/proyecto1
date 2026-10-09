// Autoría de un dato (mejora post-v2.23): "quién lo cargó y cuándo", en una
// sola línea. La hora se muestra siempre en hora de Chile, sin importar la
// configuración del computador de quien lo mira — así todos ven lo mismo.
export interface AutoriaCampo {
  nombre: string;
  perfil: string;
  en: string; // fecha ISO, la entrega el backend
}

const FORMATO_FECHA = new Intl.DateTimeFormat('es-CL', {
  timeZone: 'America/Santiago',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function textoAutoria(a: AutoriaCampo | null | undefined): string {
  if (!a) return '';
  return `${a.nombre} · ${a.perfil} · ${FORMATO_FECHA.format(new Date(a.en)).replace(',', '')}`;
}
