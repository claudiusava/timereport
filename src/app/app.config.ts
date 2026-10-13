import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  provideFirestore,
} from '@angular/fire/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  provideFunctions,
} from '@angular/fire/functions';
import {
  connectStorageEmulator,
  getStorage,
  provideStorage,
} from '@angular/fire/storage';
import { provideRouter, withHashLocation } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';

const emu = environment.useEmulators;

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Rutas con hash (#/fichaje): GitHub Pages solo sabe servir ficheros que
    // existen, asi que con rutas "limpias" una recarga en /timereport/fichaje
    // daria 404. Con hash el servidor siempre recibe /timereport/ (index.html,
    // estado 200) y el router resuelve el resto en el navegador.
    provideRouter(routes, withHashLocation()),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => {
      const auth = getAuth();
      if (emu) {
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
          disableWarnings: true,
        });
      }
      return auth;
    }),
    provideFirestore(() => {
      const db = getFirestore();
      if (emu) connectFirestoreEmulator(db, '127.0.0.1', 8080);
      return db;
    }),
    provideStorage(() => {
      const storage = getStorage();
      if (emu) connectStorageEmulator(storage, '127.0.0.1', 9199);
      return storage;
    }),
    provideFunctions(() => {
      const functions = getFunctions(undefined, environment.functionsRegion);
      if (emu) connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      return functions;
    }),
  ],
};
