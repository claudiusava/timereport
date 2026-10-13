// Datos de prueba para desarrollar en local contra los emuladores.
//
//   1. npm run emulators          (en otra terminal)
//   2. npm run seed
//   3. npm start  ->  http://localhost:4200/#/c/demo
//
// Usuarios (contraseña de todos: la de PASSWORD_PRUEBA):
//   demo:  admin (administrador), socorrista, maquinista
//   otra:  admin  (segundo cliente, para comprobar el aislamiento)
//
// Solo funciona contra los emuladores: se niega a ejecutarse si no lo son.

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';

import { emailDeLogin } from '../functions/src/email-usuario';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';
process.env['FIREBASE_STORAGE_EMULATOR_HOST'] ??= '127.0.0.1:9199';

const PROYECTO = 'demo-timereport';
const PASSWORD_PRUEBA = 'prueba123';

if (!PROYECTO.startsWith('demo-')) throw new Error('Solo para emuladores');

initializeApp({ projectId: PROYECTO });
const db = getFirestore();
const auth = getAuth();

async function cliente(id: string, nombre: string, colorPrimario: string, colorSecundario: string) {
  await db.doc(`clientes/${id}`).set({
    nombre,
    activo: true,
    branding: { nombreApp: 'TimeReport', logoPath: '', colorPrimario, colorSecundario },
    config: { radioFichajeM: 1000, maxFichajesDia: 2 },
  });
}

async function usuario(clienteId: string, username: string, nombre: string, rol: string) {
  const email = emailDeLogin(username, clienteId);
  const uid = `${clienteId}_${username}`;
  await auth.deleteUser(uid).catch(() => undefined);
  await auth.createUser({ uid, email, password: PASSWORD_PRUEBA, displayName: nombre });
  await auth.setCustomUserClaims(uid, { clienteId, rol });
  await db.doc(`clientes/${clienteId}/usuarios/${uid}`).set({
    nombre,
    username,
    email,
    rol,
    activo: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  return uid;
}

async function main() {
  await cliente('demo', 'Piscinas Demo', '#0e7490', '#164e63');
  await cliente('otra', 'Otra Empresa', '#7c3aed', '#4c1d95');

  await usuario('demo', 'admin', 'Ana Administradora', 'admin');
  const soc = await usuario('demo', 'socorrista', 'Sergio Socorrista', 'socorrista');
  const maq = await usuario('demo', 'maquinista', 'Marta Maquinista', 'maquinista');
  await usuario('otra', 'admin', 'Admin de Otra', 'admin');

  const comunidades = [
    { id: 'sol', nombre: 'Residencial Sol (Madrid centro)', codigo: '101', lat: 40.416775, lng: -3.70379, asignados: [soc, maq] },
    { id: 'retiro', nombre: 'Comunidad Retiro', codigo: '102', lat: 40.41526, lng: -3.684416, asignados: [soc] },
    { id: 'alcorcon', nombre: 'Urbanización Alcorcón', codigo: '103', lat: 40.345, lng: -3.824, asignados: [] },
  ];
  for (const c of comunidades) {
    await db.doc(`clientes/demo/comunidades/${c.id}`).set({
      nombre: c.nombre,
      codigo: c.codigo,
      ubicacion: new GeoPoint(c.lat, c.lng),
      asignados: c.asignados,
      activa: true,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  await db.doc('clientes/otra/comunidades/x').set({
    nombre: 'Comunidad de Otra',
    codigo: '1',
    ubicacion: new GeoPoint(41.38, 2.17),
    asignados: [],
    activa: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  // Unos dias de fichajes del maquinista para ver historial y Excel.
  const lote = db.batch();
  for (let dias = 1; dias <= 5; dias++) {
    for (const [tipo, hora] of [['entrada', 8], ['salida', 14]] as const) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - dias);
      fecha.setHours(hora, Math.floor(Math.random() * 15), 0, 0);
      lote.set(db.collection('clientes/demo/imputaciones').doc(), {
        uid: maq,
        usuarioNombre: 'Marta Maquinista',
        comunidadId: 'sol',
        comunidadNombre: comunidades[0].nombre,
        tipo,
        fecha: Timestamp.fromDate(fecha),
      });
    }
  }
  await lote.commit();

  console.log('Datos de prueba creados. Entra en http://localhost:4200/#/c/demo');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
