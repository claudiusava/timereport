// Ajustes del proyecto de Firebase que no se despliegan con `firebase deploy`.
// Se ejecuta una vez por proyecto (y es seguro repetirlo).
//
//   npx tsx functions/cli/configurar-proyecto.ts --proyecto timereport-app
//
// 1. CORS del bucket: la app descarga las fotos con getBlob (pasando por las
//    reglas de Storage) en lugar de usar URLs de descarga permanentes.
// 2. Firebase Auth: desactiva el registro libre y el borrado de cuenta por el
//    propio usuario (las cuentas solo las crean los admins con las Functions)
//    y activa la proteccion contra enumeracion de emails.

import { applicationDefault, getApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

import { arrancar, fallar } from "./inicio.js";

const { projectId, emulador } = arrancar({
  origen: { type: "string", default: "https://claudiusava.github.io" },
});
if (emulador) fallar("Este script solo tiene sentido en un proyecto real.");

const ORIGENES = ["https://claudiusava.github.io", "http://localhost:4200"];

async function main() {
  await getStorage().bucket().setCorsConfiguration([
    { origin: ORIGENES, method: ["GET"], responseHeader: ["Content-Type"], maxAgeSeconds: 3600 },
  ]);
  console.log(`Storage: CORS configurado para ${ORIGENES.join(", ")}`);

  const credencial = getApp().options.credential ?? applicationDefault();
  const { access_token } = await credencial.getAccessToken();
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config` +
      "?updateMask=client.permissions.disabledUserSignup,client.permissions.disabledUserDeletion,emailPrivacyConfig.enableImprovedEmailPrivacy",
    {
      method: "PATCH",
      headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json" },
      body: JSON.stringify({
        client: { permissions: { disabledUserSignup: true, disabledUserDeletion: true } },
        emailPrivacyConfig: { enableImprovedEmailPrivacy: true },
      }),
    },
  );
  if (!res.ok) fallar(`Auth: no se pudo actualizar la configuración (${res.status}): ${await res.text()}`);
  console.log("Auth: registro libre y autoborrado desactivados; protección contra enumeración activada.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
