// `ng serve` trabaja contra los emuladores locales (`npm run emulators`). Un
// projectId que empieza por "demo-" hace que el SDK nunca intente hablar con
// un proyecto real de Firebase.
export const environment = {
  production: false,
  useEmulators: true,
  firebase: {
    apiKey: 'demo-api-key',
    authDomain: 'demo-timereport.firebaseapp.com',
    projectId: 'demo-timereport',
    storageBucket: 'demo-timereport.appspot.com',
    messagingSenderId: '0',
    appId: 'demo-app',
  },
  functionsRegion: 'europe-southwest1',
};
