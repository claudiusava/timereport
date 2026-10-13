import { FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  Rol,
  Sesion,
  auditar,
  auth,
  db,
  exigirAdmin,
  id,
  objeto,
  password,
  refCliente,
  rol,
  texto,
} from "./comun.js";
import { emailDeLogin, normalizarUsername } from "./email-usuario.js";

// Alta, edicion y baja de usuarios. Solo un admin activo, y solo sobre su
// propia empresa. Firestore (clientes/{c}/usuarios/{uid}) es la fuente de
// verdad del rol y del estado; Auth y los custom claims se sincronizan.

const MAX_COMUNIDADES = 2000;
const MAX_USUARIOS_POR_DEFECTO = 500;

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "administrador",
  socorrista: "socorrista",
  maquinista: "maquinista",
};

function listaIds(valor: unknown): string[] {
  if (!Array.isArray(valor) || valor.length > MAX_COMUNIDADES) {
    throw new HttpsError("invalid-argument", "Lista de comunidades no válida.");
  }
  return [...new Set(valor.map((v) => id(v, "identificador de comunidad")))];
}

/**
 * Solo nombres de usuario (nada de emails): el email de login se construye
 * siempre con la empresa de quien llama, asi que un admin no puede ocupar ni
 * sondear usuarios de otra empresa.
 */
function identidad(usuario: unknown, clienteId: string) {
  const original = texto(usuario, "el usuario", 1, 60);
  if (original.includes("@")) {
    throw new HttpsError("invalid-argument", "Usa un nombre de usuario, no un email.");
  }
  const username = normalizarUsername(original);
  if (username.length < 2) {
    throw new HttpsError("invalid-argument", "El nombre de usuario no es válido.");
  }
  return { username, email: emailDeLogin(username, clienteId) };
}

function errorAuth(e: unknown): never {
  const code = (e as { code?: string }).code;
  if (code === "auth/email-already-exists") {
    throw new HttpsError("already-exists", "Ya existe un usuario con ese nombre.");
  }
  if (code === "auth/invalid-password") {
    throw new HttpsError("invalid-argument", "La contraseña no es válida.");
  }
  throw e;
}

function sinDemo(sesion: Sesion) {
  if (sesion.cliente["demo"] === true) {
    throw new HttpsError(
      "failed-precondition",
      "En la empresa de demostración no se pueden cambiar contraseñas ni desactivar usuarios.",
    );
  }
}

async function exigirComunidades(clienteId: string, ids: string[]) {
  if (!ids.length) return;
  const docs = await db().getAll(
    ...ids.map((c) => refCliente(clienteId).collection("comunidades").doc(c)),
  );
  if (docs.some((d) => !d.exists)) {
    throw new HttpsError("invalid-argument", "Alguna de las comunidades ya no existe.");
  }
}

/** Numero de admins activos de la empresa, sin contar a `excepto`. */
async function adminsActivos(clienteId: string, excepto: string, tx: FirebaseFirestore.Transaction) {
  const snap = await tx.get(
    refCliente(clienteId).collection("usuarios").where("rol", "==", "admin").where("activo", "==", true),
  );
  return snap.docs.filter((d) => d.id !== excepto).length;
}

