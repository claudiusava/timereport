import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  ZONA_POR_DEFECTO,
  auditar,
  db,
  exigirAdmin,
  exigirSesion,
  formatoFechaHora,
  id,
  inicioDelDia,
  numero,
  objeto,
  refCliente,
  texto,
} from "./comun.js";
import { TipoFichaje, distanciaM, siguienteTipo } from "./reglas.js";

// Registro de jornada (RD-ley 8/2019): los fichajes solo se crean desde
// aqui, con la hora del servidor, y nunca se modifican ni se borran. Los
// errores se corrigen anulando (con motivo) y registrando un fichaje manual,
// y todo queda en la auditoria.

const TIPOS: TipoFichaje[] = ["entrada", "salida"];

function tipo(valor: unknown): TipoFichaje {
  if (!TIPOS.includes(valor as TipoFichaje)) {
    throw new HttpsError("invalid-argument", "Tipo de fichaje no válido.");
  }
  return valor as TipoFichaje;
}

export const fichar = onCall(async (request) => {
  const sesion = await exigirSesion(request);
  const d = objeto(request.data);
  const comunidadId = id(d["comunidadId"], "identificador de comunidad");
  const tipoPedido = tipo(d["tipo"]);
  const pos = objeto(d["posicion"]);
  const lat = numero(pos["lat"], "Latitud", -90, 90);
  const lng = numero(pos["lng"], "Longitud", -180, 180);
  const precision = numero(pos["precision"], "Precisión", 0, 100000);

  const config = sesion.cliente["config"] ?? {};
  const radio: number = config.radioFichajeM ?? 1000;
  const maxDia: number = config.maxFichajesDia ?? 2;
  const zona: string = config.zonaHoraria ?? ZONA_POR_DEFECTO;

  const cliente = refCliente(sesion.clienteId);
  const perfilRef = cliente.collection("usuarios").doc(sesion.uid);
  const comunidadRef = cliente.collection("comunidades").doc(comunidadId);
  const imputaciones = cliente.collection("imputaciones");

  const resultado = await db().runTransaction(async (tx) => {
    // Leer el perfil dentro de la transaccion serializa los fichajes del
    // mismo trabajador: dos toques seguidos no pueden crear dos entradas.
    const [perfil, comunidad, recientes] = await Promise.all([
      tx.get(perfilRef),
      tx.get(comunidadRef),
      tx.get(imputaciones.where("uid", "==", sesion.uid).orderBy("fecha", "desc").limit(20)),
    ]);
    if (!perfil.exists || perfil.get("activo") !== true) {
      throw new HttpsError("permission-denied", "Tu usuario está desactivado.");
    }
    if (!comunidad.exists || comunidad.get("activa") === false) {
      throw new HttpsError("failed-precondition", "La comunidad no existe o no está activa.");
    }
    const asignados: string[] = comunidad.get("asignados") ?? [];
    if (sesion.rol !== "admin" && !asignados.includes(sesion.uid)) {
      throw new HttpsError("permission-denied", "No tienes asignada esta comunidad.");
    }

    const ubicacion = comunidad.get("ubicacion");
    if (!ubicacion) {
      throw new HttpsError(
        "failed-precondition",
        "Esta comunidad no tiene ubicación configurada. Avisa al administrador.",
      );
    }
    // En la empresa de demostracion se puede fichar desde cualquier sitio
    // (los visitantes no estan en Madrid); se guarda igualmente la distancia.
    const esDemo = sesion.cliente["demo"] === true;
    if (!esDemo && precision > radio) {
      throw new HttpsError(
        "failed-precondition",
        `La ubicación no es precisa (±${Math.round(precision)} m). Activa el GPS y vuelve a intentarlo.`,
      );
    }
    const distancia = distanciaM({ lat, lng }, { lat: ubicacion.latitude, lng: ubicacion.longitude });
    if (!esDemo && distancia > radio) {
      throw new HttpsError(
        "failed-precondition",
        `Estás a ${formatearDistancia(distancia)} de ${comunidad.get("nombre")}. ` +
          `Para fichar tienes que estar a menos de ${formatearDistancia(radio)}.`,
      );
    }

    const validos = recientes.docs.filter((doc) => !doc.get("anulado"));
    const ultimo = validos[0];
    const ahora = new Date();
    const esperado = siguienteTipo(
      ultimo ? { tipo: ultimo.get("tipo"), fecha: (ultimo.get("fecha") as Timestamp).toDate() } : null,
      ahora,
    );
    if (tipoPedido !== esperado) {
      throw new HttpsError(
        "failed-precondition",
        `Te toca fichar la ${esperado}. Actualiza la pantalla y vuelve a intentarlo.`,
      );
    }

    if (esperado === "entrada") {
      const hoy = inicioDelDia(zona, ahora).getTime();
      const entradasHoy = validos.filter(
        (doc) => doc.get("tipo") === "entrada" && (doc.get("fecha") as Timestamp).toMillis() >= hoy,
      ).length;
      if (entradasHoy >= maxDia) {
        throw new HttpsError("failed-precondition", "Has alcanzado el máximo de fichajes de hoy.");
      }
    }

    const ref = imputaciones.doc();
    const fecha = Timestamp.fromDate(ahora);
    tx.set(ref, {
      uid: sesion.uid,
      usuarioNombre: perfil.get("nombre"),
      comunidadId,
      comunidadNombre: comunidad.get("nombre"),
      tipo: esperado,
      fecha,
      origen: "app",
      distanciaM: Math.round(distancia),
      precisionM: Math.round(precision),
      registradoPor: null,
      motivo: null,
      anulado: null,
    });
    tx.update(perfilRef, { ultimoFichaje: { tipo: esperado, fecha, id: ref.id } });
    return { id: ref.id, tipo: esperado, fecha: ahora.toISOString() };
  });

  return resultado;
});

