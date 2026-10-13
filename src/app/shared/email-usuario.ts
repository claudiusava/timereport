// Copia de functions/src/email-usuario.ts: si cambias una, cambia la otra (lo
// comprueba tests/unit/copias.test.ts).
//
// Los trabajadores entran con nombre de usuario, no con email. Firebase Auth
// solo admite email, asi que cada usuario tiene un email sintetico que nunca
// ve: `usuario@cliente.timereport.invalid` (.invalid es un dominio reservado,
// RFC 2606, al que jamas llega correo). Si alguien escribe un email real (con
// @), se usa tal cual.

export const DOMINIO_SINTETICO = 'timereport.invalid';

export function normalizarUsername(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

export function emailDeLogin(usuarioOEmail: string, clienteId: string): string {
  const valor = usuarioOEmail.trim();
  if (valor.includes('@')) return valor.toLowerCase();
  const local = normalizarUsername(valor);
  if (!local) throw new Error('Nombre de usuario no valido');
  return `${local}@${clienteId}.${DOMINIO_SINTETICO}`;
}

export function esEmailSintetico(email: string): boolean {
  return email.endsWith(`.${DOMINIO_SINTETICO}`);
}
