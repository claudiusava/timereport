import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteApp } from 'firebase/app';

import {
  adminDb,
  clienteSdk,
  codigoError,
  crearComunidad,
  crearEmpresa,
  crearUsuarioDirecto,
  esperarFunctions,
  posicion,
  sembrarFichaje,
} from './entorno';

const C = 'fich';
const sdk = clienteSdk('fichajes');

const fichar = (comunidadId: string, tipo: string, pos = posicion()) =>
  sdk.llamar<{ id: string; tipo: string }>('fichar', { comunidadId, tipo, posicion: pos });

beforeAll(async () => {
  await esperarFunctions();
  await crearEmpresa(C);
  await crearEmpresa('fich-demo', { demo: true });
  for (const u of ['trab', 'noche', 'olvido', 'maximo', 'otro', 'doble']) {
    await crearUsuarioDirecto(u, C, 'maquinista');
  }
  await crearUsuarioDirecto('baja', C, 'maquinista', { activo: false });
  await crearUsuarioDirecto('jefe', C, 'admin');
  await crearUsuarioDirecto('jefeBaja', C, 'admin', { activo: false });
  await crearUsuarioDirecto('jefeDegradado', C, 'admin', { perfilRol: 'maquinista' });
  await crearUsuarioDirecto('visitante', 'fich-demo', 'maquinista');
  const todos = ['trab', 'noche', 'olvido', 'maximo', 'doble', 'baja', 'jefeDegradado'];
  await crearComunidad(C, 'com1', todos);
  await crearComunidad(C, 'com2', []);
  await crearComunidad(C, 'inactiva', todos, { activa: false });
  await crearComunidad(C, 'singps', todos, { ubicacion: null });
  await crearComunidad('fich-demo', 'demo1', ['visitante']);
}, 120000);

afterAll(async () => {
  await deleteApp(sdk.app);
});

