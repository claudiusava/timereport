import { GeoPoint, Timestamp } from 'firebase/firestore';

import { TipoFichaje } from '../shared/reglas';

export type { TipoFichaje };
export type Rol = 'admin' | 'socorrista' | 'maquinista';

export const ROLES: { valor: Rol; etiqueta: string; descripcion: string }[] = [
  { valor: 'maquinista', etiqueta: 'Maquinista', descripcion: 'Ficha su jornada' },
  { valor: 'socorrista', etiqueta: 'Socorrista', descripcion: 'Ficha y registra controles de agua' },
  { valor: 'admin', etiqueta: 'Administrador', descripcion: 'Gestiona todo, en todas las comunidades' },
];

export function etiquetaRol(rol: Rol): string {
  return ROLES.find((r) => r.valor === rol)?.etiqueta ?? rol;
}

/** clientes/{clienteId}: legible sin sesion para pintar la marca en el login. */
export interface Empresa {
  id: string;
  nombre: string;
  activo: boolean;
  demo?: boolean;
  branding: { nombreApp: string; logoPath: string; colorPrimario: string };
  config: { radioFichajeM: number; maxFichajesDia: number; zonaHoraria?: string };
}

/** clientes/{c}/usuarios/{uid}: solo lo escriben las Cloud Functions. */
export interface Usuario {
  uid: string;
  nombre: string;
  username: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

export interface Comunidad {
  id: string;
  nombre: string;
  codigo: string;
  /** null solo en comunidades importadas con coordenadas invalidas. */
  ubicacion: GeoPoint | null;
  asignados: string[];
  activa: boolean;
}

export interface Anulacion {
  por: { uid: string; nombre: string };
  fecha: Timestamp | null;
  motivo: string;
}

/** clientes/{c}/imputaciones/{id}: solo los crean las Cloud Functions. */
export interface Fichaje {
  id: string;
  uid: string;
  usuarioNombre: string;
  comunidadId: string;
  comunidadNombre: string;
  tipo: TipoFichaje;
  fecha: Timestamp;
  origen: 'app' | 'manual' | 'migracion';
  distanciaM: number | null;
  precisionM: number | null;
  registradoPor: { uid: string; nombre: string } | null;
  motivo: string | null;
  anulado: Anulacion | null;
}

export interface ControlAgua {
  id: string;
  uid: string;
  usuarioNombre: string;
  comunidadId: string;
  comunidadNombre: string;
  cloro: number;
  ph: number;
  banistas: number;
  rebosadero: number;
  aguaDepurada: number;
  fotoPath: string | null;
  fecha: Timestamp;
  anulado: Anulacion | null;
}

export interface EntradaAuditoria {
  id: string;
  accion: string;
  descripcion: string;
  motivo: string | null;
  por: { uid: string; nombre: string };
  fecha: Timestamp | null;
}

// Valores de referencia del RD 742/2013 (piscinas de uso publico):
// cloro libre residual 0,5-2,0 mg/l y pH 7,2-8,0.
export const RANGO_CLORO = { min: 0.5, max: 2.0 };
export const RANGO_PH = { min: 7.2, max: 8.0 };

export const NIVELES_CLORO = [0.2, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0];
export const NIVELES_PH = [6.8, 7.0, 7.2, 7.4, 7.6, 7.8, 8.0, 8.2];

export const fueraDeRango = (valor: number, rango: { min: number; max: number }) =>
  valor < rango.min || valor > rango.max;
