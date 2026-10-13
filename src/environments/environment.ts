// Configuracion de produccion. Los valores de `firebase` son PUBLICOS (identifican
// el proyecto, no dan acceso): la seguridad la ponen las reglas de Firestore y
// Storage y las comprobaciones de las Cloud Functions. Se obtienen en la consola
// de Firebase > Configuracion del proyecto > Tus apps > App web.
export const environment = {
  production: true,
  useEmulators: false,
  firebase: {
    apiKey: 'AIzaSyD7NmRnW0zT69ViPKjRV4uq6Hyhiu5Onvw',
    authDomain: 'timereport-app.firebaseapp.com',
    projectId: 'timereport-app',
    storageBucket: 'timereport-app.firebasestorage.app',
    messagingSenderId: '4688823749',
    appId: '1:4688823749:web:e1b0031104e133464ab7ac',
  },
  // Debe coincidir con la region de functions/src/index.ts.
  functionsRegion: 'europe-southwest1',
};
