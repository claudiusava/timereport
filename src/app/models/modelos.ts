import { GeoPoint, Timestamp } from '@angular/fire/firestore';

export type Rol = 'admin' | 'socorrista' | 'maquinista';

export const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: 'maquinista', etiqueta: 'Maquinista' },
  { valor: 'socorrista', etiqueta: 'Socorrista' },
  { valor: 'admin', etiqueta: 'Administrador' },
];

export function etiquetaRol(rol: Rol): string {
  return ROLES.find((r) => r.valor === rol)?.etiqueta ?? rol;
}

/** Custom claims que asignan las Cloud Functions a cada usuario. */
export interface Claims {
  clienteId: string;
  rol: Rol;
}

/** clientes/{clienteId}: legible sin login para pintar la marca en el login. */
export interface Cliente {
  id: string;
  nombre: string;
  activo: boolean;
  branding: Branding;
  config: ConfigCliente;
}

export interface Branding {
  nombreApp: string;
  /** Ruta en Storage (clientes/{id}/branding/...) o vacio para el logo por defecto. */
  logoPath: string;
  colorPrimario: string;
  colorSecundario: string;
}

export interface ConfigCliente {
  /** Distancia maxima a la comunidad para poder fichar. */
  radioFichajeM: number;
  /** Maximo de entradas (y de salidas) por dia. */
  maxFichajesDia: number;
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

/** clientes/{c}/comunidades/{id} */
export interface Comunidad {
  id: string;
  nombre: string;
  codigo: string;
  /** null solo en comunidades migradas con coordenadas invalidas. */
  ubicacion: GeoPoint | null;
  /** uids de los trabajadores asignados (lo mantienen las Cloud Functions). */
  asignados: string[];
  activa: boolean;
  createdAt?: Timestamp;
}

export type TipoFichaje = 'entrada' | 'salida';

/** clientes/{c}/imputaciones/{id} */
export interface Imputacion {
  id: string;
  uid: string;
  usuarioNombre: string;
  comunidadId: string;
  comunidadNombre: string;
  tipo: TipoFichaje;
  fecha: Timestamp;
}

/** clientes/{c}/controlesAgua/{id} */
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
  /** Ruta en Storage, o null en registros migrados sin foto. */
  fotoPath: string | null;
  fecha: Timestamp;
}

export const NIVELES_CLORO: { valor: number; color: string }[] = [
  { valor: 0.5, color: '#FDEFF3' },
  { valor: 1.0, color: '#FBC8D9' },
  { valor: 1.5, color: '#F89CBF' },
  { valor: 2.0, color: '#F570A5' },
  { valor: 3.0, color: '#F3448B' },
  { valor: 5.0, color: '#F11971' },
];

export const NIVELES_PH: { valor: number; color: string }[] = [
  { valor: 6.8, color: '#FFB366' },
  { valor: 7.0, color: '#FFA74D' },
  { valor: 7.2, color: '#FF9933' },
  { valor: 7.4, color: '#FF8C1A' },
  { valor: 7.6, color: '#FF8000' },
  { valor: 8.0, color: '#FF7300' },
];
