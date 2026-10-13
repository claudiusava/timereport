import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  GeoPoint,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { como, crearEntorno, sembrar } from './entorno';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await crearEntorno();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await sembrar(env);
});

const db = (nombre: Parameters<typeof como>[1]) => como(env, nombre).firestore();

function fichaje(extra: Record<string, unknown> = {}) {
  return {
    uid: 'socA',
    usuarioNombre: 'Socorrista A',
    comunidadId: 'comA1',
    comunidadNombre: 'Comunidad A1',
    tipo: 'entrada',
    fecha: serverTimestamp(),
    ...extra,
  };
}

function control(id: string, extra: Record<string, unknown> = {}) {
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
    fecha: serverTimestamp(),
    ...extra,
  };
}

const ID_CONTROL = 'AbCdEfGhIjKlMnOpQrSt';

async function sembrarRegistros() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    const ahora = Timestamp.now();
    await setDoc(doc(d, 'clientes/a/imputaciones/impSoc'), { ...fichaje(), fecha: ahora });
    await setDoc(doc(d, 'clientes/a/imputaciones/impMaq'), {
      ...fichaje({ uid: 'maqA', usuarioNombre: 'Maquinista A' }),
      fecha: ahora,
    });
    await setDoc(doc(d, 'clientes/a/controlesAgua/ctlSoc'), { ...control('ctlSoc'), fecha: ahora });
  });
}

describe('clientes', () => {
  it('cualquiera puede leer la marca de un cliente', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'clientes/a')));
  });

  it('nadie puede listar los clientes', async () => {
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'clientes')));
    await assertFails(getDocs(collection(db('adminA'), 'clientes')));
  });

  it('ni un admin puede modificar el cliente desde la app', async () => {
    await assertFails(updateDoc(doc(db('adminA'), 'clientes/a'), { nombre: 'X' }));
  });
});

describe('usuarios', () => {
  it('un trabajador lee su propio perfil', async () => {
    await assertSucceeds(getDoc(doc(db('socA'), 'clientes/a/usuarios/socA')));
  });

  it('un trabajador no lee el perfil de otro', async () => {
    await assertFails(getDoc(doc(db('socA'), 'clientes/a/usuarios/maqA')));
    await assertFails(getDocs(collection(db('socA'), 'clientes/a/usuarios')));
  });

  it('el admin lista los usuarios de su cliente', async () => {
    await assertSucceeds(getDocs(collection(db('adminA'), 'clientes/a/usuarios')));
  });

  it('un admin no ve los usuarios de otro cliente', async () => {
    await assertFails(getDocs(collection(db('adminB'), 'clientes/a/usuarios')));
    await assertFails(getDoc(doc(db('adminB'), 'clientes/a/usuarios/socA')));
  });

  it('nadie escribe usuarios desde la app (solo Cloud Functions)', async () => {
    await assertFails(updateDoc(doc(db('adminA'), 'clientes/a/usuarios/socA'), { rol: 'admin' }));
    await assertFails(updateDoc(doc(db('socA'), 'clientes/a/usuarios/socA'), { rol: 'admin' }));
  });
});

