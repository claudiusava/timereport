import { deleteApp } from 'firebase/app';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { emailDeLogin } from '../../src/app/shared/email-usuario';
import {
  adminAuth,
  adminDb,
  clienteSdk,
  codigoError,
  crearComunidad,
  crearEmpresa,
  crearUsuarioDirecto,
  esperarFunctions,
} from './entorno';

const sdk = clienteSdk('usuarios');
const CLAVE = 'clave-larga-1';

const asignados = (c: string, id: string) =>
  adminDb().doc(`clientes/${c}/comunidades/${id}`).get().then((d) => d.data()?.['asignados'] as string[]);

beforeAll(async () => {
  await esperarFunctions();
  await crearEmpresa('ua');
  await crearEmpresa('ub');
  await crearEmpresa('udemo', { demo: true });
  await crearComunidad('ua', 'c1', []);
  await crearComunidad('ua', 'c2', []);
  await crearUsuarioDirecto('adminA', 'ua', 'admin');
  await crearUsuarioDirecto('admin2A', 'ua', 'admin');
  await crearUsuarioDirecto('maqA', 'ua', 'maquinista');
  await crearUsuarioDirecto('adminBajaA', 'ua', 'admin', { activo: false });
  await crearUsuarioDirecto('degradadoA', 'ua', 'admin', { perfilRol: 'maquinista' });
  await crearUsuarioDirecto('adminB', 'ub', 'admin');
  await crearEmpresa('uc');
  await crearUsuarioDirecto('adminC1', 'uc', 'admin');
  await crearUsuarioDirecto('adminC2', 'uc', 'admin');
  await crearUsuarioDirecto('adminDemo', 'udemo', 'admin');
  await crearUsuarioDirecto('trabDemo', 'udemo', 'maquinista');
}, 120000);

afterAll(async () => {
  await deleteApp(sdk.app);
});

