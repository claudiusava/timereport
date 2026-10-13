import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";

import { emailDeLogin, normalizarUsername } from "./email-usuario";

// Alta, edicion y baja de usuarios. Solo puede llamarlas un admin, y solo
// sobre usuarios de su propio cliente. Mantienen sincronizados:
//   - la cuenta de Firebase Auth (email, contraseña, deshabilitada),
//   - los custom claims { clienteId, rol } que usan las reglas,
//   - clientes/{c}/usuarios/{uid},
//   - el array `asignados` de cada comunidad.

const ROLES = ["admin", "socorrista", "maquinista"] as const;
type Rol = (typeof ROLES)[number];

const PASSWORD_MINIMA = 6;
const MAX_COMUNIDADES = 2000;

interface Llamante {
  uid: string;
  clienteId: string;
}

function exigirAdmin(request: CallableRequest): Llamante {
  const token = request.auth?.token;
  if (!request.auth || !token) {
    throw new HttpsError("unauthenticated", "Tienes que iniciar sesión.");
  }
  if (token.rol !== "admin" || typeof token.clienteId !== "string") {
    throw new HttpsError("permission-denied", "Solo un administrador puede gestionar usuarios.");
  }
  return { uid: request.auth.uid, clienteId: token.clienteId };
}

function objeto(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    throw new HttpsError("invalid-argument", "Datos no válidos.");
  }
  return data as Record<string, unknown>;
}

function texto(valor: unknown, campo: string, max: number): string {
  if (typeof valor !== "string" || !valor.trim() || valor.trim().length > max) {
    throw new HttpsError("invalid-argument", `El campo ${campo} no es válido.`);
  }
  return valor.trim();
}

function rol(valor: unknown): Rol {
  if (!ROLES.includes(valor as Rol)) {
    throw new HttpsError("invalid-argument", "Rol no válido.");
  }
  return valor as Rol;
}

function password(valor: unknown): string {
  if (typeof valor !== "string" || valor.length < PASSWORD_MINIMA || valor.length > 128) {
    throw new HttpsError(
      "invalid-argument",
      `La contraseña debe tener al menos ${PASSWORD_MINIMA} caracteres.`,
    );
  }
  return valor;
}

function listaIds(valor: unknown): string[] {
  if (
    !Array.isArray(valor) ||
    valor.length > MAX_COMUNIDADES ||
    !valor.every((v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v))
  ) {
    throw new HttpsError("invalid-argument", "Lista de comunidades no válida.");
  }
  return [...new Set(valor as string[])];
}

/** Email de login y nombre de usuario a guardar a partir de lo que escribe el admin. */
function identidad(usuario: string, clienteId: string) {
  let email: string;
  try {
    email = emailDeLogin(usuario, clienteId);
  } catch {
    throw new HttpsError("invalid-argument", "El nombre de usuario no es válido.");
  }
  if (usuario.includes("@") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "El email no es válido.");
  }
  return { email, username: usuario.includes("@") ? "" : normalizarUsername(usuario) };
}

function errorAuth(e: unknown): never {
  const code = (e as { code?: string }).code;
  if (code === "auth/email-already-exists") {
    throw new HttpsError("already-exists", "Ya existe un usuario con ese nombre.");
  }
  if (code === "auth/invalid-password") {
    throw new HttpsError("invalid-argument", "La contraseña no es válida.");
  }
  if (code === "auth/invalid-email") {
    throw new HttpsError("invalid-argument", "El usuario no es válido.");
  }
  throw e;
}

function refCliente(clienteId: string) {
  return getFirestore().collection("clientes").doc(clienteId);
}

async function exigirComunidades(clienteId: string, ids: string[]) {
  if (!ids.length) return;
  const refs = ids.map((id) => refCliente(clienteId).collection("comunidades").doc(id));
  const docs = await getFirestore().getAll(...refs);
  if (docs.some((d) => !d.exists)) {
    throw new HttpsError("invalid-argument", "Alguna de las comunidades ya no existe.");
  }
}

/** Usuario del mismo cliente que el admin; si no, "no encontrado". */
async function usuarioDelCliente(clienteId: string, uid: unknown) {
  if (typeof uid !== "string" || !uid) {
    throw new HttpsError("invalid-argument", "Usuario no válido.");
  }
  const ref = refCliente(clienteId).collection("usuarios").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "El usuario no existe.");
  return { ref, uid, datos: snap.data() as { rol: Rol; email: string; activo: boolean } };
}

