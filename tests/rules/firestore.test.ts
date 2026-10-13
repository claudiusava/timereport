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

import { ID_CONTROL, NombreUsuario, como, controlAgua, crearEntorno, sembrar } from './entorno';

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

const db = (nombre: NombreUsuario) => como(env, nombre).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

describe('clientes', () => {
  it('cualquiera puede leer la marca de una empresa', async () => {
    await assertSucceeds(getDoc(doc(anonimo(), 'clientes/a')));
  });

  it('nadie puede listar las empresas', async () => {
    await assertFails(getDocs(collection(anonimo(), 'clientes')));
    await assertFails(getDocs(collection(db('adminA'), 'clientes')));
  });

  it('ni un admin puede modificar la empresa directamente (va por Cloud Function)', async () => {
    await assertFails(updateDoc(doc(db('adminA'), 'clientes/a'), { nombre: 'X' }));
  });
});

describe('usuarios', () => {
  it('un trabajador lee su propio perfil y no el de otros', async () => {
    await assertSucceeds(getDoc(doc(db('socA'), 'clientes/a/usuarios/socA')));
    await assertFails(getDoc(doc(db('socA'), 'clientes/a/usuarios/maqA')));
    await assertFails(getDocs(collection(db('socA'), 'clientes/a/usuarios')));
  });

  it('el admin lista los usuarios de su empresa y no los de otra', async () => {
    await assertSucceeds(getDocs(collection(db('adminA'), 'clientes/a/usuarios')));
    await assertFails(getDocs(collection(db('adminB'), 'clientes/a/usuarios')));
    await assertFails(getDoc(doc(db('adminB'), 'clientes/a/usuarios/socA')));
  });

  it('un admin desactivado o degradado pierde el acceso aunque su token diga admin', async () => {
    await assertFails(getDocs(collection(db('adminBaja'), 'clientes/a/usuarios')));
    await assertFails(getDocs(collection(db('degradado'), 'clientes/a/usuarios')));
    await assertFails(getDocs(collection(db('adminBaja'), 'clientes/a/imputaciones')));
    await assertFails(getDocs(collection(db('degradado'), 'clientes/a/auditoria')));
  });

  it('nadie escribe usuarios desde la app (solo Cloud Functions)', async () => {
    await assertFails(updateDoc(doc(db('adminA'), 'clientes/a/usuarios/socA'), { rol: 'admin' }));
    await assertFails(updateDoc(doc(db('socA'), 'clientes/a/usuarios/socA'), { rol: 'admin' }));
  });

  it('sin sesión no se lee nada', async () => {
    await assertFails(getDoc(doc(anonimo(), 'clientes/a/usuarios/socA')));
    await assertFails(getDocs(collection(anonimo(), 'clientes/a/comunidades')));
    await assertFails(getDocs(collection(anonimo(), 'clientes/a/imputaciones')));
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

  it('el admin ve todas las de su empresa y ninguna de otra', async () => {
    await assertSucceeds(getDocs(collection(db('adminA'), 'clientes/a/comunidades')));
    await assertFails(getDocs(collection(db('adminB'), 'clientes/a/comunidades')));
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

  it('una empresa inactiva no puede crear comunidades', async () => {
    await assertFails(addDoc(collection(db('adminC'), 'clientes/c/comunidades'), nueva()));
  });

  it('un trabajador o un admin degradado no gestionan comunidades', async () => {
    await assertFails(addDoc(collection(db('socA'), 'clientes/a/comunidades'), nueva()));
    await assertFails(addDoc(collection(db('degradado'), 'clientes/a/comunidades'), nueva()));
    await assertFails(updateDoc(doc(db('socA'), 'clientes/a/comunidades/comA1'), { nombre: 'X' }));
    await assertFails(deleteDoc(doc(db('adminBaja'), 'clientes/a/comunidades/comA1')));
  });

  it('el admin edita datos y estado pero no asignaciones', async () => {
    const ref = doc(db('adminA'), 'clientes/a/comunidades/comA1');
    await assertSucceeds(updateDoc(ref, { nombre: 'Renombrada', ubicacion: new GeoPoint(41, -4), activa: false }));
    await assertFails(updateDoc(ref, { asignados: ['adminA'] }));
  });

  it('un admin no toca comunidades de otra empresa', async () => {
    await assertFails(updateDoc(doc(db('adminB'), 'clientes/a/comunidades/comA1'), { nombre: 'X' }));
    await assertFails(deleteDoc(doc(db('adminB'), 'clientes/a/comunidades/comA1')));
  });

  it('el admin borra comunidades de su empresa', async () => {
    await assertSucceeds(deleteDoc(doc(db('adminA'), 'clientes/a/comunidades/comA2')));
  });
});

describe('imputaciones (fichajes)', () => {
  const col = (nombre: NombreUsuario, cliente = 'a') => collection(db(nombre), `clientes/${cliente}/imputaciones`);
  const fichaje = {
    uid: 'socA',
    usuarioNombre: 'Socorrista A',
    comunidadId: 'comA1',
    comunidadNombre: 'Comunidad A1',
    tipo: 'entrada',
    fecha: serverTimestamp(),
  };

  it('nadie crea fichajes desde la app: solo la Cloud Function fichar', async () => {
    await assertFails(addDoc(col('socA'), fichaje));
    await assertFails(addDoc(col('adminA'), { ...fichaje, uid: 'adminA', usuarioNombre: 'Admin A' }));
  });

  it('nadie modifica ni borra fichajes, ni siquiera el admin', async () => {
    for (const quien of ['socA', 'adminA'] as const) {
      await assertFails(updateDoc(doc(db(quien), 'clientes/a/imputaciones/impSoc'), { tipo: 'salida' }));
      await assertFails(deleteDoc(doc(db(quien), 'clientes/a/imputaciones/impSoc')));
    }
  });

  it('un trabajador lee solo sus fichajes', async () => {
    await assertSucceeds(getDocs(query(col('socA'), where('uid', '==', 'socA'))));
    await assertSucceeds(getDoc(doc(db('socA'), 'clientes/a/imputaciones/impSoc')));
    await assertFails(getDoc(doc(db('socA'), 'clientes/a/imputaciones/impMaq')));
    await assertFails(getDocs(col('socA')));
  });

  it('el admin lee todos los de su empresa y ninguno de otra', async () => {
    await assertSucceeds(getDocs(col('adminA')));
    await assertFails(getDocs(col('adminB', 'a')));
  });
});

describe('controlesAgua', () => {
  const ref = (nombre: NombreUsuario, id = ID_CONTROL) => doc(db(nombre), `clientes/a/controlesAgua/${id}`);
  const nuevo = (extra: Record<string, unknown> = {}) => ({ ...controlAgua(ID_CONTROL), fecha: serverTimestamp(), ...extra });

  it('un socorrista registra un control válido', async () => {
    await assertSucceeds(setDoc(ref('socA'), nuevo()));
  });

  it('un maquinista, un usuario de baja o un admin degradado no pueden', async () => {
    await assertFails(setDoc(ref('maqA'), nuevo({ uid: 'maqA', usuarioNombre: 'Maquinista A', fotoPath: `clientes/a/controlesAgua/maqA/${ID_CONTROL}.jpg` })));
    await assertFails(setDoc(ref('bajaA'), nuevo({ uid: 'bajaA', usuarioNombre: 'Baja A', fotoPath: `clientes/a/controlesAgua/bajaA/${ID_CONTROL}.jpg` })));
  });

  it('la foto tiene que estar en la carpeta del usuario y con el id del documento', async () => {
    await assertFails(setDoc(ref('socA'), nuevo({ fotoPath: `clientes/a/controlesAgua/maqA/${ID_CONTROL}.jpg` })));
    await assertFails(setDoc(ref('socA'), nuevo({ fotoPath: 'clientes/a/controlesAgua/socA/otro.jpg' })));
    await assertFails(setDoc(ref('socA'), nuevo({ fotoPath: null })));
  });

  it('se validan los valores medidos y no se puede nacer anulado', async () => {
    await assertFails(setDoc(ref('socA'), nuevo({ cloro: -1 })));
    await assertFails(setDoc(ref('socA'), nuevo({ ph: 15 })));
    await assertFails(setDoc(ref('socA'), nuevo({ ph: '7.2' })));
    await assertFails(setDoc(ref('socA'), nuevo({ banistas: 1.5 })));
    await assertFails(setDoc(ref('socA'), nuevo({ rebosadero: -2 })));
    await assertFails(setDoc(ref('socA'), nuevo({ aguaDepurada: 'mucha' })));
    await assertFails(setDoc(ref('socA'), nuevo({ foto: 'base64...' })));
    await assertFails(setDoc(ref('socA'), nuevo({ anulado: { motivo: 'x' } })));
  });

  it('el autor, la comunidad y la hora tienen que ser los correctos', async () => {
    await assertFails(setDoc(ref('socA'), nuevo({ usuarioNombre: 'Otro' })));
    await assertFails(setDoc(ref('socA'), nuevo({ comunidadId: 'comA2', comunidadNombre: 'Comunidad A2' })));
    await assertFails(setDoc(ref('socA'), nuevo({ comunidadId: 'comA3', comunidadNombre: 'Comunidad A3' })));
    await assertFails(setDoc(ref('socA'), nuevo({ comunidadNombre: 'Otra' })));
    await assertFails(setDoc(ref('socA'), nuevo({ fecha: Timestamp.now() })));
  });

  it('lecturas: el socorrista las suyas, el admin las de su empresa', async () => {
    const colA = (n: NombreUsuario) => collection(db(n), 'clientes/a/controlesAgua');
    await assertSucceeds(getDocs(query(colA('socA'), where('uid', '==', 'socA'))));
    await assertFails(getDocs(colA('socA')));
    await assertFails(getDoc(doc(db('maqA'), 'clientes/a/controlesAgua/ctlSoc')));
    await assertSucceeds(getDocs(colA('adminA')));
    await assertFails(getDocs(colA('adminB')));
  });

  it('nadie modifica ni borra controles (se anulan con la Cloud Function)', async () => {
    await assertFails(updateDoc(ref('socA', 'ctlSoc'), { cloro: 2 }));
    await assertFails(updateDoc(ref('adminA', 'ctlSoc'), { anulado: { motivo: 'x' } }));
    await assertFails(deleteDoc(ref('socA', 'ctlSoc')));
    await assertFails(deleteDoc(ref('adminA', 'ctlSoc')));
  });
});

describe('auditoría', () => {
  it('la lee el admin y nadie la escribe ni la borra', async () => {
    await assertSucceeds(getDocs(collection(db('adminA'), 'clientes/a/auditoria')));
    await assertFails(getDocs(collection(db('socA'), 'clientes/a/auditoria')));
    await assertFails(getDocs(collection(db('adminB'), 'clientes/a/auditoria')));
    await assertFails(addDoc(collection(db('adminA'), 'clientes/a/auditoria'), { accion: 'x' }));
    await assertFails(deleteDoc(doc(db('adminA'), 'clientes/a/auditoria/aud1')));
  });
});

describe('cualquier otra ruta', () => {
  it('está denegada', async () => {
    await assertFails(setDoc(doc(db('adminA'), 'otra/cosa'), { a: 1 }));
    await assertFails(getDoc(doc(db('adminA'), 'otra/cosa')));
  });
});
