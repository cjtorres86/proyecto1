import { SetMetadata } from '@nestjs/common';

export const BITACORA_META = 'bitacora_meta';

// Catálogo de tipos de acción (mejora post-v2.23) — código corto y
// estable para poder filtrar la Bitácora por tipo. La descripción en
// pantalla es libre (ver BitacoraMeta.descripcion); esto es solo la
// "categoría".
export const TIPOS_ACCION = [
  'sesion_iniciada',
  'sesion_cerrada',
  'formulario_visto',
  'formulario_guardado',
  'excel_cargado',
  'excel_descargado',
  'informe_visto',
  'informe_pdf_descargado',
  'mensaje_creado',
  'mensaje_editado',
  'mensaje_eliminado',
  'mensaje_reaccion',
  'mes_creado',
  'mes_cerrado',
  'mes_abierto',
  'mes_eliminado',
  'usuario_creado',
  'usuario_editado',
  'usuario_activado',
  'usuario_desactivado',
  'perfil_creado',
  'perfil_editado',
] as const;
export type TipoAccion = (typeof TIPOS_ACCION)[number];

export interface BitacoraMeta {
  accion: TipoAccion;
  // request = { body, params, query, user }; resultado = lo que devolvió
  // el método del controller — con eso alcanza para armar una
  // descripción legible sin tener que repetir lógica en cada lugar.
  descripcion: (request: any, resultado: any) => string;
  detalle?: (request: any, resultado: any) => unknown;
}

// @Bitacora({...}) en un método de un Controller (mejora post-v2.23):
// BitacoraInterceptor (registrado global en app.module.ts) lo detecta
// solo, y registra la acción DESPUÉS de que el método terminó bien —
// nunca antes: si el método falla (por ejemplo, guardar en un mes
// cerrado), no queda un registro de algo que en realidad no pasó.
export const Bitacora = (meta: BitacoraMeta) => SetMetadata(BITACORA_META, meta);
