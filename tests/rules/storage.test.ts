import {
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

import { como, crearEntorno } from './entorno';

let env: RulesTestEnvironment;

const ID = 'AbCdEfGhIjKlMnOpQrSt';
const JPEG = { contentType: 'image/jpeg' };
const foto = (bytes = 1024) => new Uint8Array(bytes);
const rutaFoto = (uid: string, archivo = `${ID}.jpg`, cliente = 'a') =>
  `clientes/${cliente}/controlesAgua/${uid}/${archivo}`;

beforeAll(async () => {
  env = await crearEntorno();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await uploadBytes(ref(ctx.storage(), rutaFoto('socA', 'existente01234567890.jpg')), foto(), JPEG);
    await uploadBytes(ref(ctx.storage(), 'clientes/a/branding/logo.png'), foto(), { contentType: 'image/png' });
  });
});

const storage = (nombre: Parameters<typeof como>[1]) => como(env, nombre).storage();
const EXISTENTE = rutaFoto('socA', 'existente01234567890.jpg');

describe('fotos de controles de agua', () => {
  it('un socorrista sube una foto JPEG a su carpeta', async () => {
    await assertSucceeds(uploadBytes(ref(storage('socA'), rutaFoto('socA')), foto(), JPEG));
  });

  it('no puede subir a la carpeta de otro ni a otro cliente', async () => {
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('maqA')), foto(), JPEG));
    await assertFails(uploadBytes(ref(storage('socB'), rutaFoto('socB')), foto(), JPEG));
  });

  it('un maquinista no puede subir fotos', async () => {
    await assertFails(uploadBytes(ref(storage('maqA'), rutaFoto('maqA')), foto(), JPEG));
  });

  it('solo JPEG de hasta 5 MB y con nombre de id de documento', async () => {
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('socA')), foto(), { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('socA')), foto(5 * 1024 * 1024 + 1), JPEG));
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('socA', 'foto.jpg')), foto(), JPEG));
    await assertFails(uploadBytes(ref(storage('socA'), rutaFoto('socA', `${ID}.exe`)), foto(), JPEG));
  });

  it('no se puede sobrescribir una foto existente', async () => {
    await assertFails(uploadBytes(ref(storage('socA'), EXISTENTE), foto(), JPEG));
  });

  it('lectura: el propio usuario y el admin de su cliente', async () => {
    await assertSucceeds(getBytes(ref(storage('socA'), EXISTENTE)));
    await assertSucceeds(getBytes(ref(storage('adminA'), EXISTENTE)));
    await assertFails(getBytes(ref(storage('maqA'), EXISTENTE)));
    await assertFails(getBytes(ref(storage('adminB'), EXISTENTE)));
    await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), EXISTENTE)));
  });

  it('solo el admin de su cliente borra fotos', async () => {
    await assertFails(deleteObject(ref(storage('socA'), EXISTENTE)));
    await assertFails(deleteObject(ref(storage('adminB'), EXISTENTE)));
    await assertSucceeds(deleteObject(ref(storage('adminA'), EXISTENTE)));
  });
});

describe('logo del cliente', () => {
  it('es público pero nadie lo cambia desde la app', async () => {
    await assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), 'clientes/a/branding/logo.png')));
    await assertFails(
      uploadBytes(ref(storage('adminA'), 'clientes/a/branding/logo.png'), foto(), { contentType: 'image/png' }),
    );
  });
});

describe('cualquier otra ruta', () => {
  it('está denegada', async () => {
    await assertFails(uploadBytes(ref(storage('adminA'), 'otra/cosa.jpg'), foto(), JPEG));
  });
});
