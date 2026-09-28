export interface Perfil {
  id: string;
  nombre: string;
  permisos: { vistas: string[]; acciones: string[]; gestion: string[] };
}

export interface Usuario {
  id: string;
  // Puede no tener todavía (cuenta "pendiente": un SLEP registrado de
  // antemano, sin persona asignada — mejora post-v2.23).
  usuario: string | null;
  // Preparación para ClaveÚnica (todavía sin conectar).
  rut: string | null;
  nombreParaMostrar: string;
  esSuperadmin: boolean;
  activo: boolean;
  alcance: string;
  perfil: Perfil | null;
}
