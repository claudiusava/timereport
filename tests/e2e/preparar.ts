import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';

import { emailDeLogin } from '../../src/app/shared/email-usuario';
import { CERCA, COMUNIDADES, EMPRESA, PASSWORD, USUARIOS } from './datos';

const PROYECTO = 'demo-timereport';

/** Siembra desde cero la empresa "e2e" en los emuladores. */
export default async function preparar() {
  // Solo emuladores: sin estas variables el Admin SDK iria a un proyecto real.
  process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';
  if (!getApps().length) initializeApp({ projectId: PROYECTO });
  await esperarFunctions();

  const db = getFirestore();
  const auth = getAuth();
  const cliente = db.doc(`clientes/${EMPRESA}`);
  await db.recursiveDelete(cliente);

  await cliente.set({
    nombre: 'Piscinas E2E',
    activo: true,
    branding: { nombreApp: 'PoolData', logoPath: '', colorPrimario: '#00658f' },
    config: { radioFichajeM: 200, maxFichajesDia: 2, zonaHoraria: 'Europe/Madrid', maxUsuarios: 25 },
  });

  for (const u of Object.values(USUARIOS)) {
    const activo = !('activo' in u) || u.activo;
    const email = emailDeLogin(u.username, EMPRESA);
    await auth.deleteUser(u.uid).catch(() => undefined);
    await auth.createUser({ uid: u.uid, email, password: PASSWORD, displayName: u.nombre, disabled: !activo });
    await auth.setCustomUserClaims(u.uid, { clienteId: EMPRESA, rol: u.rol });
    await cliente.collection('usuarios').doc(u.uid).set({
      nombre: u.nombre,
      username: u.username,
      email,
      rol: u.rol,
      activo,
    });
  }
  // Usuarios creados por las pruebas en ejecuciones anteriores.
  const { users } = await auth.listUsers(1000);
  const nuestros = new Set<string>(Object.values(USUARIOS).map((u) => u.uid));
  for (const u of users) {
    if (u.customClaims?.['clienteId'] === EMPRESA && !nuestros.has(u.uid)) await auth.deleteUser(u.uid);
  }

  const { socorrista, maquinista, movil, veterano, baja } = USUARIOS;
  await cliente.collection('comunidades').doc(COMUNIDADES.pinos.id).set({
    ...sinId(COMUNIDADES.pinos),
    ubicacion: new GeoPoint(CERCA.latitude, CERCA.longitude),
    asignados: [socorrista.uid, maquinista.uid, movil.uid, veterano.uid, baja.uid],
    activa: true,
  });
  await cliente.collection('comunidades').doc(COMUNIDADES.robles.id).set({
    ...sinId(COMUNIDADES.robles),
    ubicacion: new GeoPoint(40.45, -3.69),
    asignados: [veterano.uid],
    activa: true,
  });

  // Jornada de ayer de Victor: 8:00-15:00.
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  for (const [tipo, hora] of [['entrada', 8], ['salida', 15]] as const) {
    const fecha = new Date(ayer);
    fecha.setHours(hora, 0, 0, 0);
    await cliente.collection('imputaciones').add({
      uid: veterano.uid,
      usuarioNombre: veterano.nombre,
      comunidadId: COMUNIDADES.robles.id,
      comunidadNombre: COMUNIDADES.robles.nombre,
      tipo,
      fecha: Timestamp.fromDate(fecha),
      origen: 'app',
      distanciaM: 12,
      precisionM: 8,
      registradoPor: null,
      motivo: null,
      anulado: null,
    });
  }
}

function sinId<T extends { id: string }>({ id: _id, ...resto }: T) {
  return resto;
}

/** El emulador de Functions registra las funciones un poco despues de arrancar. */
async function esperarFunctions() {
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
  throw new Error('El emulador de Functions no responde. ¿Están arrancados los emuladores?');
}
