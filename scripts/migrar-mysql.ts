// Migra el volcado MySQL de la app antigua (Heroku) a Firestore, Storage y
// Firebase Auth, bajo un cliente (por defecto "simasport").
//
// Uso:
//   npx tsx scripts/migrar-mysql.ts --dump docs/privado/export-heroku.sql            (simulacro: no escribe nada)
//   npx tsx scripts/migrar-mysql.ts --dump ... --emulador --aplicar                  (contra los emuladores)
//   npx tsx scripts/migrar-mysql.ts --dump ... --proyecto <id> --aplicar             (PRODUCCION)
//
// En produccion las credenciales salen de GOOGLE_APPLICATION_CREDENTIALS (la
// clave de una cuenta de servicio, que se guarda en docs/privado/ y se borra
// al terminar).
//
// Es repetible: usa ids deterministas (simasport_<id de MySQL>), asi que
// ejecutarlo dos veces sobrescribe en vez de duplicar.
//
// El informe con los detalles (incluye nombres) se escribe en docs/privado/.

import { initializeApp } from 'firebase-admin/app';
import { UserImportRecord, getAuth } from 'firebase-admin/auth';
import { FieldValue, GeoPoint, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { emailDeLogin, normalizarUsername } from '../functions/src/email-usuario';
import { Valor, filasComoObjetos, parsearDump } from './migracion/sql-dump';

type Rol = 'admin' | 'socorrista' | 'maquinista';
type Fila = Record<string, Valor>;

const { values: args } = parseArgs({
  options: {
    dump: { type: 'string' },
    cliente: { type: 'string', default: 'simasport' },
    'nombre-cliente': { type: 'string', default: 'Simasport' },
    logo: { type: 'string', default: 'scripts/assets/logo-simasport.png' },
    emulador: { type: 'boolean', default: false },
    proyecto: { type: 'string' },
    aplicar: { type: 'boolean', default: false },
  },
});

if (!args.dump) {
  console.error('Falta --dump <fichero.sql>');
  process.exit(1);
}
const CLIENTE = args.cliente!;
const ZONA = 'Europe/Madrid';

const informe: string[] = [];
const anotar = (linea: string) => informe.push(linea);

// ---------------------------------------------------------------- lectura

const dump = parsearDump(readFileSync(resolve(args.dump), 'utf8'));
for (const a of dump.avisos) anotar(`⚠ ${a}`);
if (!dump.fechasEnUtc) {
  anotar('⚠ El volcado no fija TIME_ZONE=+00:00: se asume que las fechas están en UTC.');
}

const users = filasComoObjetos(dump, 'users');
const comunidadesSql = filasComoObjetos(dump, 'comunidades');
const asignacionesSql = filasComoObjetos(dump, 'asignacioncomunidades');
const imputacionesSql = filasComoObjetos(dump, 'imputaciones');
const controlesSql = filasComoObjetos(dump, 'controlagua');

const texto = (v: Valor) => (v === null || v === undefined ? '' : String(v).trim());
const numero = (v: Valor) => (v === null ? NaN : Number(String(v).replace(',', '.')));
const fechaUtc = (v: Valor): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(texto(v));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null;
};
const clave = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- usuarios

interface UsuarioMigrado {
  idMysql: number;
  uid: string;
  nombre: string;
  username: string;
  email: string;
  rol: Rol;
  hash: string | null;
}

const usuarios = new Map<number, UsuarioMigrado>();
const emailsUsados = new Map<string, number>();