describe('crearUsuario', () => {
  const base = { nombre: 'Juan Pérez', usuario: 'JPérez', password: CLAVE, rol: 'socorrista', comunidades: ['c1'] };

  it('rechaza a quien no es admin activo, aunque su token diga admin', async () => {
    for (const quien of ['maqA', 'adminBajaA', 'degradadoA']) {
      await sdk.entrarComo(quien, 'ua');
      expect(await codigoError(sdk.llamar('crearUsuario', { ...base, usuario: `x${quien}` }))).toBe('functions/permission-denied');
    }
    await sdk.salir();
    expect(await codigoError(sdk.llamar('crearUsuario', base))).toBe('functions/unauthenticated');
  });

  it('el admin crea un usuario con claims, perfil, comunidades y auditoría', async () => {
    await sdk.entrarComo('adminA', 'ua');
    const { uid } = await sdk.llamar<{ uid: string }>('crearUsuario', base);
    const user = await adminAuth().getUser(uid);
    expect(user.email).toBe('jperez@ua.timereport.invalid');
    expect(user.customClaims).toEqual({ clienteId: 'ua', rol: 'socorrista' });
    const perfil = (await adminDb().doc(`clientes/ua/usuarios/${uid}`).get()).data();
    expect(perfil).toMatchObject({ nombre: 'Juan Pérez', username: 'jperez', rol: 'socorrista', activo: true });
    expect(await asignados('ua', 'c1')).toContain(uid);
    const aud = await adminDb().collection('clientes/ua/auditoria').where('objetivo.id', '==', uid).get();
    expect(aud.docs[0].get('accion')).toBe('usuario.crear');
    await sdk.entrarComo('JPérez', 'ua', CLAVE);
  });

  it('no permite usuarios repetidos ni contraseñas cortas', async () => {
    await sdk.entrarComo('adminA', 'ua');
    expect(await codigoError(sdk.llamar('crearUsuario', { ...base, usuario: 'jperez' }))).toBe('functions/already-exists');
    expect(await codigoError(sdk.llamar('crearUsuario', { ...base, usuario: 'otro', password: '1234567' }))).toBe('functions/invalid-argument');
  });

  it('no admite emails: un admin no puede ocupar ni sondear usuarios de otra empresa', async () => {
    await sdk.entrarComo('adminA', 'ua');
    expect(await codigoError(sdk.llamar('crearUsuario', { ...base, usuario: 'adminb@ub.timereport.invalid' }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('crearUsuario', { ...base, usuario: 'alguien@gmail.com' }))).toBe('functions/invalid-argument');
  });

  it('el mismo nombre de usuario puede existir en otra empresa', async () => {
    await sdk.entrarComo('adminB', 'ub');
    await sdk.llamar('crearUsuario', { ...base, comunidades: [] });
  });

  it('valida los datos y las comunidades de su empresa', async () => {
    await sdk.entrarComo('adminB', 'ub');
    expect(await codigoError(sdk.llamar('crearUsuario', { ...base, usuario: 'yy', rol: 'jefe' }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('crearUsuario', { ...base, usuario: 'yy', nombre: '' }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('crearUsuario', { ...base, usuario: 'yy', comunidades: ['c1'] }))).toBe('functions/invalid-argument');
  });
});

describe('actualizarUsuario', () => {
  const uidDe = async (usuario: string, c: string) => (await adminAuth().getUserByEmail(emailDeLogin(usuario, c))).uid;

  it('cambia rol, nombre de usuario y comunidades, y cierra sus sesiones', async () => {
    await sdk.entrarComo('adminA', 'ua');
    const uid = await uidDe('jperez', 'ua');
    const antes = (await adminAuth().getUser(uid)).tokensValidAfterTime;
    await new Promise((r) => setTimeout(r, 1100));
    await sdk.llamar('actualizarUsuario', { uid, nombre: 'Juan Pérez García', usuario: 'juanpe', rol: 'maquinista', comunidades: ['c2'] });
    const user = await adminAuth().getUser(uid);
    expect(user.email).toBe('juanpe@ua.timereport.invalid');
    expect(user.customClaims).toEqual({ clienteId: 'ua', rol: 'maquinista' });
    expect(user.tokensValidAfterTime).not.toBe(antes);
    expect(await asignados('ua', 'c1')).not.toContain(uid);
    expect(await asignados('ua', 'c2')).toContain(uid);
    const perfil = (await adminDb().doc(`clientes/ua/usuarios/${uid}`).get()).data();
    expect(perfil).toMatchObject({ nombre: 'Juan Pérez García', username: 'juanpe', rol: 'maquinista' });
  });

  it('un admin no puede editar usuarios de otra empresa', async () => {
    await sdk.entrarComo('adminB', 'ub');
    const uid = await uidDe('juanpe', 'ua');
    expect(await codigoError(sdk.llamar('actualizarUsuario', { uid, nombre: 'X', usuario: 'hack', rol: 'admin', comunidades: [] }))).toBe('functions/not-found');
  });

  it('un admin no puede quitarse a sí mismo el rol', async () => {
    await sdk.entrarComo('adminA', 'ua');
    expect(await codigoError(sdk.llamar('actualizarUsuario', { uid: 'adminA', nombre: 'adminA', usuario: 'adminA', rol: 'maquinista', comunidades: [] }))).toBe('functions/failed-precondition');
  });

  it('nunca deja a la empresa sin administradores activos (dos admins desactivándose a la vez)', async () => {
    await sdk.entrarComo('adminC1', 'uc');
    const otro = clienteSdk('usuarios-otro');
    await otro.entrarComo('adminC2', 'uc');
    const resultados = await Promise.allSettled([
      sdk.llamar('cambiarEstadoUsuario', { uid: 'adminC2', activo: false }),
      otro.llamar('cambiarEstadoUsuario', { uid: 'adminC1', activo: false }),
    ]);
    await deleteApp(otro.app);
    const activos = await adminDb().collection('clientes/uc/usuarios').where('rol', '==', 'admin').where('activo', '==', true).get();
    expect(activos.size).toBeGreaterThanOrEqual(1);
    expect(resultados.some((r) => r.status === 'rejected')).toBe(true);
  });
});

describe('cambiarEstadoUsuario y restablecerPassword', () => {
  it('desactivar impide entrar y reactivar lo permite', async () => {
    await sdk.entrarComo('adminA', 'ua');
    await sdk.llamar('cambiarEstadoUsuario', { uid: 'maqA', activo: false });
    expect((await adminAuth().getUser('maqA')).disabled).toBe(true);
    expect((await adminDb().doc('clientes/ua/usuarios/maqA').get()).get('activo')).toBe(false);
    expect(await codigoError(sdk.entrarComo('maqA', 'ua'))).toBe('auth/user-disabled');
    await sdk.entrarComo('adminA', 'ua');
    await sdk.llamar('cambiarEstadoUsuario', { uid: 'maqA', activo: true });
    await sdk.entrarComo('maqA', 'ua');
  });

  it('un admin no puede desactivarse a sí mismo', async () => {
    await sdk.entrarComo('adminA', 'ua');
    expect(await codigoError(sdk.llamar('cambiarEstadoUsuario', { uid: 'adminA', activo: false }))).toBe('functions/failed-precondition');
  });

  it('el admin restablece la contraseña (mínimo 8 caracteres) y queda auditado', async () => {
    await sdk.entrarComo('adminA', 'ua');
    expect(await codigoError(sdk.llamar('restablecerPassword', { uid: 'maqA', password: 'corta' }))).toBe('functions/invalid-argument');
    await sdk.llamar('restablecerPassword', { uid: 'maqA', password: 'nueva-clave' });
    expect(['auth/invalid-credential', 'auth/wrong-password']).toContain(await codigoError(sdk.entrarComo('maqA', 'ua')));
    await sdk.entrarComo('maqA', 'ua', 'nueva-clave');
    const aud = await adminDb().collection('clientes/ua/auditoria').where('accion', '==', 'usuario.password').get();
    expect(aud.size).toBeGreaterThan(0);
  });

  it('no se puede tocar a usuarios de otra empresa', async () => {
    await sdk.entrarComo('adminB', 'ub');
    expect(await codigoError(sdk.llamar('restablecerPassword', { uid: 'maqA', password: 'otra-clave-1' }))).toBe('functions/not-found');
  });

  it('en la empresa demo no se cambian contraseñas ni se desactivan usuarios', async () => {
    await sdk.entrarComo('adminDemo', 'udemo');
    expect(await codigoError(sdk.llamar('restablecerPassword', { uid: 'trabDemo', password: 'otra-clave-1' }))).toBe('functions/failed-precondition');
    expect(await codigoError(sdk.llamar('cambiarEstadoUsuario', { uid: 'trabDemo', activo: false }))).toBe('functions/failed-precondition');
  });
});

describe('actualizarEmpresa', () => {
  it('el admin cambia la marca y las reglas de fichaje', async () => {
    await sdk.entrarComo('adminA', 'ua');
    await sdk.llamar('actualizarEmpresa', { nombreApp: 'Mi App', colorPrimario: '#AA3300', radioFichajeM: 300, maxFichajesDia: 3 });
    const c = (await adminDb().doc('clientes/ua').get()).data()!;
    expect(c['branding']).toMatchObject({ nombreApp: 'Mi App', colorPrimario: '#aa3300' });
    expect(c['config']).toMatchObject({ radioFichajeM: 300, maxFichajesDia: 3 });
  });

  it('valida los valores y el logo de su empresa', async () => {
    await sdk.entrarComo('adminA', 'ua');
    expect(await codigoError(sdk.llamar('actualizarEmpresa', { colorPrimario: 'rojo' }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('actualizarEmpresa', { radioFichajeM: 10 }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('actualizarEmpresa', { logoPath: 'clientes/ub/branding/logo-1.png' }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('actualizarEmpresa', {}))).toBe('functions/invalid-argument');
  });

  it('un trabajador no puede', async () => {
    await sdk.entrarComo('maqA', 'ua', 'nueva-clave');
    expect(await codigoError(sdk.llamar('actualizarEmpresa', { nombreApp: 'X' }))).toBe('functions/permission-denied');
  });
});
