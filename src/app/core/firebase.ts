import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

import { environment } from '../../environments/environment';

// Instancias de Firebase de la app. Se usan directamente con el SDK modular
// (sin @angular/fire): Angular trabaja sin zone.js y el estado se guarda en
// signals.

export const app = initializeApp(environment.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, environment.functionsRegion);

if (environment.useEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

/**
 * Llama a una Cloud Function. Con limite de tiempo para que una conexion
 * caida no deje la pantalla esperando indefinidamente.
 */
export async function llamar<T = unknown>(nombre: string, datos: unknown, timeout = 20000): Promise<T> {
  const resultado = await httpsCallable<unknown, T>(functions, nombre, { timeout })(datos);
  return resultado.data;
}