describe('fichar', () => {
  it('registra entrada y salida con la hora del servidor y la distancia', async () => {
    await sdk.entrarComo('trab', C);
    const antes = Date.now();
    const r = await fichar('com1', 'entrada');
    expect(r.tipo).toBe('entrada');
    const doc = (await adminDb().doc(`clientes/${C}/imputaciones/${r.id}`).get()).data()!;
    expect(doc).toMatchObject({ uid: 'trab', usuarioNombre: 'trab', comunidadNombre: 'Comunidad com1', origen: 'app', anulado: null });
    expect(doc['fecha'].toMillis()).toBeGreaterThanOrEqual(antes - 2000);
    expect(doc['distanciaM']).toBeLessThan(5);
    expect((await fichar('com1', 'salida')).tipo).toBe('salida');
  });

  it('no deja fichar dos veces lo mismo (doble toque)', async () => {
    await sdk.entrarComo('doble', C);
    const resultados = await Promise.allSettled([fichar('com1', 'entrada'), fichar('com1', 'entrada')]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await codigoError(fichar('com1', 'entrada'))).toBe('functions/failed-precondition');
  });

  it('rechaza fichar lejos de la comunidad o con poca precisión', async () => {
    await sdk.entrarComo('otro', C);
    await adminDb().doc(`clientes/${C}/comunidades/com1`).update({ asignados: ['trab', 'noche', 'olvido', 'maximo', 'doble', 'baja', 'jefeDegradado', 'otro'] });
    expect(await codigoError(fichar('com1', 'entrada', posicion(40.5, -3.7)))).toBe('functions/failed-precondition');
    expect(await codigoError(fichar('com1', 'entrada', posicion(undefined, undefined, 2500)))).toBe('functions/failed-precondition');
  });

  it('rechaza comunidades no asignadas, inactivas o sin ubicación', async () => {
    await sdk.entrarComo('trab', C);
    expect(await codigoError(fichar('com2', 'entrada'))).toBe('functions/permission-denied');
    expect(await codigoError(fichar('inactiva', 'entrada'))).toBe('functions/failed-precondition');
    expect(await codigoError(fichar('singps', 'entrada'))).toBe('functions/failed-precondition');
    expect(await codigoError(fichar('noexiste', 'entrada'))).toBe('functions/failed-precondition');
  });

  it('turno nocturno: con una entrada de hace 10 h toca la salida', async () => {
    await sembrarFichaje(C, 'noche', 'entrada', 10);
    await sdk.entrarComo('noche', C);
    expect(await codigoError(fichar('com1', 'entrada'))).toBe('functions/failed-precondition');
    expect((await fichar('com1', 'salida')).tipo).toBe('salida');
  });

  it('una entrada sin salida de hace más de 16 h se da por olvidada', async () => {
    await sembrarFichaje(C, 'olvido', 'entrada', 20);
    await sdk.entrarComo('olvido', C);
    expect((await fichar('com1', 'entrada')).tipo).toBe('entrada');
  });

  it('respeta el máximo de entradas al día', async () => {
    await sdk.entrarComo('maximo', C);
    await fichar('com1', 'entrada');
    await fichar('com1', 'salida');
    await fichar('com1', 'entrada');
    await fichar('com1', 'salida');
    expect(await codigoError(fichar('com1', 'entrada'))).toBe('functions/failed-precondition');
  });

  it('un usuario desactivado no puede fichar aunque su token siga vivo', async () => {
    await sdk.entrarComo('baja', C);
    expect(await codigoError(fichar('com1', 'entrada'))).toBe('functions/permission-denied');
  });

  it('en la empresa demo se puede fichar desde cualquier sitio', async () => {
    await sdk.entrarComo('visitante', 'fich-demo');
    expect((await fichar('demo1', 'entrada', posicion(51.5, -0.12, 3000))).tipo).toBe('entrada');
  });

  it('valida los datos de entrada', async () => {
    await sdk.entrarComo('trab', C);
    expect(await codigoError(sdk.llamar('fichar', { comunidadId: 'com1', tipo: 'pausa', posicion: posicion() }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('fichar', { comunidadId: 'com1', tipo: 'entrada' }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('fichar', { comunidadId: '../x', tipo: 'entrada', posicion: posicion() }))).toBe('functions/invalid-argument');
  });
});

describe('correcciones del admin', () => {
  it('registra un fichaje manual con motivo y queda auditado', async () => {
    await sdk.entrarComo('jefe', C);
    const fecha = new Date(Date.now() - 3 * 3600000).toISOString();
    const { id } = await sdk.llamar<{ id: string }>('registrarFichajeManual', {
      uid: 'trab', comunidadId: 'com1', tipo: 'salida', fecha, motivo: 'Olvidó fichar la salida',
    });
    const doc = (await adminDb().doc(`clientes/${C}/imputaciones/${id}`).get()).data()!;
    expect(doc).toMatchObject({ origen: 'manual', motivo: 'Olvidó fichar la salida', usuarioNombre: 'trab' });
    expect(doc['registradoPor'].uid).toBe('jefe');
    const auditoria = await adminDb().collection(`clientes/${C}/auditoria`).where('objetivo.id', '==', id).get();
    expect(auditoria.docs[0].data()).toMatchObject({ accion: 'fichaje.manual', motivo: 'Olvidó fichar la salida' });
  });

  it('rechaza fechas futuras y motivos vacíos', async () => {
    await sdk.entrarComo('jefe', C);
    const base = { uid: 'trab', comunidadId: 'com1', tipo: 'salida', motivo: 'Motivo válido' };
    expect(await codigoError(sdk.llamar('registrarFichajeManual', { ...base, fecha: new Date(Date.now() + 3600000).toISOString() }))).toBe('functions/invalid-argument');
    expect(await codigoError(sdk.llamar('registrarFichajeManual', { ...base, fecha: new Date().toISOString(), motivo: '' }))).toBe('functions/invalid-argument');
  });

  it('anula un fichaje con motivo sin borrarlo, una sola vez', async () => {
    await sdk.entrarComo('trab', C);
    const { id } = await fichar('com1', 'entrada');
    await sdk.entrarComo('jefe', C);
    await sdk.llamar('anularRegistro', { coleccion: 'imputaciones', id, motivo: 'Fichaje de prueba' });
    const doc = (await adminDb().doc(`clientes/${C}/imputaciones/${id}`).get()).data()!;
    expect(doc['anulado']).toMatchObject({ motivo: 'Fichaje de prueba', por: { uid: 'jefe', nombre: 'jefe' } });
    expect(await codigoError(sdk.llamar('anularRegistro', { coleccion: 'imputaciones', id, motivo: 'Otra vez' }))).toBe('functions/failed-precondition');
    // Anulada la entrada, al trabajador le vuelve a tocar entrada.
    await sdk.entrarComo('trab', C);
    expect((await fichar('com1', 'entrada')).tipo).toBe('entrada');
  });

  it('solo un admin activo puede corregir (no trabajadores, ni admins desactivados o degradados)', async () => {
    const datos = { coleccion: 'imputaciones', id: 'cualquiera', motivo: 'Motivo válido' };
    for (const quien of ['trab', 'jefeBaja', 'jefeDegradado']) {
      await sdk.entrarComo(quien, C);
      expect(await codigoError(sdk.llamar('anularRegistro', datos))).toBe('functions/permission-denied');
    }
  });
});
