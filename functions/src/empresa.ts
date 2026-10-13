import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { auditar, db, exigirAdmin, numero, objeto, refCliente, texto } from "./comun.js";

// Ajustes de la empresa que puede cambiar su propio admin: marca (nombre de
// la app, color y logo) y reglas de fichaje. Pasa por aqui y no por las
// reglas de Firestore para validar y dejar constancia en la auditoria.

export const actualizarEmpresa = onCall(async (request) => {
  const sesion = await exigirAdmin(request);
  const d = objeto(request.data);
  const cambios: Record<string, unknown> = {};
  const descripcion: string[] = [];

  if (d["nombreApp"] !== undefined) {
    cambios["branding.nombreApp"] = texto(d["nombreApp"], "el nombre de la aplicación", 1, 40);
    descripcion.push(`nombre de la app: ${cambios["branding.nombreApp"]}`);
  }
  if (d["colorPrimario"] !== undefined) {
    if (typeof d["colorPrimario"] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(d["colorPrimario"])) {
      throw new HttpsError("invalid-argument", "El color debe tener el formato #rrggbb.");
    }
    cambios["branding.colorPrimario"] = d["colorPrimario"].toLowerCase();
    descripcion.push(`color: ${cambios["branding.colorPrimario"]}`);
  }
  if (d["logoPath"] !== undefined) {
    const logo = d["logoPath"];
    const prefijo = `clientes/${sesion.clienteId}/branding/`;
    if (logo !== "" && (typeof logo !== "string" || !logo.startsWith(prefijo) || logo.length > 200)) {
      throw new HttpsError("invalid-argument", "Logo no válido.");
    }
    cambios["branding.logoPath"] = logo;
    descripcion.push(logo ? "nuevo logo" : "logo por defecto");
  }
  if (d["radioFichajeM"] !== undefined) {
    cambios["config.radioFichajeM"] = Math.round(numero(d["radioFichajeM"], "El radio de fichaje", 50, 5000));
    descripcion.push(`radio de fichaje: ${cambios["config.radioFichajeM"]} m`);
  }
  if (d["maxFichajesDia"] !== undefined) {
    cambios["config.maxFichajesDia"] = Math.round(numero(d["maxFichajesDia"], "El máximo de fichajes", 1, 10));
    descripcion.push(`entradas máximas al día: ${cambios["config.maxFichajesDia"]}`);
  }
  if (!Object.keys(cambios).length) {
    throw new HttpsError("invalid-argument", "No hay cambios que guardar.");
  }

  const batch = db().batch();
  batch.update(refCliente(sesion.clienteId), cambios);
  auditar(batch, sesion, {
    accion: "empresa.ajustes",
    descripcion: `Cambia los ajustes de la empresa (${descripcion.join("; ")})`,
  });
  await batch.commit();
  logger.info("Ajustes de empresa", { clienteId: sesion.clienteId, campos: Object.keys(cambios), por: sesion.uid });
  return { ok: true };
});