for (const u of users) {
  const idMysql = Number(u['id']);
  const original = texto(u['username']);
  let username = normalizarUsername(original);
  if (!username) {
    username = `usuario${idMysql}`;
    anotar(`Usuario ${idMysql} ("${original}"): nombre de usuario vacío o no válido → "${username}".`);
  }
  let email = emailDeLogin(username, CLIENTE);
  if (emailsUsados.has(email)) {
    const nuevo = `${username}${idMysql}`;
    anotar(
      `Usuario ${idMysql} ("${original}") choca con el usuario ${emailsUsados.get(email)} al normalizar → entrará como "${nuevo}".`,
    );
    username = nuevo;
    email = emailDeLogin(username, CLIENTE);
  } else if (original !== username) {
    anotar(`Usuario ${idMysql}: "${original}" entrará como "${username}" (también vale escribirlo como antes).`);
  }
  emailsUsados.set(email, idMysql);

  const rol: Rol =
    Number(u['permisoDeAdministracion']) === 1
      ? 'admin'
      : Number(u['socorrista']) === 1
        ? 'socorrista'
        : 'maquinista';
  const hash = texto(u['password']);
  const hashValido = /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
  if (!hashValido) {
    anotar(`Usuario ${idMysql} ("${original}"): contraseña sin hash bcrypt válido → habrá que restablecerla desde la app.`);
  }
  usuarios.set(idMysql, {
    idMysql,
    uid: `${CLIENTE}_${idMysql}`,
    nombre: texto(u['fullname']) || original || username,
    username,
    email,
    rol,
    hash: hashValido ? hash : null,
  });
}

// ---------------------------------------------------------------- comunidades

interface ComunidadMigrada {
  id: string;
  nombre: string;
  codigo: string;
  ubicacion: GeoPoint | null;
  asignados: Set<string>;
}

const comunidades = new Map<string, ComunidadMigrada>();
const porCodigo = new Map<string, ComunidadMigrada[]>();
const porNombre = new Map<string, ComunidadMigrada>();

for (const c of comunidadesSql) {
  const nombre = texto(c['nombre']);
  const codigo = texto(c['codigo']);
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(texto(c['coordenadas']));
  const lat = m ? Number(m[1]) : NaN;
  const lng = m ? Number(m[2]) : NaN;
  const ubicacion =
    m && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? new GeoPoint(lat, lng) : null;
  if (!ubicacion) {
    anotar(`Comunidad "${nombre}" (${codigo}): coordenadas no válidas ("${texto(c['coordenadas'])}") → sin ubicación; no se podrá fichar hasta corregirlas.`);
  }
  const com: ComunidadMigrada = {
    id: `m${c['id']}`,
    nombre,
    codigo,
    ubicacion,
    asignados: new Set(),
  };
  comunidades.set(com.id, com);
  porCodigo.set(codigo, [...(porCodigo.get(codigo) ?? []), com]);
  if (porNombre.has(clave(nombre))) {
    anotar(`Comunidad "${nombre}": nombre repetido; los registros antiguos con ese nombre se asocian a la primera.`);
  } else {
    porNombre.set(clave(nombre), com);
  }
}
for (const [codigo, lista] of porCodigo) {
  if (lista.length > 1) anotar(`Código de comunidad ${codigo} repetido en: ${lista.map((c) => c.nombre).join(', ')}.`);
}

let asignacionesSinDestino = 0;
for (const a of asignacionesSql) {
  const u = usuarios.get(Number(a['user_id']));
  const coms = porCodigo.get(texto(a['codigo']));
  if (!u || !coms) {
    asignacionesSinDestino++;
    continue;
  }
  // Los admins ven todas las comunidades: no se les asigna nada.
  if (u.rol !== 'admin') for (const c of coms) c.asignados.add(u.uid);
}
if (asignacionesSinDestino) {
  anotar(`${asignacionesSinDestino} asignaciones apuntaban a usuarios o comunidades que ya no existen (se ignoran).`);
}

function comunidadPorNombre(nombre: string, contexto: string) {
  const c = porNombre.get(clave(nombre));
  if (!c) sinComunidad.set(nombre, (sinComunidad.get(nombre) ?? 0) + 1);
  else if (c.nombre !== nombre) renombradas.add(`"${nombre}" → "${c.nombre}" (${contexto})`);
  return c;
}
const sinComunidad = new Map<string, number>();
const renombradas = new Set<string>();

// ---------------------------------------------------------------- imputaciones

interface ImputacionMigrada {
  id: string;
  datos: Record<string, unknown>;
}

