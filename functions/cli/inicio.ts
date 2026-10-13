// Arranque comun de los scripts de administracion (se ejecutan con tsx desde
// la raiz del repo, p. ej. `npx tsx functions/cli/demo.ts --emulador`).
//
// --emulador          contra los emuladores locales (npm run emulators)
// --proyecto <id>     contra un proyecto real. Credenciales: Application
//                     Default Credentials o GOOGLE_APPLICATION_CREDENTIALS con
//                     la clave de una cuenta de servicio guardada FUERA del repo.

import { initializeApp } from "firebase-admin/app";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

export function arrancar<T extends Record<string, { type: "string" | "boolean"; default?: string | boolean }>>(
  opciones: T,
) {
  const values = parseArgs({
    options: { ...opciones, emulador: { type: "boolean", default: false }, proyecto: { type: "string" } },
    allowPositionals: false,
  }).values as Record<string, unknown>;
  const emulador = values.emulador as boolean;
  const proyecto = values.proyecto as string | undefined;
  if (!emulador && !proyecto) fallar("Indica --emulador o --proyecto <id-del-proyecto-firebase>.");
  if (emulador) {
    process.env["FIRESTORE_EMULATOR_HOST"] ??= "127.0.0.1:8080";
    process.env["FIREBASE_AUTH_EMULATOR_HOST"] ??= "127.0.0.1:9099";
    process.env["FIREBASE_STORAGE_EMULATOR_HOST"] ??= "127.0.0.1:9199";
  }
  const projectId = emulador ? "demo-timereport" : proyecto!;
  initializeApp({
    projectId,
    storageBucket: emulador ? "demo-timereport.appspot.com" : `${projectId}.firebasestorage.app`,
  });
  return { args: values as Record<keyof T, unknown>, projectId, emulador };
}

export function fallar(mensaje: string): never {
  console.error(mensaje);
  process.exit(1);
}

/** Pide escribir un texto exacto para confirmar una operacion peligrosa. */
export async function confirmar(pregunta: string, esperado: string) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await rl.question(`${pregunta}\nEscribe "${esperado}" para continuar: `);
  rl.close();
  if (respuesta.trim() !== esperado) fallar("Cancelado.");
}