export const crearUsuario = onCall(async (request) => {
  const { clienteId, uid: adminUid } = exigirAdmin(request);
  const d = objeto(request.data);
  const nombre = texto(d.nombre, "nombre", 100);
  const usuario = texto(d.usuario, "usuario", 100);
  const pass = password(d.password);
  const nuevoRol = rol(d.rol);
  const comunidades = nuevoRol === "admin" ? [] : listaIds(d.comunidades);
  const { email, username } = identidad(usuario, clienteId);
  await exigirComunidades(clienteId, comunidades);

  const auth = getAuth();
  let uid: string;
  try {
    ({ uid } = await auth.createUser({ email, password: pass, displayName: nombre }));
  } catch (e) {
    errorAuth(e);
  }

  try {
    await auth.setCustomUserClaims(uid, { clienteId, rol: nuevoRol });
    const batch = getFirestore().batch();
    batch.set(refCliente(clienteId).collection("usuarios").doc(uid), {
      nombre,
      username,
      email,
      rol: nuevoRol,
      activo: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    for (const id of comunidades) {
      batch.update(refCliente(clienteId).collection("comunidades").doc(id), {
        asignados: FieldValue.arrayUnion(uid),
      });
    }
    await batch.commit();
  } catch (e) {
    // Sin el documento el usuario quedaria a medias: se deshace el alta.
    await auth.deleteUser(uid).catch(() => undefined);
    throw e;
  }

  logger.info("Usuario creado", { clienteId, uid, rol: nuevoRol, por: adminUid });
  return { uid };
});

export const actualizarUsuario = onCall(async (request) => {
  const { clienteId, uid: adminUid } = exigirAdmin(request);
  const d = objeto(request.data);
  const { ref, uid, datos } = await usuarioDelCliente(clienteId, d.uid);
  const nombre = texto(d.nombre, "nombre", 100);
  const usuario = texto(d.usuario, "usuario", 100);
  const nuevoRol = rol(d.rol);
  const comunidades = nuevoRol === "admin" ? [] : listaIds(d.comunidades);
  const { email, username } = identidad(usuario, clienteId);

  if (uid === adminUid && nuevoRol !== "admin") {
    throw new HttpsError(
      "failed-precondition",
      "No puedes quitarte a ti mismo el rol de administrador.",
    );
  }
  await exigirComunidades(clienteId, comunidades);

  const auth = getAuth();
  if (email !== datos.email) {
    try {
      await auth.updateUser(uid, { email, displayName: nombre });
    } catch (e) {
      errorAuth(e);
    }
  } else {
    await auth.updateUser(uid, { displayName: nombre });
  }
  if (nuevoRol !== datos.rol) {
    await auth.setCustomUserClaims(uid, { clienteId, rol: nuevoRol });
  }

  const comunidadesRef = refCliente(clienteId).collection("comunidades");
  const actuales = await comunidadesRef.where("asignados", "array-contains", uid).get();
  const idsActuales = new Set(actuales.docs.map((doc) => doc.id));
  const nuevas = new Set(comunidades);

  const batch = getFirestore().batch();
  batch.update(ref, { nombre, username, email, rol: nuevoRol });
  for (const id of nuevas) {
    if (!idsActuales.has(id)) {
      batch.update(comunidadesRef.doc(id), { asignados: FieldValue.arrayUnion(uid) });
    }
  }
  for (const id of idsActuales) {
    if (!nuevas.has(id)) {
      batch.update(comunidadesRef.doc(id), { asignados: FieldValue.arrayRemove(uid) });
    }
  }
  await batch.commit();

  logger.info("Usuario actualizado", { clienteId, uid, rol: nuevoRol, por: adminUid });
  return { uid };
});

export const cambiarEstadoUsuario = onCall(async (request) => {
  const { clienteId, uid: adminUid } = exigirAdmin(request);
  const d = objeto(request.data);
  const { ref, uid } = await usuarioDelCliente(clienteId, d.uid);
  if (typeof d.activo !== "boolean") {
    throw new HttpsError("invalid-argument", "Estado no válido.");
  }
  if (uid === adminUid) {
    throw new HttpsError("failed-precondition", "No puedes desactivarte a ti mismo.");
  }

  const auth = getAuth();
  await auth.updateUser(uid, { disabled: !d.activo });
  // Cierra las sesiones abiertas. Los tokens ya emitidos siguen valiendo
  // hasta 1 h, pero las reglas exigen usuarios/{uid}.activo para registrar
  // fichajes y controles, asi que no podra seguir fichando.
  if (!d.activo) await auth.revokeRefreshTokens(uid);
  await ref.update({ activo: d.activo });

  logger.info("Estado de usuario cambiado", { clienteId, uid, activo: d.activo, por: adminUid });
  return { uid };
});

export const restablecerPassword = onCall(async (request) => {
  const { clienteId, uid: adminUid } = exigirAdmin(request);
  const d = objeto(request.data);
  const { uid } = await usuarioDelCliente(clienteId, d.uid);
  const pass = password(d.password);

  const auth = getAuth();
  try {
    await auth.updateUser(uid, { password: pass });
  } catch (e) {
    errorAuth(e);
  }
  if (uid !== adminUid) await auth.revokeRefreshTokens(uid);

  logger.info("Contraseña restablecida", { clienteId, uid, por: adminUid });
  return { uid };
});