export const crearUsuario = onCall(async (request) => {
  const sesion = await exigirAdmin(request);
  const d = objeto(request.data);
  const nombre = texto(d["nombre"], "el nombre", 1, 100);
  const pass = password(d["password"]);
  const nuevoRol = rol(d["rol"]);
  const comunidades = nuevoRol === "admin" ? [] : listaIds(d["comunidades"]);
  const { username, email } = identidad(d["usuario"], sesion.clienteId);
  await exigirComunidades(sesion.clienteId, comunidades);

  const usuarios = refCliente(sesion.clienteId).collection("usuarios");
  const maximo: number = sesion.cliente["config"]?.maxUsuarios ?? MAX_USUARIOS_POR_DEFECTO;
  const total = (await usuarios.count().get()).data().count;
  if (total >= maximo) {
    throw new HttpsError("resource-exhausted", `Tu plan permite como máximo ${maximo} usuarios.`);
  }

  let uid: string;
  try {
    ({ uid } = await auth().createUser({ email, password: pass, displayName: nombre }));
  } catch (e) {
    errorAuth(e);
  }

  try {
    await auth().setCustomUserClaims(uid, { clienteId: sesion.clienteId, rol: nuevoRol });
    const batch = db().batch();
    batch.set(usuarios.doc(uid), {
      nombre,
      username,
      email,
      rol: nuevoRol,
      activo: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    for (const c of comunidades) {
      batch.update(refCliente(sesion.clienteId).collection("comunidades").doc(c), {
        asignados: FieldValue.arrayUnion(uid),
      });
    }
    auditar(batch, sesion, {
      accion: "usuario.crear",
      descripcion: `Da de alta a ${nombre} (${username}) como ${ETIQUETA_ROL[nuevoRol]}`,
      objetivo: { coleccion: "usuarios", id: uid },
    });
    await batch.commit();
  } catch (e) {
    // Sin perfil el usuario quedaria a medias: se deshace el alta.
    await auth().deleteUser(uid).catch(() => undefined);
    throw e;
  }

  logger.info("Usuario creado", { clienteId: sesion.clienteId, uid, rol: nuevoRol, por: sesion.uid });
  return { uid };
});

export const actualizarUsuario = onCall(async (request) => {
  const sesion = await exigirAdmin(request);
  const d = objeto(request.data);
  const uid = id(d["uid"], "usuario");
  const nombre = texto(d["nombre"], "el nombre", 1, 100);
  const nuevoRol = rol(d["rol"]);
  const comunidades = nuevoRol === "admin" ? [] : listaIds(d["comunidades"]);
  const { username, email } = identidad(d["usuario"], sesion.clienteId);
  if (uid === sesion.uid && nuevoRol !== "admin") {
    throw new HttpsError("failed-precondition", "No puedes quitarte a ti mismo el rol de administrador.");
  }
  await exigirComunidades(sesion.clienteId, comunidades);

  const cliente = refCliente(sesion.clienteId);
  const perfilRef = cliente.collection("usuarios").doc(uid);
  const antes = await perfilRef.get();
  if (!antes.exists) throw new HttpsError("not-found", "El usuario no existe.");
  const rolAnterior = antes.get("rol") as Rol;
  const emailAnterior = antes.get("email") as string;

  // 1. Auth primero solo si cambia el email (puede chocar con otro usuario).
  if (email !== emailAnterior) {
    try {
      await auth().updateUser(uid, { email, displayName: nombre });
    } catch (e) {
      errorAuth(e);
    }
  }

  // 2. Firestore (fuente de verdad) en una transaccion.
  try {
    await db().runTransaction(async (tx) => {
      const perfil = await tx.get(perfilRef);
      if (!perfil.exists) throw new HttpsError("not-found", "El usuario no existe.");
      if (perfil.get("rol") === "admin" && nuevoRol !== "admin" && perfil.get("activo") === true) {
        if ((await adminsActivos(sesion.clienteId, uid, tx)) === 0) {
          throw new HttpsError("failed-precondition", "La empresa tiene que tener al menos un administrador activo.");
        }
      }
      const actuales = await tx.get(cliente.collection("comunidades").where("asignados", "array-contains", uid));
      const idsActuales = new Set(actuales.docs.map((c) => c.id));
      const nuevas = new Set(comunidades);
      tx.update(perfilRef, { nombre, username, email, rol: nuevoRol });
      for (const c of nuevas) {
        if (!idsActuales.has(c)) tx.update(cliente.collection("comunidades").doc(c), { asignados: FieldValue.arrayUnion(uid) });
      }
      for (const c of idsActuales) {
        if (!nuevas.has(c)) tx.update(cliente.collection("comunidades").doc(c), { asignados: FieldValue.arrayRemove(uid) });
      }
      const cambios = [
        perfil.get("nombre") !== nombre ? `nombre: ${perfil.get("nombre")} → ${nombre}` : "",
        perfil.get("username") !== username ? `usuario: ${perfil.get("username")} → ${username}` : "",
        rolAnterior !== nuevoRol ? `rol: ${ETIQUETA_ROL[rolAnterior]} → ${ETIQUETA_ROL[nuevoRol]}` : "",
        comunidades.length !== idsActuales.size || comunidades.some((c) => !idsActuales.has(c))
          ? `comunidades asignadas: ${comunidades.length}`
          : "",
      ].filter(Boolean);
      auditar(tx, sesion, {
        accion: "usuario.editar",
        descripcion: `Edita a ${nombre}${cambios.length ? ` (${cambios.join("; ")})` : ""}`,
        objetivo: { coleccion: "usuarios", id: uid },
      });
    });
  } catch (e) {
    if (email !== emailAnterior) {
      await auth().updateUser(uid, { email: emailAnterior }).catch(() => undefined);
    }
    throw e;
  }

  // 3. Claims y sesiones. Si esto fallara, las reglas y las Functions ya
  //    usan el rol de Firestore, asi que no hay escalada de privilegios.
  if (email === emailAnterior) await auth().updateUser(uid, { displayName: nombre });
  if (nuevoRol !== rolAnterior) {
    await auth().setCustomUserClaims(uid, { clienteId: sesion.clienteId, rol: nuevoRol });
    await auth().revokeRefreshTokens(uid);
  }

  logger.info("Usuario actualizado", { clienteId: sesion.clienteId, uid, rol: nuevoRol, por: sesion.uid });
  return { uid };
});

export const cambiarEstadoUsuario = onCall(async (request) => {
  const sesion = await exigirAdmin(request);
  sinDemo(sesion);
  const d = objeto(request.data);
  const uid = id(d["uid"], "usuario");
  if (typeof d["activo"] !== "boolean") throw new HttpsError("invalid-argument", "Estado no válido.");
  const activo = d["activo"];
  if (uid === sesion.uid) throw new HttpsError("failed-precondition", "No puedes desactivarte a ti mismo.");

  const perfilRef = refCliente(sesion.clienteId).collection("usuarios").doc(uid);
  let nombre = "";
  await db().runTransaction(async (tx) => {
    const perfil = await tx.get(perfilRef);
    if (!perfil.exists) throw new HttpsError("not-found", "El usuario no existe.");
    nombre = perfil.get("nombre");
    if (!activo && perfil.get("rol") === "admin" && (await adminsActivos(sesion.clienteId, uid, tx)) === 0) {
      throw new HttpsError("failed-precondition", "La empresa tiene que tener al menos un administrador activo.");
    }
    tx.update(perfilRef, { activo });
    auditar(tx, sesion, {
      accion: activo ? "usuario.reactivar" : "usuario.desactivar",
      descripcion: `${activo ? "Reactiva" : "Desactiva"} a ${nombre}`,
      objetivo: { coleccion: "usuarios", id: uid },
    });
  });

  await auth().updateUser(uid, { disabled: !activo });
  if (!activo) await auth().revokeRefreshTokens(uid);
  logger.info("Estado de usuario cambiado", { clienteId: sesion.clienteId, uid, activo, por: sesion.uid });
  return { uid };
});

export const restablecerPassword = onCall(async (request) => {
  const sesion = await exigirAdmin(request);
  sinDemo(sesion);
  const d = objeto(request.data);
  const uid = id(d["uid"], "usuario");
  const pass = password(d["password"]);
  const perfil = await refCliente(sesion.clienteId).collection("usuarios").doc(uid).get();
  if (!perfil.exists) throw new HttpsError("not-found", "El usuario no existe.");

  try {
    await auth().updateUser(uid, { password: pass });
  } catch (e) {
    errorAuth(e);
  }
  if (uid !== sesion.uid) await auth().revokeRefreshTokens(uid);

  const batch = db().batch();
  auditar(batch, sesion, {
    accion: "usuario.password",
    descripcion: `Cambia la contraseña de ${perfil.get("nombre")}`,
    objetivo: { coleccion: "usuarios", id: uid },
  });
  await batch.commit();
  logger.info("Contraseña restablecida", { clienteId: sesion.clienteId, uid, por: sesion.uid });
  return { uid };
});
