// Crea (o regenera) la empresa de demostracion con datos ficticios.
//
//   npx tsx functions/cli/demo.ts --emulador
//   npx tsx functions/cli/demo.ts --proyecto timereport-app
//
// En produccion ademas se regenera sola cada 3 horas (Function restablecerDemo).

import { DEMO_ID, DEMO_PASSWORD, USUARIOS_DEMO, sembrarDemo } from "../src/demo.js";
import { arrancar } from "./inicio.js";

const { projectId } = arrancar({});

sembrarDemo()
  .then(({ fichajes, controles }) => {
    console.log(`Demo regenerada en ${projectId}: ${fichajes} fichajes y ${controles} controles de agua.`);
    console.log(`Empresa: ${DEMO_ID}. Usuarios (contraseña ${DEMO_PASSWORD}):`);
    for (const u of USUARIOS_DEMO.slice(0, 3)) console.log(`  ${u.username.padEnd(12)} ${u.rol}`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