describe('comunidades', () => {
  const nueva = (extra: Record<string, unknown> = {}) => ({
    nombre: 'Nueva',
    codigo: '99',
    ubicacion: new GeoPoint(40, -3),
    asignados: [],
    activa: true,
    createdAt: serverTimestamp(),
    ...extra,
  });

  it('un trabajador ve solo las comunidades que tiene asignadas', async () => {
    await assertSucceeds(
      getDocs(query(collection(db('socA'), 'clientes/a/comunidades'), where('asignados', 'array-contains', 'socA'))),
    );
    await assertSucceeds(getDoc(doc(db('socA'), 'clientes/a/comunidades/comA1')));
    await assertFails(getDoc(doc(db('socA'), 'clientes/a/comunidades/comA2')));
    await assertFails(getDocs(collection(db('socA'), 'clientes/a/comunidades')));
  });

  it('el admin ve todas las de su cliente y ninguna de otro', async () => {
    await assertSucceeds(getDocs(collection(db('adminA'), 'clientes/a/comunidades')));
    await assertFails(getDocs(collection(db('adminB'), 'clientes/a/comunidades')));
    await assertFails(getDoc(doc(db('adminB'), 'clientes/a/comunidades/comA1')));
  });

  it('el admin crea comunidades bien formadas', async () => {
    await assertSucceeds(addDoc(collection(db('adminA'), 'clientes/a/comunidades'), nueva()));
  });

  it('se rechazan comunidades mal formadas', async () => {
    const col = collection(db('adminA'), 'clientes/a/comunidades');
    await assertFails(addDoc(col, nueva({ asignados: ['socA'] })));
    await assertFails(addDoc(col, nueva({ extra: true })));
    await assertFails(addDoc(col, nueva({ ubicacion: '40, -3' })));
    await assertFails(addDoc(col, nueva({ nombre: '' })));
    await assertFails(addDoc(col, nueva({ createdAt: Timestamp.fromDate(new Date(2020, 0, 1)) })));
  });

  it('un trabajador no crea, edita ni borra comunidades', async () => {
    await assertFails(addDoc(collection(db('socA'), 'clientes/a/comunidades'), nueva()));
    await assertFails(updateDoc(doc(db('socA'), 'clientes/a/comunidades/comA1'), { nombre: 'X' }));
    await assertFails(deleteDoc(doc(db('socA'), 'clientes/a/comunidades/comA1')));
  });

  it('el admin edita datos pero no asignaciones', async () => {
    const ref = doc(db('adminA'), 'clientes/a/comunidades/comA1');
    await assertSucceeds(updateDoc(ref, { nombre: 'Renombrada', ubicacion: new GeoPoint(41, -4) }));
    await assertFails(updateDoc(ref, { asignados: ['adminA'] }));
  });

  it('un admin no toca comunidades de otro cliente', async () => {
    await assertFails(updateDoc(doc(db('adminB'), 'clientes/a/comunidades/comA1'), { nombre: 'X' }));
    await assertFails(deleteDoc(doc(db('adminB'), 'clientes/a/comunidades/comA1')));
    await assertFails(addDoc(collection(db('adminB'), 'clientes/a/comunidades'), nueva()));
  });

  it('el admin borra comunidades de su cliente', async () => {
    await assertSucceeds(deleteDoc(doc(db('adminA'), 'clientes/a/comunidades/comA2')));
  });
});

describe('imputaciones (fichajes)', () => {
  const col = (nombre: Parameters<typeof como>[1], cliente = 'a') =>
    collection(db(nombre), `clientes/${cliente}/imputaciones`);

  it('un trabajador ficha en una comunidad asignada', async () => {
    await assertSucceeds(addDoc(col('socA'), fichaje()));
    await assertSucceeds(addDoc(col('socA'), fichaje({ tipo: 'salida' })));
    await assertSucceeds(
      addDoc(col('maqA'), fichaje({ uid: 'maqA', usuarioNombre: 'Maquinista A' })),
    );
  });

  it('la hora la pone el servidor', async () => {
    await assertFails(addDoc(col('socA'), fichaje({ fecha: Timestamp.fromDate(new Date(2020, 0, 1)) })));
    await assertFails(addDoc(col('socA'), fichaje({ fecha: Timestamp.now() })));
  });

  it('no se puede fichar en una comunidad no asignada o inexistente', async () => {
    await assertFails(addDoc(col('socA'), fichaje({ comunidadId: 'comA2', comunidadNombre: 'Comunidad A2' })));
    await assertFails(addDoc(col('socA'), fichaje({ comunidadId: 'noExiste' })));
  });

  it('el admin puede fichar en cualquier comunidad de su cliente', async () => {
    await assertSucceeds(
      addDoc(col('adminA'), fichaje({ uid: 'adminA', usuarioNombre: 'Admin A', comunidadId: 'comA2', comunidadNombre: 'Comunidad A2' })),
    );
  });

  it('no se puede fichar en nombre de otro ni falsear nombres', async () => {
    await assertFails(addDoc(col('socA'), fichaje({ uid: 'maqA' })));
    await assertFails(addDoc(col('socA'), fichaje({ usuarioNombre: 'Otro' })));
    await assertFails(addDoc(col('socA'), fichaje({ comunidadNombre: 'Otra' })));
  });

  it('se valida la forma del fichaje', async () => {
    await assertFails(addDoc(col('socA'), fichaje({ tipo: 'pausa' })));
    await assertFails(addDoc(col('socA'), fichaje({ extra: 1 })));
    const { tipo: _tipo, ...sinTipo } = fichaje();
    await assertFails(addDoc(col('socA'), sinTipo));
  });

  it('un usuario desactivado no puede fichar', async () => {
    await assertFails(addDoc(col('bajaA'), fichaje({ uid: 'bajaA', usuarioNombre: 'Baja A' })));
  });

  it('nadie ficha en otro cliente', async () => {
    await assertFails(addDoc(col('socB', 'a'), fichaje({ uid: 'socB', usuarioNombre: 'Socorrista B' })));
    await assertFails(addDoc(collection(env.unauthenticatedContext().firestore(), 'clientes/a/imputaciones'), fichaje()));
  });

  it('un trabajador lee solo sus fichajes', async () => {
    await sembrarRegistros();
    await assertSucceeds(getDocs(query(col('socA'), where('uid', '==', 'socA'))));
    await assertSucceeds(getDoc(doc(db('socA'), 'clientes/a/imputaciones/impSoc')));
    await assertFails(getDoc(doc(db('socA'), 'clientes/a/imputaciones/impMaq')));
    await assertFails(getDocs(col('socA')));
  });

  it('el admin lee todos los de su cliente y ninguno de otro', async () => {
    await sembrarRegistros();
    await assertSucceeds(getDocs(col('adminA')));
    await assertFails(getDocs(col('adminB', 'a')));
  });

  it('nadie modifica fichajes; solo el admin los borra', async () => {
    await sembrarRegistros();
    await assertFails(updateDoc(doc(db('socA'), 'clientes/a/imputaciones/impSoc'), { tipo: 'salida' }));
    await assertFails(updateDoc(doc(db('adminA'), 'clientes/a/imputaciones/impSoc'), { tipo: 'salida' }));
    await assertFails(deleteDoc(doc(db('socA'), 'clientes/a/imputaciones/impSoc')));
    await assertFails(deleteDoc(doc(db('adminB'), 'clientes/a/imputaciones/impSoc')));
    await assertSucceeds(deleteDoc(doc(db('adminA'), 'clientes/a/imputaciones/impSoc')));
  });
});

