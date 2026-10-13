import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

// Debe coincidir con environment.functionsRegion del frontend.
setGlobalOptions({ region: "europe-southwest1", maxInstances: 10 });

initializeApp();

export {
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  restablecerPassword,
} from "./usuarios";
