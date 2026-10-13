// Configuracion de produccion. Los valores de `firebase` son PUBLICOS (identifican
// el proyecto, no dan acceso): la seguridad la ponen las reglas de Firestore y
// Storage y las comprobaciones de las Cloud Functions. Se obtienen en la consola
// de Firebase > Configuracion del proyecto > Tus apps > App web.
export const environment = {
  production: true,
  useEmulators: false,
  firebase: {
    apiKey: 'REEMPLAZAR',
    authDomain: 'REEMPLAZAR.firebaseapp.com',
    projectId: 'REEMPLAZAR',
    storageBucket: 'REEMPLAZAR.firebasestorage.app',
    messagingSenderId: 'REEMPLAZAR',
    appId: 'REEMPLAZAR',
  },
  // Debe coincidir con la region de functions/src/config.ts.
  functionsRegion: 'europe-southwest1',
};
