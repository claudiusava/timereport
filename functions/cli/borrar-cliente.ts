// Borra una empresa ENTERA: sus documentos de Firestore, sus fotos y logos de
// Storage y las cuentas de Auth de sus usuarios. No se puede deshacer.
// Ojo: el registro de jornada debe conservarse 4 años; usalo solo con
// empresas de prueba o que ya no tengan esa obligacion.
//
//   npx tsx functions/cli/borrar-cliente.ts --proyecto timereport-app --id simasport

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { arrancar, confirmar, fallar } from "./inicio.js";

const { args, projectId, emulador } = arrancar({ id: { type: "string" } });
const id = String(args.id ?? "");
if (!/^[a-z0-9-]{2,40}$/.test(id)) fallar("Falta --id de la empresa.");

async function main() {
  const db = getFirestore();
  const ref = db.doc(`clientes/${id}`);
  const usuarios = await ref.collection("usuarios").get();
  const recuentos = await Promise.all(
    ["comunidades", "imputaciones", "controlesAgua", "auditoria"].map(async (c) => `${c}: ${(await ref.collection(c).count().get()).data().count}`),
  );
  if (!(await ref.get()).exists && usuarios.empty) fallar(`No existe la empresa "${id}" en ${projectId}.`);

  console.log(`Empresa "${id}" en ${projectId}${emulador ? " (emuladores)" : ""}:`);
  console.log(`  usuarios: ${usuarios.size}  ${recuentos.join("  ")}`);
  await confirmar("Se borrará TODO lo anterior, sus fotos y las cuentas de sus usuarios.", `borrar ${id}`);

  const uids = usuarios.docs.map((d) => d.id);
  if (uids.length) {
    const res = await getAuth().deleteUsers(uids);
    console.log(`Auth: ${res.successCount} cuentas borradas, ${res.failureCount} errores.`);
  }
  await getStorage().bucket().deleteFiles({ prefix: `clientes/${id}/` });
  await db.recursiveDelete(ref);
  console.log(`Empresa "${id}" borrada.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
