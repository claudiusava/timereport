import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc } from 'firebase/firestore';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { ID_CONTROL, NombreUsuario, como, controlAgua, crearEntorno, sembrar } from './entorno';

let env: RulesTestEnvironment;

const JPEG = { contentType: 'image/jpeg' };
const foto = (bytes = 1024) => new Uint8Array(bytes);
const rutaFoto = (uid: string, archivo = `${ID_CONTROL}.jpg`, cliente = 'a') =>
  `clientes/${cliente}/controlesAgua/${uid}/${archivo}`;
const EXISTENTE_ID = 'existente01234567890';
const EXISTENTE = rutaFoto('socA', `${EXISTENTE_ID}.jpg`);

beforeAll(async () => {
  env = await crearEntorno();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await sembrar(env);
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    // Documentos de Firestore que respaldan las fotos (la regla los consulta).
    await setDoc(doc(ctx.firestore(), `clientes/a/controlesAgua/${ID_CONTROL}`), { ...controlAgua(ID_CONTROL), fecha: Timestamp.now() });
    await setDoc(doc(ctx.firestore(), `clientes/a/controlesAgua/${EXISTENTE_ID}`), { ...controlAgua(EXISTENTE_ID), fecha: Timestamp.now() });
    await uploadBytes(ref(ctx.storage(), EXISTENTE), foto(), JPEG);
    await uploadBytes(ref(ctx.storage(), 'clientes/a/branding/logo-1700000000000.png'), foto(), { contentType: 'image/png' });
  });
});

const storage = (nombre: NombreUsuario) => como(env, nombre).storage();

describe('fotos de controles de agua', () => {
  it('el autor sube la foto del control que acaba de crear', async () => {
    await assertSucceeds(uploadBytes(ref(storage('socA'), rutaFoto('socA')), foto(), JPEG));
  });

  it('no se puede subir una foto sin su control en Firestore', async () => {
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('socA', 'SinDocumento12345678.jpg')), foto(), JPEG));
  });

  it('no se puede subir a la carpeta de otro ni a otra empresa', async () => {
    await assertFails(uploadBytes(ref(storage('maqA'), rutaFoto('socA')), foto(), JPEG));
    await assertFails(uploadBytes(ref(storage('adminA'), rutaFoto('socA')), foto(), JPEG));
    await assertFails(uploadBytes(ref(storage('socB'), rutaFoto('socA')), foto(), JPEG));
  });

  it('solo JPEG de hasta 5 MB y con nombre de id de documento', async () => {
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('socA')), foto(), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('socA')), foto(5 * 1024 * 1024 + 1), JPEG));
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('socA', 'foto.jpg')), foto(), JPEG));
  });

  it('no se puede sobrescribir una foto existente', async () => {
    await assertFails(uploadBytes(ref(storage('socA'), EXISTENTE), foto(), JPEG));
  });

  it('lectura: el autor y el admin activo de su empresa', async () => {
    await assertSucceeds(getBytes(ref(storage('socA'), EXISTENTE)));
    await assertSucceeds(getBytes(ref(storage('adminA'), EXISTENTE)));
    await assertFails(getBytes(ref(storage('maqA'), EXISTENTE)));
    await assertFails(getBytes(ref(storage('adminB'), EXISTENTE)));
    await assertFails(getBytes(ref(storage('adminBaja'), EXISTENTE)));
    await assertFails(getBytes(ref(storage('degradado'), EXISTENTE)));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), EXISTENTE)));
  });

  it('nadie borra fotos (los controles se anulan)', async () => {
    await assertFails(deleteObject(ref(storage('socA'), EXISTENTE)));
    await assertFails(deleteObject(ref(storage('adminA'), EXISTENTE)));
  });
});

describe('logo de la empresa', () => {
  const LOGO = 'clientes/a/branding/logo-1700000000000.png';

  it('es público', async () => {
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), LOGO)));
  });

  it('lo sube el admin activo: imagen de hasta 1 MB con nombre logo-<marca de tiempo>', async () => {
    const nuevo = 'clientes/a/branding/logo-1800000000000.png';
    await assertSucceeds(uploadBytes(ref(storage('adminA'), nuevo), foto(), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage('adminA'), 'clientes/a/branding/logo-1800000000001.svg'), foto(), { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(storage('adminA'), 'clientes/a/branding/logo-1800000000002.png'), foto(1024 * 1024 + 1), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage('adminA'), LOGO), foto(), { contentType: 'image/png' }));
  });

  it('ni trabajadores, ni admins degradados, ni otras empresas', async () => {
    const nuevo = 'clientes/a/branding/logo-1800000000003.png';
    await assertFails(uploadBytes(ref(storage('socA'), nuevo), foto(), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage('degradado'), nuevo), foto(), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage('adminB'), nuevo), foto(), { contentType: 'image/png' }));
  });
});

describe('cualquier otra ruta', () => {
  it('está denegada', async () => {
    await assertFails(uploadBytes(ref(storage('adminA'), 'otra/cosa.jpg'), foto(), JPEG));
  });
});
