import { getAuth } from "firebase-admin/auth";
import { FieldValue, GeoPoint, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";
import { onSchedule } from "firebase-functions/v2/scheduler";
import jpeg from "jpeg-js";

import { ZONA_POR_DEFECTO, fechaEnZona } from "./comun.js";
import { emailDeLogin } from "./email-usuario.js";

// Empresa de demostracion para enseñar la app a posibles clientes. Todos los
// datos son ficticios. Se regenera entera cada 3 horas (y con
// `npx tsx functions/cli/demo.ts`), asi que lo que hagan los visitantes no
// dura mucho, y siempre hay datos de hoy hasta la hora actual.

export const DEMO_ID = "demo";
export const DEMO_PASSWORD = "demo1234";
const ZONA = ZONA_POR_DEFECTO;
const DIAS = 35;

interface UsuarioDemo {
  uid: string;
  username: string;
  nombre: string;
  rol: "admin" | "socorrista" | "maquinista";
  activo: boolean;
}

export const USUARIOS_DEMO: UsuarioDemo[] = [
  { uid: "demo_admin", username: "admin", nombre: "Laura Martín", rol: "admin", activo: true },
  { uid: "demo_socorrista", username: "socorrista", nombre: "Carlos Ruiz", rol: "socorrista", activo: true },
  { uid: "demo_maquinista", username: "maquinista", nombre: "Ana López", rol: "maquinista", activo: true },
  { uid: "demo_jgarcia", username: "jgarcia", nombre: "Javier García", rol: "socorrista", activo: true },
  { uid: "demo_mfernandez", username: "mfernandez", nombre: "María Fernández", rol: "socorrista", activo: true },
  { uid: "demo_dsanchez", username: "dsanchez", nombre: "David Sánchez", rol: "maquinista", activo: true },
  { uid: "demo_pnavarro", username: "pnavarro", nombre: "Paula Navarro", rol: "maquinista", activo: false },
];

const COMUNIDADES = [
  { id: "alamos", nombre: "Residencial Los Álamos", codigo: "101", lat: 40.4627, lng: -3.6773, asignados: ["demo_socorrista", "demo_maquinista"], activa: true },
  { id: "parque-sur", nombre: "Urbanización Parque Sur", codigo: "102", lat: 40.3297, lng: -3.7658, asignados: ["demo_jgarcia", "demo_maquinista"], activa: true },
  { id: "jardines-rio", nombre: "Comunidad Jardines del Río", codigo: "103", lat: 40.3983, lng: -3.7186, asignados: ["demo_socorrista", "demo_dsanchez"], activa: true },
  { id: "encinas", nombre: "Residencial Las Encinas", codigo: "104", lat: 40.4352, lng: -3.8134, asignados: ["demo_mfernandez", "demo_dsanchez"], activa: true },
  { id: "monte-verde", nombre: "Urbanización Monte Verde", codigo: "105", lat: 40.4929, lng: -3.8737, asignados: ["demo_mfernandez"], activa: true },
  { id: "azul-marino", nombre: "Comunidad Azul Marino", codigo: "106", lat: 40.3459, lng: -3.8249, asignados: ["demo_jgarcia", "demo_pnavarro"], activa: true },
  { id: "mirador", nombre: "Residencial El Mirador", codigo: "107", lat: 40.3083, lng: -3.7327, asignados: [], activa: false },
];

/** Generador pseudoaleatorio con semilla: la demo sale igual cada vez. */
function aleatorio(semilla: number) {
  let s = semilla >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    rnd,
    entre: (min: number, max: number) => Math.floor(min + rnd() * (max - min + 1)),
    elegir: <T>(lista: T[]) => lista[Math.floor(rnd() * lista.length)],
  };
}

/** Foto ficticia de una piscina: degradado de agua con ondas. */
function fotoPiscina(semilla: number): Buffer {
  const { rnd } = aleatorio(semilla);
  const ancho = 480;
  const alto = 360;
  const datos = Buffer.alloc(ancho * alto * 4);
  const fase = rnd() * Math.PI * 2;
  const tono = rnd() * 30;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const onda = Math.sin(x / 23 + fase + Math.sin(y / 31) * 2) * 18 + Math.sin((x + y) / 11) * 6;
      const i = (y * ancho + x) * 4;
      datos[i] = Math.max(0, Math.min(255, 20 + tono + onda * 0.4));
      datos[i + 1] = Math.max(0, Math.min(255, 140 + (y / alto) * 50 + onda));
      datos[i + 2] = Math.max(0, Math.min(255, 190 + (y / alto) * 40 + onda * 0.8));
      datos[i + 3] = 255;
    }
  }
  return jpeg.encode({ data: datos, width: ancho, height: alto }, 70).data;
}

/** Fecha local (Madrid) de hace `dias` dias a una hora dada. */
function diaHora(hoy: { anio: number; mes: number; dia: number }, dias: number, hora: number, minuto: number) {
  const base = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia - dias));
  return fechaEnZona(ZONA, base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hora, minuto);
}

