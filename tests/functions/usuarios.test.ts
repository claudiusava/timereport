import { initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { GeoPoint as AdminGeoPoint, getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { emailDeLogin } from '../../src/app/shared/email-usuario';

// Ejecutar con `npm run test:functions` (arranca los emuladores de auth,
// firestore y functions y define las variables *_EMULATOR_HOST).

const PROYECTO = 'demo-timereport';
const PASSWORD = 'clave-de-prueba';

initAdmin({ projectId: PROYECTO });

const app = initializeApp({ projectId: PROYECTO, apiKey: 'demo-api-key' }, 'tests');
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const functions = getFunctions(app, 'europe-southwest1');
connectFunctionsEmulator(functions, '127.0.0.1', 5001);

const llamar = (nombre: string, datos: unknown) => httpsCallable(functions, nombre)(datos);

async function entrarComo(usuario: string, clienteId: string, password = PASSWORD) {
  await signOut(auth);
  await signInWithEmailAndPassword(auth, emailDeLogin(usuario, clienteId), password);
}

async function crearDirecto(uid: string, clienteId: string, rol: string) {
  await adminAuth().createUser({ uid, email: emailDeLogin(uid, clienteId), password: PASSWORD });
  await adminAuth().setCustomUserClaims(uid, { clienteId, rol });
  await adminDb().doc(`clientes/${clienteId}/usuarios/${uid}`).set({
    nombre: uid,
    username: uid.toLowerCase(),
    email: emailDeLogin(uid, clienteId),
    rol,
    activo: true,
  });
}

async function codigoError(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (e) {
    return (e as { code: string }).code;
  }
  throw new Error('Se esperaba un error');
}

const comunidad = (uid: string) =>
  adminDb().doc(`clientes/a/comunidades/${uid}`).get().then((d) => d.data()?.['asignados'] as string[]);

beforeAll(async () => {
  for (const c of ['a', 'b']) {
    await adminDb().doc(`clientes/${c}`).set({ nombre: c, activo: true });
  }
  for (const id of ['comA1', 'comA2']) {
    await adminDb().doc(`clientes/a/comunidades/${id}`).set({
      nombre: id,
      codigo: id,
      ubicacion: new AdminGeoPoint(40, -3),
      asignados: [],
      activa: true,
    });
  }
  await crearDirecto('adminA', 'a', 'admin');
  await crearDirecto('adminB', 'b', 'admin');
  await crearDirecto('maqA', 'a', 'maquinista');
});

afterAll(async () => {
  await deleteApp(app);
});

describe('crearUsuario', () => {
  it('rechaza a quien no es admin', async () => {
    await entrarComo('maqA', 'a');
    expect(
      await codigoError(llamar('crearUsuario', {
        nombre: 'X', usuario: 'x', password: PASSWORD, rol: 'admin', comunidades: [],
      })),
    ).toBe('functions/permission-denied');
  });

  it('rechaza llamadas sin sesión', async () => {
    await signOut(auth);
    expect(
      await codigoError(llamar('crearUsuario', {
        nombre: 'X', usuario: 'x', password: PASSWORD, rol: 'admin', comunidades: [],
      })),
    ).toBe('functions/unauthenticated');
  });

  it('el admin crea un usuario con claims, perfil y comunidades', async () => {
    await entrarComo('adminA', 'a');
    const res = await llamar('crearUsuario', {
      nombre: 'Juan Pérez',
      usuario: 'JPérez',
      password: PASSWORD,
      rol: 'socorrista',
      comunidades: ['comA1'],
    });
    const { uid } = res.data as { uid: string };

    const user = await adminAuth().getUser(uid);
    expect(user.email).toBe('jperez@a.timereport.invalid');
    expect(user.customClaims).toEqual({ clienteId: 'a', rol: 'socorrista' });

    const perfil = (await adminDb().doc(`clientes/a/usuarios/${uid}`).get()).data();
    expect(perfil).toMatchObject({ nombre: 'Juan Pérez', username: 'jperez', rol: 'socorrista', activo: true });
    expect(await comunidad('comA1')).toContain(uid);

    // Puede entrar escribiendo su usuario como lo escribio el admin.
    await entrarComo('JPérez', 'a');
    expect(auth.currentUser?.uid).toBe(uid);
  });

  it('no permite usuarios repetidos', async () => {
    await entrarComo('adminA', 'a');
    expect(
      await codigoError(llamar('crearUsuario', {
        nombre: 'Otro', usuario: 'jperez', password: PASSWORD, rol: 'maquinista', comunidades: [],
      })),
    ).toBe('functions/already-exists');
  });

  it('el mismo nombre de usuario puede existir en otro cliente', async () => {
    await entrarComo('adminB', 'b');
    await llamar('crearUsuario', {
      nombre: 'Juan de B', usuario: 'jperez', password: PASSWORD, rol: 'maquinista', comunidades: [],
    });
  });

  it('valida los datos', async () => {
    await entrarComo('adminA', 'a');
    const base = { nombre: 'Y', usuario: 'yy', password: PASSWORD, rol: 'maquinista', comunidades: [] };
    expect(await codigoError(llamar('crearUsuario', { ...base, password: '123' }))).toBe('functions/invalid-argument');
    expect(await codigoError(llamar('crearUsuario', { ...base, rol: 'jefe' }))).toBe('functions/invalid-argument');
    expect(await codigoError(llamar('crearUsuario', { ...base, nombre: '' }))).toBe('functions/invalid-argument');
    expect(await codigoError(llamar('crearUsuario', { ...base, comunidades: ['noExiste'] }))).toBe('functions/invalid-argument');
    expect(await codigoError(llamar('crearUsuario', { ...base, usuario: '!!!' }))).toBe('functions/invalid-argument');
  });

  it('un admin no puede asignar comunidades de otro cliente', async () => {
    await entrarComo('adminB', 'b');
    expect(
      await codigoError(llamar('crearUsuario', {
        nombre: 'Z', usuario: 'zz', password: PASSWORD, rol: 'maquinista', comunidades: ['comA1'],
      })),
    ).toBe('functions/invalid-argument');
  });
});

describe('actualizarUsuario', () => {
  async function uidDe(usuario: string, clienteId: string) {
    return (await adminAuth().getUserByEmail(emailDeLogin(usuario, clienteId))).uid;
  }

  it('cambia rol, nombre de usuario y comunidades', async () => {
    await entrarComo('adminA', 'a');
    const uid = await uidDe('jperez', 'a');
    await llamar('actualizarUsuario', {
      uid,
      nombre: 'Juan Pérez García',
      usuario: 'juanpe',
      rol: 'maquinista',
      comunidades: ['comA2'],
    });

    const user = await adminAuth().getUser(uid);
    expect(user.email).toBe('juanpe@a.timereport.invalid');
    expect(user.customClaims).toEqual({ clienteId: 'a', rol: 'maquinista' });
    expect(await comunidad('comA1')).not.toContain(uid);
    expect(await comunidad('comA2')).toContain(uid);
    const perfil = (await adminDb().doc(`clientes/a/usuarios/${uid}`).get()).data();
    expect(perfil).toMatchObject({ nombre: 'Juan Pérez García', username: 'juanpe', rol: 'maquinista' });
  });

  it('un admin no puede editar usuarios de otro cliente', async () => {
    await entrarComo('adminB', 'b');
    const uid = await uidDe('juanpe', 'a');
    expect(
      await codigoError(llamar('actualizarUsuario', {
        uid, nombre: 'Hack', usuario: 'hack', rol: 'admin', comunidades: [],
      })),
    ).toBe('functions/not-found');
  });

  it('un admin no puede quitarse el rol de administrador', async () => {
    await entrarComo('adminA', 'a');
    expect(
      await codigoError(llamar('actualizarUsuario', {
        uid: 'adminA', nombre: 'adminA', usuario: 'adminA', rol: 'maquinista', comunidades: [],
      })),
    ).toBe('functions/failed-precondition');
  });
});

describe('cambiarEstadoUsuario y restablecerPassword', () => {
  it('desactivar impide entrar y reactivar lo permite', async () => {
    await entrarComo('adminA', 'a');
    await llamar('cambiarEstadoUsuario', { uid: 'maqA', activo: false });
    expect((await adminAuth().getUser('maqA')).disabled).toBe(true);
    expect((await adminDb().doc('clientes/a/usuarios/maqA').get()).data()?.['activo']).toBe(false);
    expect(await codigoError(entrarComo('maqA', 'a'))).toBe('auth/user-disabled');

    await entrarComo('adminA', 'a');
    await llamar('cambiarEstadoUsuario', { uid: 'maqA', activo: true });
    await entrarComo('maqA', 'a');
  });

  it('un admin no puede desactivarse a sí mismo', async () => {
    await entrarComo('adminA', 'a');
    expect(
      await codigoError(llamar('cambiarEstadoUsuario', { uid: 'adminA', activo: false })),
    ).toBe('functions/failed-precondition');
  });

  it('el admin restablece la contraseña', async () => {
    await entrarComo('adminA', 'a');
    await llamar('restablecerPassword', { uid: 'maqA', password: 'nueva-clave' });
    // El emulador responde wrong-password; produccion, invalid-credential.
    expect(['auth/invalid-credential', 'auth/wrong-password']).toContain(await codigoError(entrarComo('maqA', 'a')));
    await entrarComo('maqA', 'a', 'nueva-clave');
  });

  it('no se puede restablecer la de otro cliente', async () => {
    await entrarComo('adminB', 'b');
    expect(
      await codigoError(llamar('restablecerPassword', { uid: 'maqA', password: 'otra-clave' })),
    ).toBe('functions/not-found');
  });
});
