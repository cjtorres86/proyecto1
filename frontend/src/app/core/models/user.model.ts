export interface Perfil {
  id: string;
  nombre: string;
  permisos: { vistas: string[]; acciones: string[]; gestion: string[] };
}

export interface Usuario {
  id: string;
  usuario: string;
  nombreParaMostrar: string;
  esSuperadmin: boolean;
  alcance: string;
  perfil: Perfil | null;
}
