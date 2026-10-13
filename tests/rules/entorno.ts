import {
  RulesTestContext,
  RulesTestEnvironment,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { GeoPoint, Timestamp, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const PROYECTO = 'demo-timereport';

/**
 * Datos de prueba: dos empresas (a y b) para comprobar el aislamiento.
 *   a: adminA, socA (socorrista), maqA (maquinista), bajaA (socorrista desactivado),
 *      adminBaja (claim admin pero perfil desactivado: token aun vivo),
 *      degradado (claim admin pero perfil ya socorrista: token aun vivo)
 *   b: adminB, socB
 *   comA1 asignada a socA, maqA, bajaA y degradado; comA2 sin asignar;
 *   comA3 inactiva y asignada a socA; comB1 a socB.
 *   La empresa c esta inactiva (adminC).
 */
export const USUARIOS = {
  adminA: { clienteId: 'a', rol: 'admin', perfilRol: 'admin', nombre: 'Admin A', activo: true },
  socA: { clienteId: 'a', rol: 'socorrista', perfilRol: 'socorrista', nombre: 'Socorrista A', activo: true },
  maqA: { clienteId: 'a', rol: 'maquinista', perfilRol: 'maquinista', nombre: 'Maquinista A', activo: true },
  bajaA: { clienteId: 'a', rol: 'socorrista', perfilRol: 'socorrista', nombre: 'Baja A', activo: false },
  adminBaja: { clienteId: 'a', rol: 'admin', perfilRol: 'admin', nombre: 'Admin de baja', activo: false },
  degradado: { clienteId: 'a', rol: 'admin', perfilRol: 'socorrista', nombre: 'Degradado', activo: true },
  adminB: { clienteId: 'b', rol: 'admin', perfilRol: 'admin', nombre: 'Admin B', activo: true },
  socB: { clienteId: 'b', rol: 'socorrista', perfilRol: 'socorrista', nombre: 'Socorrista B', activo: true },
  adminC: { clienteId: 'c', rol: 'admin', perfilRol: 'admin', nombre: 'Admin C', activo: true },
} as const;

export type NombreUsuario = keyof typeof USUARIOS;

export async function crearEntorno(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
    storage: {
      rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8'),
    },
  });
}

export function como(env: RulesTestEnvironment, nombre: NombreUsuario): RulesTestContext {
  const u = USUARIOS[nombre];
  return env.authenticatedContext(nombre, { clienteId: u.clienteId, rol: u.rol });
}

export const ID_CONTROL = 'AbCdEfGhIjKlMnOpQrSt';

export async function sembrar(env: RulesTestEnvironment) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const c of ['a', 'b', 'c']) {
      await setDoc(doc(db, 'clientes', c), {
        nombre: `Cliente ${c}`,
        activo: c !== 'c',
        branding: { nombreApp: 'TimeReport', logoPath: '', colorPrimario: '#00658f' },
        config: { radioFichajeM: 1000, maxFichajesDia: 2 },
      });
    }
    for (const [uid, u] of Object.entries(USUARIOS)) {
      await setDoc(doc(db, 'clientes', u.clienteId, 'usuarios', uid), {
        nombre: u.nombre,
        username: uid.toLowerCase(),
        email: `${uid.toLowerCase()}@${u.clienteId}.timereport.invalid`,
        rol: u.perfilRol,
        activo: u.activo,
      });
    }
    const comunidad = (nombre: string, asignados: string[], activa = true) => ({
      nombre,
      codigo: nombre,
      ubicacion: new GeoPoint(40.4, -3.7),
      asignados,
      activa,
    });
    await setDoc(doc(db, 'clientes/a/comunidades/comA1'), comunidad('Comunidad A1', ['socA', 'maqA', 'bajaA', 'degradado']));
    await setDoc(doc(db, 'clientes/a/comunidades/comA2'), comunidad('Comunidad A2', []));
    await setDoc(doc(db, 'clientes/a/comunidades/comA3'), comunidad('Comunidad A3', ['socA'], false));
    await setDoc(doc(db, 'clientes/b/comunidades/comB1'), comunidad('Comunidad B1', ['socB']));
    await setDoc(doc(db, 'clientes/c/comunidades/comC1'), comunidad('Comunidad C1', []));

    const ahora = Timestamp.now();
    const fichaje = (uid: string, nombre: string) => ({
      uid,
      usuarioNombre: nombre,
      comunidadId: 'comA1',
      comunidadNombre: 'Comunidad A1',
      tipo: 'entrada',
      fecha: ahora,
      origen: 'app',
      distanciaM: 10,
      precisionM: 5,
      registradoPor: null,
      motivo: null,
      anulado: null,
    });
    await setDoc(doc(db, 'clientes/a/imputaciones/impSoc'), fichaje('socA', 'Socorrista A'));
    await setDoc(doc(db, 'clientes/a/imputaciones/impMaq'), fichaje('maqA', 'Maquinista A'));
    await setDoc(doc(db, 'clientes/a/controlesAgua/ctlSoc'), {
      ...controlAgua('ctlSoc'),
      fecha: ahora,
    });
    await setDoc(doc(db, 'clientes/a/auditoria/aud1'), {
      accion: 'usuario.crear',
      descripcion: 'Da de alta a alguien',
      por: { uid: 'adminA', nombre: 'Admin A' },
      fecha: ahora,
    });
  });
}

/** Control de agua valido de socA (sin la fecha, que pone cada test). */
export function controlAgua(id: string, extra: Record<string, unknown> = {}) {
  return {
    uid: 'socA',
    usuarioNombre: 'Socorrista A',
    comunidadId: 'comA1',
    comunidadNombre: 'Comunidad A1',
    cloro: 1.5,
    ph: 7.2,
    banistas: 12,
    rebosadero: 3,
    aguaDepurada: 40.5,
    fotoPath: `clientes/a/controlesAgua/socA/${id}.jpg`,
    anulado: null,
    ...extra,
  };
}
