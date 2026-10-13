// Da de alta un cliente nuevo (empresa) con su primer administrador. A partir
// de ahi, ese admin crea al resto de usuarios desde la app.
//
//   npx tsx scripts/crear-cliente.ts --proyecto <id> --id piscinas-norte \
//     --nombre "Piscinas Norte" --admin-usuario mgarcia --admin-nombre "María García" \
//     [--logo ruta/logo.png] [--color "#0e7490"] [--color-secundario "#164e63"]
//
// Con --emulador trabaja contra los emuladores locales.
// La contraseña del admin se genera al azar y se muestra UNA vez por consola.
//
// Para cambiar despues la marca (logo o colores) de un cliente existente,
// vuelve a ejecutarlo con el mismo --id: actualiza la marca y no toca los
// usuarios si el admin ya existe.

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { emailDeLogin, normalizarUsername } from '../functions/src/email-usuario';

const { values: a } = parseArgs({
  options: {
    proyecto: { type: 'string' },
    emulador: { type: 'boolean', default: false },
    id: { type: 'string' },
    nombre: { type: 'string' },
    'admin-usuario': { type: 'string' },
    'admin-nombre': { type: 'string' },
    logo: { type: 'string' },
    color: { type: 'string', default: '#0e7490' },
    'color-secundario': { type: 'string', default: '#164e63' },
  },
});

function fallar(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const id = a.id ?? fallar('Falta --id (minúsculas, números y guiones, p. ej. piscinas-norte)');
if (!/^[a-z0-9-]{2,40}$/.test(id)) fallar('--id solo admite minúsculas, números y guiones (2-40).');
if (!a.emulador && !a.proyecto) fallar('Indica --proyecto <id-firebase> o --emulador.');
for (const color of [a.color!, a['color-secundario']!]) {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) fallar(`Color no válido: ${color} (formato #rrggbb)`);
}

if (a.emulador) {
  process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';
  process.env['FIREBASE_STORAGE_EMULATOR_HOST'] ??= '127.0.0.1:9199';
}
const projectId = a.emulador ? 'demo-timereport' : a.proyecto!;
initializeApp({
  projectId,
  storageBucket: a.emulador ? 'demo-timereport.appspot.com' : `${projectId}.firebasestorage.app`,
});

async function main() {
  const db = getFirestore();
  const ref = db.doc(`clientes/${id}`);
  const existe = (await ref.get()).exists;

  let logoPath = existe ? ((await ref.get()).get('branding.logoPath') as string) ?? '' : '';
  if (a.logo) {
    const ext = extname(a.logo).toLowerCase();
    const tipos: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
    if (!tipos[ext]) fallar('El logo tiene que ser PNG, JPG, SVG o WebP.');
    logoPath = `clientes/${id}/branding/logo${ext}`;
    await getStorage().bucket().file(logoPath).save(readFileSync(resolve(a.logo)), { contentType: tipos[ext] });
  }

  const branding = {
    nombreApp: 'TimeReport',
    logoPath,
    colorPrimario: a.color!,
    colorSecundario: a['color-secundario']!,
  };
  if (existe) {
    await ref.update({ branding, ...(a.nombre ? { nombre: a.nombre } : {}) });
    console.log(`Cliente ${id}: marca actualizada.`);
  } else {
    if (!a.nombre) fallar('Falta --nombre para un cliente nuevo.');
    await ref.set({
      nombre: a.nombre,
      activo: true,
      branding,
      config: { radioFichajeM: 1000, maxFichajesDia: 2 },
    });
    console.log(`Cliente ${id} creado.`);
  }

  const usuario = a['admin-usuario'];
  if (!usuario) return;
  const email = emailDeLogin(usuario, id);
  const auth = getAuth();
  const yaExiste = await auth.getUserByEmail(email).then(() => true, () => false);
  if (yaExiste) {
    console.log(`El admin ${usuario} ya existe; no se toca.`);
    return;
  }
  const nombre = a['admin-nombre'] ?? usuario;
  const password = randomBytes(9).toString('base64url');
  const { uid } = await auth.createUser({ email, password, displayName: nombre });
  await auth.setCustomUserClaims(uid, { clienteId: id, rol: 'admin' });
  await db.doc(`clientes/${id}/usuarios/${uid}`).set({
    nombre,
    username: usuario.includes('@') ? '' : normalizarUsername(usuario),
    email,
    rol: 'admin',
    activo: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log('\nAdministrador creado. Pásale estos datos por un canal seguro:');
  console.log(`  Enlace:     https://claudiusava.github.io/timereport/#/c/${id}`);
  console.log(`  Usuario:    ${usuario}`);
  console.log(`  Contraseña: ${password}   (puede cambiarla otro admin desde Usuarios)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