describe('controlesAgua', () => {
  const ref = (nombre: Parameters<typeof como>[1], id = ID_CONTROL) =>
    doc(db(nombre), `clientes/a/controlesAgua/${id}`);

  it('un socorrista registra un control válido', async () => {
    await assertSucceeds(setDoc(ref('socA'), control(ID_CONTROL)));
  });

  it('un maquinista no puede registrar controles', async () => {
    await assertFails(
      setDoc(ref('maqA'), control(ID_CONTROL, {
        uid: 'maqA',
        usuarioNombre: 'Maquinista A',
        fotoPath: `clientes/a/controlesAgua/maqA/${ID_CONTROL}.jpg`,
      })),
    );
  });

  it('la foto tiene que estar en la carpeta del usuario y con el id del documento', async () => {
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { fotoPath: `clientes/a/controlesAgua/maqA/${ID_CONTROL}.jpg` })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { fotoPath: 'clientes/a/controlesAgua/socA/otro.jpg' })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { fotoPath: null })));
  });

  it('se validan los valores medidos', async () => {
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { cloro: -1 })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { ph: 15 })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { ph: '7.2' })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { banistas: 1.5 })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { rebosadero: -2 })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { aguaDepurada: 'mucha' })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { foto: 'base64...' })));
  });

  it('la comunidad tiene que estar asignada y la hora es del servidor', async () => {
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { comunidadId: 'comA2', comunidadNombre: 'Comunidad A2' })));
    await assertFails(setDoc(ref('socA'), control(ID_CONTROL, { fecha: Timestamp.now() })));
  });

  it('lecturas: el socorrista las suyas, el admin las de su cliente', async () => {
    await sembrarRegistros();
    const colA = (n: Parameters<typeof como>[1]) => collection(db(n), 'clientes/a/controlesAgua');
    await assertSucceeds(getDocs(query(colA('socA'), where('uid', '==', 'socA'))));
    await assertFails(getDocs(colA('socA')));
    await assertFails(getDoc(doc(db('maqA'), 'clientes/a/controlesAgua/ctlSoc')));
    await assertSucceeds(getDocs(colA('adminA')));
    await assertFails(getDocs(colA('adminB')));
  });

  it('nadie modifica controles; solo el admin los borra', async () => {
    await sembrarRegistros();
    await assertFails(updateDoc(ref('socA', 'ctlSoc'), { cloro: 2 }));
    await assertFails(deleteDoc(ref('socA', 'ctlSoc')));
    await assertSucceeds(deleteDoc(ref('adminA', 'ctlSoc')));
  });
});

describe('cualquier otra ruta', () => {
  it('está denegada', async () => {
    await assertFails(setDoc(doc(db('adminA'), 'otra/cosa'), { a: 1 }));
    await assertFails(getDoc(doc(db('adminA'), 'otra/cosa')));
  });
});
