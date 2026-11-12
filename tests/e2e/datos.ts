// Datos de la empresa ficticia "e2e" que siembra preparar.ts.

export const EMPRESA = 'e2e';
export const PASSWORD = 'clave-e2e-1234';

/** Junto a la comunidad "Los Pinos" (Puerta del Sol). */
export const CERCA = { latitude: 40.4168, longitude: -3.7038 };
/** Unos 60 km al norte. */
export const LEJOS = { latitude: 40.95, longitude: -3.7038 };

export const USUARIOS = {
  admin: { uid: 'e2e_admin', username: 'admin', nombre: 'Elena Admin', rol: 'admin' },
  socorrista: { uid: 'e2e_socorrista', username: 'socorrista', nombre: 'Sergio Socorrista', rol: 'socorrista' },
  maquinista: { uid: 'e2e_maquinista', username: 'maquinista', nombre: 'Marta Maquinista', rol: 'maquinista' },
  movil: { uid: 'e2e_movil', username: 'movil', nombre: 'Mario Móvil', rol: 'maquinista' },
  /** Tiene fichajes de ayer, para las pruebas del administrador. */
  veterano: { uid: 'e2e_veterano', username: 'veterano', nombre: 'Víctor Veterano', rol: 'maquinista' },
  baja: { uid: 'e2e_baja', username: 'baja', nombre: 'Berta Baja', rol: 'socorrista', activo: false },
} as const;

export const COMUNIDADES = {
  pinos: { id: 'pinos', nombre: 'Residencial Los Pinos', codigo: '201' },
  robles: { id: 'robles', nombre: 'Urbanización Los Robles', codigo: '202' },
} as const;
