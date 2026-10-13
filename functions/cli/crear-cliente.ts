// Da de alta una empresa nueva con su primer administrador. A partir de ahi,
// ese admin gestiona usuarios, comunidades, logo y colores desde la app
// (Ajustes de empresa).
//
//   npx tsx functions/cli/crear-cliente.ts --proyecto timereport-app \
//     --id piscinas-norte --nombre "Piscinas Norte" \
//     --admin-usuario mgarcia --admin-nombre "María García" [--color "#00658f"]
//
// La contraseña del admin se genera al azar y se muestra una sola vez.

import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";

import { ZONA_POR_DEFECTO } from "../src/comun.js";
import { emailDeLogin, normalizarUsername } from "../src/email-usuario.js";
import { arrancar, fallar } from "./inicio.js";

const { args, projectId } = arrancar({
  id: { type: "string" },
  nombre: { type: "string" },
  "admin-usuario": { type: "string" },
  "admin-nombre": { type: "string" },
  color: { type: "string", default: "#00658f" },
});

const id = String(args.id ?? "");
const nombre = String(args.nombre ?? "");
const usuario = normalizarUsername(String(args["admin-usuario"] ?? ""));
const adminNombre = String(args["admin-nombre"] ?? "");
const color = String(args.color);

if (!/^[a-z0-9-]{2,40}$/.test(id)) fallar("--id: minúsculas, números y guiones (2-40), p. ej. piscinas-norte.");
if (!nombre) fallar("Falta --nombre.");
if (usuario.length < 2) fallar("Falta --admin-usuario (nombre de usuario, sin @).");
if (!adminNombre) fallar("Falta --admin-nombre.");
if (!/^#[0-9a-fA-F]{6}$/.test(color)) fallar("--color debe tener el formato #rrggbb.");

async function main() {
  const db = getFirestore();
  const auth = getAuth();
  const ref = db.doc(`clientes/${id}`);
  // Nunca se toca una empresa que ya existe: una errata en --id no debe
  // modificar los datos de otro cliente.
  if ((await ref.get()).exists) fallar(`Ya existe una empresa con id "${id}". No se ha cambiado nada.`);

  const email = emailDeLogin(usuario, id);
  const password = randomBytes(12).toString("base64url");
  const { uid } = await auth.createUser({ email, password, displayName: adminNombre });
  try {
    await auth.setCustomUserClaims(uid, { clienteId: id, rol: "admin" });
    const batch = db.batch();
    batch.set(ref, {
      nombre,
      activo: true,
      branding: { nombreApp: "TimeReport", logoPath: "", colorPrimario: color.toLowerCase() },
      config: { radioFichajeM: 1000, maxFichajesDia: 2, zonaHoraria: ZONA_POR_DEFECTO },
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(ref.collection("usuarios").doc(uid), {
      nombre: adminNombre,
      username: usuario,
      email,
      rol: "admin",
      activo: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
  } catch (e) {
    await auth.deleteUser(uid).catch(() => undefined);
    throw e;
  }

  console.log(`Empresa "${nombre}" creada en ${projectId}.`);
  console.log("Pásale al administrador estos datos por un canal seguro:");
  console.log(`  Enlace:     https://claudiusava.github.io/timereport/#/c/${id}`);
  console.log(`  Usuario:    ${usuario}`);
  console.log(`  Contraseña: ${password}`);
  console.log("Puede cambiarla desde Mi perfil en cuanto entre.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
