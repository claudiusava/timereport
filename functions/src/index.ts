import { initializeApp } from "firebase-admin/app";
import { setGlobalOptions } from "firebase-functions/v2";

// Debe coincidir con environment.functionsRegion del frontend.
setGlobalOptions({ region: "europe-southwest1", maxInstances: 10 });

initializeApp();

export { restablecerDemo } from "./demo.js";
export { actualizarEmpresa } from "./empresa.js";
export { anularRegistro, fichar, registrarFichajeManual } from "./fichajes.js";
export {
  actualizarUsuario,
  cambiarEstadoUsuario,
  crearUsuario,
  restablecerPassword,
} from "./usuarios.js";