const partesMadrid = new Intl.DateTimeFormat('es-ES', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const imputaciones: ImputacionMigrada[] = [];
let tiposDeducidos = 0;
let desfases = 0;
let imputacionesDescartadas = 0;

const ordenadas = [...imputacionesSql].sort(
  (a, b) => (fechaUtc(a['created_at'])?.getTime() ?? 0) - (fechaUtc(b['created_at'])?.getTime() ?? 0),
);
const ultimoTipo = new Map<string, { dia: string; tipo: string }>();

for (const i of ordenadas) {
  const u = usuarios.get(Number(i['user_id']));
  const fecha = fechaUtc(i['created_at']);
  if (!u || !fecha) {
    imputacionesDescartadas++;
    continue;
  }
  const local = partesMadrid.format(fecha).replace(',', '');
  const [diaLocal, horaLocal] = local.split(' ');

  // Comprobacion: la hora que guardaba el movil frente a la del servidor.
  const horaMovil = `${String(i['horas']).padStart(2, '0')}:${String(i['minutos']).padStart(2, '0')}`;
  if (texto(i['fecha']) && (texto(i['fecha']) !== diaLocal || minutosEntre(horaMovil, horaLocal) > 5)) {
    desfases++;
  }

  let tipo: 'entrada' | 'salida';
  if (i['isEntrada'] === 1 || i['isEntrada'] === 0) {
    tipo = i['isEntrada'] === 1 ? 'entrada' : 'salida';
  } else {
    // Registros muy antiguos sin tipo: se alterna entrada/salida en el dia.
    const previo = ultimoTipo.get(u.uid);
    tipo = previo && previo.dia === diaLocal && previo.tipo === 'entrada' ? 'salida' : 'entrada';
    tiposDeducidos++;
  }
  ultimoTipo.set(u.uid, { dia: diaLocal, tipo });

  const nombreComunidad = texto(i['comunidad']);
  const com = comunidadPorNombre(nombreComunidad, 'fichajes');
  imputaciones.push({
    id: `m${i['id']}`,
    datos: {
      uid: u.uid,
      usuarioNombre: u.nombre,
      comunidadId: com?.id ?? '',
      comunidadNombre: com?.nombre ?? nombreComunidad,
      tipo,
      fecha: Timestamp.fromDate(fecha),
    },
  });
}
if (imputacionesDescartadas) anotar(`${imputacionesDescartadas} fichajes sin usuario o sin fecha válida (se descartan).`);
if (tiposDeducidos) anotar(`${tiposDeducidos} fichajes antiguos sin tipo: se ha deducido entrada/salida alternando en el día.`);
if (desfases) anotar(`${desfases} fichajes con más de 5 min de diferencia entre la hora del móvil y la del servidor (se usa la del servidor).`);

function minutosEntre(a: string, b: string) {
  const [ha, ma] = a.split(':').map(Number);
  const [hb, mb] = b.split(':').map(Number);
  return Math.abs(ha * 60 + ma - (hb * 60 + mb));
}

// ---------------------------------------------------------------- controles de agua

interface ControlMigrado {
  id: string;
  uid: string;
  datos: Record<string, unknown>;
  foto: { bytes: Buffer; tipo: string; ext: string } | null;
}

const controles: ControlMigrado[] = [];
let controlesDescartados = 0;
let fotosNoReconocidas = 0;

for (const c of controlesSql) {
  const u = usuarios.get(Number(c['user_id']));
  const fecha = fechaUtc(c['created_at']);
  if (!u || !fecha) {
    controlesDescartados++;
    continue;
  }
  const piscina = texto(c['piscina']);
  const com = comunidadPorNombre(piscina, 'controles de agua');
  const id = `m${c['id']}`;

  let foto: ControlMigrado['foto'] = null;
  const blob = c['foto'];
  if (Buffer.isBuffer(blob) && blob.length) {
    const tipo = tipoImagen(blob);
    if (tipo) foto = { bytes: blob, ...tipo };
    else fotosNoReconocidas++;
  }

  controles.push({
    id,
    uid: u.uid,
    foto,
    datos: {
      uid: u.uid,
      usuarioNombre: u.nombre,
      comunidadId: com?.id ?? '',
      comunidadNombre: com?.nombre ?? piscina,
      cloro: numeroOCero(c['nivelCloro'], `control ${c['id']} cloro`),
      ph: numeroOCero(c['nivelPh'], `control ${c['id']} pH`),
      banistas: Math.round(numeroOCero(c['numeroBanistas'], `control ${c['id']} bañistas`)),
      rebosadero: Math.round(numeroOCero(c['nivelRebosadero'], `control ${c['id']} rebosadero`)),
      aguaDepurada: numeroOCero(c['aguaDepurada'], `control ${c['id']} agua depurada`),
      fotoPath: foto ? `clientes/${CLIENTE}/controlesAgua/${u.uid}/${id}.${foto.ext}` : null,
      fecha: Timestamp.fromDate(fecha),
    },
  });
}
if (controlesDescartados) anotar(`${controlesDescartados} controles de agua sin usuario o sin fecha (se descartan).`);
if (fotosNoReconocidas) anotar(`${fotosNoReconocidas} fotos con formato no reconocido (se importan sin foto).`);

function numeroOCero(v: Valor, campo: string) {
  const n = numero(v);
  if (Number.isFinite(n)) return n;
  anotar(`Valor no numérico en ${campo}: "${texto(v)}" → 0.`);
  return 0;
}

function tipoImagen(b: Buffer): { tipo: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8) return { tipo: 'image/jpeg', ext: 'jpg' };
  if (b.subarray(0, 4).toString('hex') === '89504e47') return { tipo: 'image/png', ext: 'png' };
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') {
    return { tipo: 'image/webp', ext: 'webp' };
  }
  if (b.subarray(0, 3).toString('latin1') === 'GIF') return { tipo: 'image/gif', ext: 'gif' };
  return null;
}