function diaSemana(hoy: { anio: number; mes: number; dia: number }, dias: number) {
  return new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia - dias)).getUTCDay();
}

/**
 * @param restablecerPasswords cambiar la contraseña desde el Admin SDK cierra
 *   las sesiones abiertas, asi que solo se hace una vez al dia (por si algun
 *   visitante la ha cambiado) y no en cada regeneracion.
 */
export async function sembrarDemo(restablecerPasswords = true): Promise<{ fichajes: number; controles: number }> {
  const db = getFirestore();
  const auth = getAuth();
  const bucket = getStorage().bucket();
  const cliente = db.collection("clientes").doc(DEMO_ID);

  // 1. Borrar la demo anterior
  await db.recursiveDelete(cliente);
  await bucket.deleteFiles({ prefix: `clientes/${DEMO_ID}/` }).catch(() => undefined);

  // 2. Empresa, usuarios y comunidades
  await cliente.set({
    nombre: "Piscinas Demo",
    activo: true,
    demo: true,
    branding: { nombreApp: "TimeReport", logoPath: "", colorPrimario: "#00658f" },
    config: { radioFichajeM: 1000, maxFichajesDia: 2, zonaHoraria: ZONA, maxUsuarios: 25 },
  });

  for (const u of USUARIOS_DEMO) {
    // Se actualizan (no se borran) para no cerrar la sesion de quien este
    // probando la demo en ese momento.
    const cuenta = { email: emailDeLogin(u.username, DEMO_ID), displayName: u.nombre, disabled: !u.activo };
    await auth
      .updateUser(u.uid, restablecerPasswords ? { ...cuenta, password: DEMO_PASSWORD } : cuenta)
      .catch(() => auth.createUser({ uid: u.uid, ...cuenta, password: DEMO_PASSWORD }));
    await auth.setCustomUserClaims(u.uid, { clienteId: DEMO_ID, rol: u.rol });
  }

  const lote = db.bulkWriter();
  for (const u of USUARIOS_DEMO) {
    lote.set(cliente.collection("usuarios").doc(u.uid), {
      nombre: u.nombre,
      username: u.username,
      email: emailDeLogin(u.username, DEMO_ID),
      rol: u.rol,
      activo: u.activo,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  for (const c of COMUNIDADES) {
    lote.set(cliente.collection("comunidades").doc(c.id), {
      nombre: c.nombre,
      codigo: c.codigo,
      ubicacion: new GeoPoint(c.lat, c.lng),
      asignados: c.asignados,
      activa: c.activa,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // 3. Fichajes y controles de las ultimas semanas
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA })
    .format(new Date())
    .split("-")
    .map(Number);
  const hoy = { anio, mes, dia };
  const { rnd, entre, elegir } = aleatorio(20261013);
  const admin = USUARIOS_DEMO[0];
  const trabajadores = USUARIOS_DEMO.filter((u) => u.rol !== "admin");
  const comunidadesDe = (uid: string) => COMUNIDADES.filter((c) => c.asignados.includes(uid));
  let fichajes = 0;
  let controles = 0;
  const fotos: { path: string; semilla: number }[] = [];

  const ahora = Date.now();
  const fichaje = (u: UsuarioDemo, c: (typeof COMUNIDADES)[number], tipo: string, fecha: Date, extra: Record<string, unknown> = {}) => {
    if (fecha.getTime() > ahora) return; // hoy, solo hasta la hora actual
    lote.set(cliente.collection("imputaciones").doc(), {
      uid: u.uid,
      usuarioNombre: u.nombre,
      comunidadId: c.id,
      comunidadNombre: c.nombre,
      tipo,
      fecha: Timestamp.fromDate(fecha),
      origen: "app",
      distanciaM: entre(5, 120),
      precisionM: entre(4, 25),
      registradoPor: null,
      motivo: null,
      anulado: null,
      ...extra,
    });
    fichajes++;
  };

  for (const u of trabajadores) {
    const suyas = comunidadesDe(u.uid);
    if (!suyas.length) continue;
    // Paula esta de baja desde hace 10 dias.
    const desde = u.uid === "demo_pnavarro" ? 10 : 0;
    for (let d = DIAS; d >= desde; d--) {
      const semana = diaSemana(hoy, d);
      const trabaja = u.rol === "socorrista" ? semana !== 0 : semana !== 0 && semana !== 6;
      if (!trabaja || rnd() < 0.06) continue;
      const c = elegir(suyas);

      if (u.rol === "maquinista" && rnd() < 0.35 && !(u.uid === "demo_dsanchez" && d === 1)) {
        // Jornada partida
        fichaje(u, c, "entrada", diaHora(hoy, d, 8, entre(0, 10)));
        fichaje(u, c, "salida", diaHora(hoy, d, 12, entre(55, 59)));
        const c2 = elegir(suyas);
        fichaje(u, c2, "entrada", diaHora(hoy, d, 16, entre(0, 10)));
        fichaje(u, c2, "salida", diaHora(hoy, d, 19, entre(0, 15)));
      } else {
        const entrada = diaHora(hoy, d, u.rol === "socorrista" ? 11 : 8, entre(0, 12));
        fichaje(u, c, "entrada", entrada);
        // Ana olvido fichar la salida hace 3 dias; el admin la registro a mano.
        if (u.uid === "demo_maquinista" && d === 3) {
          lote.set(cliente.collection("imputaciones").doc(), {
            uid: u.uid,
            usuarioNombre: u.nombre,
            comunidadId: c.id,
            comunidadNombre: c.nombre,
            tipo: "salida",
            fecha: Timestamp.fromDate(diaHora(hoy, d, 15, 0)),
            origen: "manual",
            distanciaM: null,
            precisionM: null,
            registradoPor: { uid: admin.uid, nombre: admin.nombre, fecha: Timestamp.fromDate(diaHora(hoy, d - 1, 9, 30)) },
            motivo: "Olvidó fichar la salida; confirmado con la trabajadora.",
            anulado: null,
          });
          fichajes++;
          auditoria("fichaje.manual", `Registra una salida manual de ${u.nombre} el día de su olvido en ${c.nombre}`, diaHora(hoy, d - 1, 9, 30), "Olvidó fichar la salida; confirmado con la trabajadora.");
        } else if (!(u.uid === "demo_dsanchez" && d === 1)) {
          // (David olvido fichar ayer la salida: aparece como aviso en el panel.)
          fichaje(u, c, "salida", diaHora(hoy, d, u.rol === "socorrista" ? 19 : 15, entre(0, 20)));
        }
        // Un fichaje duplicado por error, anulado por el admin.
        if (u.uid === "demo_jgarcia" && d === 6) {
          fichaje(u, c, "entrada", new Date(entrada.getTime() + 60000), {
            anulado: { por: { uid: admin.uid, nombre: admin.nombre }, fecha: Timestamp.fromDate(diaHora(hoy, d, 18, 0)), motivo: "Fichaje duplicado por error." },
          });
          auditoria("fichaje.anular", `Anula una entrada duplicada de ${u.nombre}`, diaHora(hoy, d, 18, 0), "Fichaje duplicado por error.");
        }
      }

      // Controles de agua de los socorristas: al empezar y a media tarde
      if (u.rol === "socorrista") {
        for (const hora of [11, 16]) {
          const fuera = rnd() < 0.08;
          const fecha = diaHora(hoy, d, hora, entre(5, 40));
          if (fecha.getTime() > ahora) continue;
          const ref = cliente.collection("controlesAgua").doc();
          const conFoto = d <= 10;
          const fotoPath = `clientes/${DEMO_ID}/controlesAgua/${u.uid}/${ref.id}.jpg`;
          if (conFoto) fotos.push({ path: fotoPath, semilla: controles + 1 });
          lote.set(ref, {
            uid: u.uid,
            usuarioNombre: u.nombre,
            comunidadId: c.id,
            comunidadNombre: c.nombre,
            cloro: fuera ? elegir([0.5, 3.0]) : elegir([1.0, 1.0, 1.5, 1.5, 2.0]),
            ph: fuera ? 8.0 : elegir([7.2, 7.4, 7.4, 7.6]),
            banistas: hora === 11 ? entre(0, 15) : entre(10, 70),
            rebosadero: entre(2, 6),
            aguaDepurada: entre(20, 90),
            fotoPath: conFoto ? fotoPath : null,
            fecha: Timestamp.fromDate(fecha),
            anulado: null,
          });
          controles++;
        }
      }
    }
  }

  auditoria("usuario.desactivar", "Desactiva a Paula Navarro", diaHora(hoy, 10, 9, 0));

  function auditoria(accion: string, descripcion: string, fecha: Date, motivo: string | null = null) {
    lote.set(cliente.collection("auditoria").doc(), {
      accion,
      descripcion,
      motivo,
      objetivo: null,
      por: { uid: admin.uid, nombre: admin.nombre },
      fecha: Timestamp.fromDate(fecha),
    });
  }

  await lote.close();

  // 4. Fotos
  for (let i = 0; i < fotos.length; i += 10) {
    await Promise.all(
      fotos.slice(i, i + 10).map((f) =>
        bucket.file(f.path).save(fotoPiscina(f.semilla), { contentType: "image/jpeg" }),
      ),
    );
  }

  logger.info("Demo regenerada", { fichajes, controles, fotos: fotos.length });
  return { fichajes, controles };
}

export const restablecerDemo = onSchedule(
  // Cloud Scheduler no existe en europe-southwest1 (Madrid): la tarea va en
  // Belgica (los datos siguen en Madrid).
  { schedule: "0 */3 * * *", timeZone: ZONA, region: "europe-west1", timeoutSeconds: 540, memory: "512MiB" },
  async (evento) => {
    const hora = Number(new Intl.DateTimeFormat("es-ES", { timeZone: ZONA, hour: "numeric", hourCycle: "h23" }).format(new Date(evento.scheduleTime)));
    await sembrarDemo(hora === 3);
  },
);
