// Lo que el portal GDP-SLEP Studio dice de una persona (contrato de
// integración). Es la misma forma que arma el portal en su identidad.ts.
export interface IdentidadPortal {
  portalId: string;
  usuario: string | null;
  nombreParaMostrar: string;
  rut: string | null;
  activo: boolean;
  esSuperadmin: boolean;
  tieneAcceso: boolean;
  rol: string | null; // 'Admin' | 'Validador' | 'Digitador' | 'Superadmin'
  alcance: string[]; // ['todos'] o [un SLEP]
  opciones: Record<string, boolean>; // ej. { cargar_datos: true }
  // Definición completa del perfil (desde la etapa 3): se guarda junto con la
  // persona, así nunca le falta el perfil aunque se haya perdido un aviso.
  perfil?: PerfilPortal | null;
}

export interface PerfilPortal {
  id: string;
  nombre: string;
  permisos: { vistas: string[]; acciones: string[]; gestion: string[] };
}

// Perfil del portal → perfil de Sumarios.
export const PERFIL_DE_ROL: Record<string, string> = {
  Admin: 'perfil_admin',
  Validador: 'perfil_validador',
  Digitador: 'perfil_digitador',
};

// ¿Está encendido el ingreso solo desde el portal? (variable INGRESO_SOLO_PORTAL
// en Render). Apagado: Sumarios funciona como siempre, y además acepta el
// ingreso desde el portal — así se puede probar sin cortarle el acceso a nadie.
export const ingresoSoloPortal = () => process.env.INGRESO_SOLO_PORTAL === 'true';