for (const [nombre, n] of sinComunidad) {
  anotar(`"${nombre}": ${n} registros con una comunidad que ya no existe (se conserva el nombre, sin enlace).`);
}
for (const r of renombradas) anotar(`Nombre de comunidad emparejado sin distinguir mayúsculas/acentos: ${r}.`);

// ---------------------------------------------------------------- resumen

const resumen = [
  `Cliente: ${CLIENTE}`,
  `Usuarios: ${usuarios.size} (admin ${[...usuarios.values()].filter((u) => u.rol === 'admin').length}, socorristas ${[...usuarios.values()].filter((u) => u.rol === 'socorrista').length}, maquinistas ${[...usuarios.values()].filter((u) => u.rol === 'maquinista').length})`,
  `Comunidades: ${comunidades.size}`,
  `Asignaciones: ${[...comunidades.values()].reduce((n, c) => n + c.asignados.size, 0)}`,
  `Fichajes: ${imputaciones.length}`,
  `Controles de agua: ${controles.length} (con foto ${controles.filter((c) => c.foto).length})`,
];

async function main() {
  console.log(resumen.join('\n'));
  console.log(`Incidencias: ${informe.length} (ver informe)`);

  if (!args.aplicar) {
    guardarInforme('simulacro');
    console.log('\nSimulacro: no se ha escrito nada. Añade --aplicar para migrar.');
    return;
  }

  if (args.emulador) {
    process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';
    process.env['FIREBASE_STORAGE_EMULATOR_HOST'] ??= '127.0.0.1:9199';
  } else if (!args.proyecto) {
    console.error('Para escribir indica --emulador o --proyecto <id-del-proyecto-firebase>.');
    process.exit(1);
  }
  const projectId = args.emulador ? 'demo-timereport' : args.proyecto!;
  initializeApp({
    projectId,
    storageBucket: args.emulador ? 'demo-timereport.appspot.com' : `${projectId}.firebasestorage.app`,
  });
  const db = getFirestore();
  const auth = getAuth();
  const bucket = getStorage().bucket();
  const raiz = db.collection('clientes').doc(CLIENTE);

  // Cliente y logo
  let logoPath = '';
  try {
    const logo = readFileSync(resolve(args.logo!));
    logoPath = `clientes/${CLIENTE}/branding/logo.png`;
    await bucket.file(logoPath).save(logo, { contentType: 'image/png' });
  } catch {
    anotar(`No se encontró el logo ${args.logo}; el cliente usará el logo por defecto.`);
  }
  const existente = await raiz.get();
  if (!existente.exists) {
    await raiz.set({
      nombre: args['nombre-cliente'],
      activo: true,
      branding: { nombreApp: 'TimeReport', logoPath, colorPrimario: '#0e7490', colorSecundario: '#164e63' },
      config: { radioFichajeM: 1000, maxFichajesDia: 2 },
    });
  } else if (logoPath) {
    await raiz.update({ 'branding.logoPath': logoPath });
  }

  // Usuarios de Auth (bcrypt, sin que tengan que cambiar la contraseña).
  // importUsers no sobrescribe cuentas existentes: en una segunda pasada,
  // a las que ya existen se les actualizan email, nombre y rol, y conservan
  // su contraseña actual (puede que ya la hayan cambiado en la app nueva).
  const existentes = new Set<string>();
  const lista = [...usuarios.values()];
  for (let i = 0; i < lista.length; i += 100) {
    const res = await auth.getUsers(lista.slice(i, i + 100).map((u) => ({ uid: u.uid })));
    for (const u of res.users) existentes.add(u.uid);
  }
  for (const u of lista.filter((x) => existentes.has(x.uid))) {
    await auth.updateUser(u.uid, { email: u.email, displayName: u.nombre });
    await auth.setCustomUserClaims(u.uid, { clienteId: CLIENTE, rol: u.rol });
  }
  if (existentes.size) {
    anotar(`${existentes.size} usuarios ya existían en Auth: actualizados email, nombre y rol; conservan su contraseña actual.`);
  }

  const registros: UserImportRecord[] = lista.filter((u) => !existentes.has(u.uid)).map((u) => ({
    uid: u.uid,
    email: u.email,
    displayName: u.nombre,
    customClaims: { clienteId: CLIENTE, rol: u.rol },
    ...(u.hash ? { passwordHash: Buffer.from(u.hash) } : {}),
  }));
  for (let i = 0; i < registros.length; i += 1000) {
    const res = await auth.importUsers(registros.slice(i, i + 1000), { hash: { algorithm: 'BCRYPT' } });
    for (const e of res.errors) {
      anotar(`Error al importar el usuario ${registros[i + e.index].uid}: ${e.error.message}`);
    }
    console.log(`Auth: ${res.successCount} usuarios importados, ${res.failureCount} errores`);
  }

  const escritor = db.bulkWriter();
  for (const u of usuarios.values()) {
    escritor.set(raiz.collection('usuarios').doc(u.uid), {
      nombre: u.nombre,
      username: u.username,
      email: u.email,
      rol: u.rol,
      activo: true,
      createdAt: FieldValue.serverTimestamp(),
      migradoDe: u.idMysql,
    });
  }
  for (const c of comunidades.values()) {
    escritor.set(raiz.collection('comunidades').doc(c.id), {
      nombre: c.nombre,
      codigo: c.codigo,
      ubicacion: c.ubicacion,
      asignados: [...c.asignados],
      activa: true,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  for (const i of imputaciones) {
    escritor.set(raiz.collection('imputaciones').doc(i.id), i.datos);
  }
  for (const c of controles) {
    escritor.set(raiz.collection('controlesAgua').doc(c.id), c.datos);
  }
  await escritor.close();
  console.log('Firestore: datos escritos');

  let subidas = 0;
  for (const c of controles) {
    if (!c.foto) continue;
    await bucket.file(c.datos['fotoPath'] as string).save(c.foto.bytes, { contentType: c.foto.tipo });
    if (++subidas % 50 === 0) console.log(`Storage: ${subidas} fotos subidas…`);
  }
  console.log(`Storage: ${subidas} fotos subidas`);

  guardarInforme(args.emulador ? 'emulador' : projectId);
}

function guardarInforme(destino: string) {
  const dir = resolve('docs/privado');
  mkdirSync(dir, { recursive: true });
  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ruta = resolve(dir, `informe-migracion-${destino}-${marca}.md`);
  writeFileSync(
    ruta,
    [
      `# Informe de migración (${destino})`,
      '',
      ...resumen.map((l) => `- ${l}`),
      '',
      '## Incidencias',
      '',
      ...(informe.length ? informe.map((l) => `- ${l}`) : ['- Ninguna']),
      '',
    ].join('\n'),
  );
  console.log(`Informe: ${ruta}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