/** El admin registra un fichaje olvidado o corregido, siempre con motivo. */
export const registrarFichajeManual = onCall(async (request) => {
  const sesion = await exigirAdmin(request);
  const d = objeto(request.data);
  const uid = id(d["uid"], "trabajador");
  const comunidadId = id(d["comunidadId"], "identificador de comunidad");
  const tipoFichaje = tipo(d["tipo"]);
  const motivo = texto(d["motivo"], "el motivo", 5, 500);
  const fecha = new Date(typeof d["fecha"] === "string" ? d["fecha"] : NaN);
  const ahora = Date.now();
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() > ahora) {
    throw new HttpsError("invalid-argument", "La fecha no es válida o es futura.");
  }
  if (fecha.getTime() < ahora - 400 * 24 * 3600 * 1000) {
    throw new HttpsError("invalid-argument", "Solo se pueden registrar fichajes del último año.");
  }

  const cliente = refCliente(sesion.clienteId);
  const [perfil, comunidad] = await Promise.all([
    cliente.collection("usuarios").doc(uid).get(),
    cliente.collection("comunidades").doc(comunidadId).get(),
  ]);
  if (!perfil.exists) throw new HttpsError("not-found", "El trabajador no existe.");
  if (!comunidad.exists) throw new HttpsError("not-found", "La comunidad no existe.");

  const zona: string = sesion.cliente["config"]?.zonaHoraria ?? ZONA_POR_DEFECTO;
  const ref = cliente.collection("imputaciones").doc();
  const batch = db().batch();
  batch.set(ref, {
    uid,
    usuarioNombre: perfil.get("nombre"),
    comunidadId,
    comunidadNombre: comunidad.get("nombre"),
    tipo: tipoFichaje,
    fecha: Timestamp.fromDate(fecha),
    origen: "manual",
    distanciaM: null,
    precisionM: null,
    registradoPor: { uid: sesion.uid, nombre: sesion.nombre, fecha: FieldValue.serverTimestamp() },
    motivo,
    anulado: null,
  });
  auditar(batch, sesion, {
    accion: "fichaje.manual",
    descripcion: `Registra una ${tipoFichaje} manual de ${perfil.get("nombre")} el ${formatoFechaHora(zona, fecha)} en ${comunidad.get("nombre")}`,
    objetivo: { coleccion: "imputaciones", id: ref.id },
    motivo,
  });
  await batch.commit();
  logger.info("Fichaje manual", { clienteId: sesion.clienteId, id: ref.id, por: sesion.uid });
  return { id: ref.id };
});

/** Anula un fichaje o un control de agua. El registro se conserva. */
export const anularRegistro = onCall(async (request) => {
  const sesion = await exigirAdmin(request);
  const d = objeto(request.data);
  const coleccion = d["coleccion"];
  if (coleccion !== "imputaciones" && coleccion !== "controlesAgua") {
    throw new HttpsError("invalid-argument", "Tipo de registro no válido.");
  }
  const registroId = id(d["id"], "registro");
  const motivo = texto(d["motivo"], "el motivo", 5, 500);
  const zona: string = sesion.cliente["config"]?.zonaHoraria ?? ZONA_POR_DEFECTO;
  const ref = refCliente(sesion.clienteId).collection(coleccion).doc(registroId);

  await db().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new HttpsError("not-found", "El registro no existe.");
    if (doc.get("anulado")) throw new HttpsError("failed-precondition", "El registro ya estaba anulado.");
    tx.update(ref, {
      anulado: { por: { uid: sesion.uid, nombre: sesion.nombre }, fecha: FieldValue.serverTimestamp(), motivo },
    });
    const fecha = formatoFechaHora(zona, (doc.get("fecha") as Timestamp).toDate());
    auditar(tx, sesion, {
      accion: coleccion === "imputaciones" ? "fichaje.anular" : "controlAgua.anular",
      descripcion:
        coleccion === "imputaciones"
          ? `Anula la ${doc.get("tipo")} de ${doc.get("usuarioNombre")} del ${fecha}`
          : `Anula el control de agua de ${doc.get("usuarioNombre")} en ${doc.get("comunidadNombre")} del ${fecha}`,
      objetivo: { coleccion, id: registroId },
      motivo,
    });
  });
  logger.info("Registro anulado", { clienteId: sesion.clienteId, coleccion, id: registroId, por: sesion.uid });
  return { id: registroId };
});

function formatearDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = Math.round(m / 100) / 10;
  return `${Number.isInteger(km) ? km : km.toFixed(1).replace(".", ",")} km`;
}
