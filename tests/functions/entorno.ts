import { initializeApp as initAdmin, getApps } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { GeoPoint, Timestamp, getFirestore as adminDb } from 'firebase-admin/firestore';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

import { emailDeLogin } from '../../src/app/shared/email-usuario';

// Ejecutar con `npm run test:functions` (arranca los emuladores de auth,
// firestore, storage y functions y define las variables *_EMULATOR_HOST).

export const PROYECTO = 'demo-timereport';
export const PASSWORD = 'clave-de-prueba';
export const MADRID = { lat: 40.4168, lng: -3.7038 };

if (!getApps().length) initAdmin({ projectId: PROYECTO });
export { adminAuth, adminDb };

export function clienteSdk(nombre: string) {
  const app = initializeApp({ projectId: PROYECTO, apiKey: 'demo-api-key' }, nombre);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app, 'europe-southwest1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  return {
    app,
    auth,
    llamar: <T = unknown>(fn: string, datos: unknown) =>
      httpsCallable<unknown, T>(functions, fn)(datos).then((r) => r.data),
    async entrarComo(usuario: string, clienteId: string, password = PASSWORD) {
      await signOut(auth);
      await signInWithEmailAndPassword(auth, emailDeLogin(usuario, clienteId), password);
    },
    salir: () => signOut(auth),
  };
}

export async function codigoError(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (e) {
    return (e as { code: string }).code;
  }
  throw new Error('Se esperaba un error');
}

/**
 * emulators:exec lanza los tests en cuanto los emuladores dicen estar listos,
 * pero el de Functions a veces registra las funciones un poco despues y,
 * mientras tanto, responde 404. Se espera a que existan.
 */
export async function esperarFunctions() {
  const url = `http://127.0.0.1:5001/${PROYECTO}/europe-southwest1/fichar`;
  for (let i = 0; i < 120; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    }).catch(() => null);
    if (res && res.status !== 404) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('El emulador de Functions no ha cargado las funciones');
}

export async function crearEmpresa(id: string, extra: Record<string, unknown> = {}) {
  await adminDb().doc(`clientes/${id}`).set({
    nombre: `Empresa ${id}`,
    activo: true,
    branding: { nombreApp: 'TimeReport', logoPath: '', colorPrimario: '#00658f' },
    config: { radioFichajeM: 1000, maxFichajesDia: 2, zonaHoraria: 'Europe/Madrid' },
    ...extra,
  });
}

export async function crearComunidad(clienteId: string, id: string, asignados: string[], extra: Record<string, unknown> = {}) {
  await adminDb().doc(`clientes/${clienteId}/comunidades/${id}`).set({
    nombre: `Comunidad ${id}`,
    codigo: id,
    ubicacion: new GeoPoint(MADRID.lat, MADRID.lng),
    asignados,
    activa: true,
    ...extra,
  });
}

/** Usuario creado directamente (sin pasar por las Functions). */
export async function crearUsuarioDirecto(
  uid: string,
  clienteId: string,
  rol: string,
  { activo = true, perfilRol = rol }: { activo?: boolean; perfilRol?: string } = {},
) {
  const email = emailDeLogin(uid, clienteId);
  await adminAuth().createUser({ uid, email, password: PASSWORD, displayName: uid });
  await adminAuth().setCustomUserClaims(uid, { clienteId, rol });
  await adminDb().doc(`clientes/${clienteId}/usuarios/${uid}`).set({
    nombre: uid,
    username: uid.toLowerCase(),
    email,
    rol: perfilRol,
    activo,
  });
}

/** Fichaje sembrado directamente (para preparar escenarios). */
export async function sembrarFichaje(clienteId: string, uid: string, tipo: string, haceHoras: number) {
  await adminDb().collection(`clientes/${clienteId}/imputaciones`).add({
    uid,
    usuarioNombre: uid,
    comunidadId: 'x',
    comunidadNombre: 'X',
    tipo,
    fecha: Timestamp.fromMillis(Date.now() - haceHoras * 3600000),
    origen: 'app',
    distanciaM: 0,
    precisionM: 0,
    registradoPor: null,
    motivo: null,
    anulado: null,
  });
}

export const posicion = (lat = MADRID.lat, lng = MADRID.lng, precision = 15) => ({ lat, lng, precision });
