// Traduce los errores de Firebase a mensajes para el usuario. Los mensajes
// de las Cloud Functions (HttpsError) ya vienen en castellano.

const MENSAJES: Record<string, string> = {
  'permission-denied': 'No tienes permiso para hacer esto.',
  'unavailable': 'Sin conexión. Comprueba tu conexión a internet.',
  'deadline-exceeded': 'El servidor está tardando demasiado. Comprueba tu conexión y vuelve a intentarlo.',
  'functions/deadline-exceeded': 'El servidor está tardando demasiado. Comprueba tu conexión y vuelve a intentarlo.',
  'functions/unavailable': 'Sin conexión. Comprueba tu conexión a internet.',
  'functions/internal': 'Ha ocurrido un error en el servidor. Vuelve a intentarlo.',
  'storage/unauthorized': 'No tienes permiso para hacer esto.',
  'storage/retry-limit-exceeded': 'Sin conexión. Comprueba tu conexión a internet.',
  'storage/object-not-found': 'El archivo no existe.',
  'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
  'auth/invalid-email': 'Usuario o contraseña incorrectos.',
  'auth/user-not-found': 'Usuario o contraseña incorrectos.',
  'auth/wrong-password': 'Usuario o contraseña incorrectos.',
  'auth/user-disabled': 'Tu usuario está desactivado. Avisa al administrador.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
  'auth/network-request-failed': 'Sin conexión. Comprueba tu conexión a internet.',
  'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión y repite la operación.',
  'auth/weak-password': 'La contraseña es demasiado débil.',
};

export function mensajeDeError(e: unknown, porDefecto = 'Ha ocurrido un error. Vuelve a intentarlo.'): string {
  const error = e as { code?: unknown; message?: string };
  const code = typeof error?.code === 'string' ? error.code : '';
  // Errores de negocio de las Cloud Functions: su mensaje ya es para el usuario.
  if (
    code.startsWith('functions/') &&
    !['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded'].includes(code) &&
    error.message
  ) {
    return error.message;
  }
  if (MENSAJES[code]) return MENSAJES[code];
  // Errores propios de la app (new Error('...')): sin codigo y en castellano.
  if (!code && e instanceof Error && e.message && !/firebase/i.test(e.message)) return e.message;
  return porDefecto;
}
