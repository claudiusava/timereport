import { getAuth } from "firebase-admin/auth";
import {
  DocumentData,
  FieldValue,
  Transaction,
  WriteBatch,
  getFirestore,
} from "firebase-admin/firestore";
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

export const ROLES = ["admin", "socorrista", "maquinista"] as const;
export type Rol = (typeof ROLES)[number];

export const PASSWORD_MINIMA = 8;
export const ZONA_POR_DEFECTO = "Europe/Madrid";

export const db = () => getFirestore();
export const auth = () => getAuth();

export function refCliente(clienteId: string) {
  return db().collection("clientes").doc(clienteId);
}

export interface Sesion {
  uid: string;
  clienteId: string;
  rol: Rol;
  nombre: string;
  cliente: DocumentData;
}

/**
 * Quien llama tiene que tener sesion, pertenecer a una empresa activa y
 * tener su perfil activo. El rol sale del perfil de Firestore (la fuente de
 * verdad), no del token: asi un usuario desactivado o al que se le ha quitado
 * el rol pierde el acceso al instante, aunque su token siga vivo hasta 1 h.
 */
export async function exigirSesion(request: CallableRequest): Promise<Sesion> {
  const token = request.auth?.token;
  if (!request.auth || !token) {
    throw new HttpsError("unauthenticated", "Tienes que iniciar sesión.");
  }
  const clienteId = token["clienteId"];
  if (typeof clienteId !== "string" || !clienteId) {
    throw new HttpsError("permission-denied", "Tu usuario no tiene empresa asignada.");
  }
  const [cliente, perfil] = await Promise.all([
    refCliente(clienteId).get(),
    refCliente(clienteId).collection("usuarios").doc(request.auth.uid).get(),
  ]);
  if (!cliente.exists || cliente.get("activo") === false) {
    throw new HttpsError("permission-denied", "La empresa no está activa.");
  }
  if (!perfil.exists || perfil.get("activo") !== true) {
    throw new HttpsError("permission-denied", "Tu usuario está desactivado.");
  }
  return {
    uid: request.auth.uid,
    clienteId,
    rol: perfil.get("rol") as Rol,
    nombre: perfil.get("nombre") as string,
    cliente: cliente.data()!,
  };
}

export async function exigirAdmin(request: CallableRequest): Promise<Sesion> {
  const sesion = await exigirSesion(request);
  if (sesion.rol !== "admin") {
    throw new HttpsError("permission-denied", "Solo un administrador puede hacer esto.");
  }
  return sesion;
}

// ---------------------------------------------------------------- validacion

export function objeto(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpsError("invalid-argument", "Datos no válidos.");
  }
  return data as Record<string, unknown>;
}

export function texto(valor: unknown, campo: string, min: number, max: number): string {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (t.length < min || t.length > max) {
    throw new HttpsError(
      "invalid-argument",
      min > 0 && !t
        ? `Falta ${campo}.`
        : `${campo[0].toUpperCase()}${campo.slice(1)}: entre ${min} y ${max} caracteres.`,
    );
  }
  return t;
}

export function id(valor: unknown, campo = "identificador"): string {
  if (typeof valor !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(valor)) {
    throw new HttpsError("invalid-argument", `El ${campo} no es válido.`);
  }
  return valor;
}

export function numero(valor: unknown, campo: string, min: number, max: number): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < min || valor > max) {
    throw new HttpsError("invalid-argument", `${campo}: debe estar entre ${min} y ${max}.`);
  }
  return valor;
}

export function rol(valor: unknown): Rol {
  if (!ROLES.includes(valor as Rol)) {
    throw new HttpsError("invalid-argument", "Rol no válido.");
  }
  return valor as Rol;
}

export function password(valor: unknown): string {
  if (typeof valor !== "string" || valor.length < PASSWORD_MINIMA || valor.length > 128) {
    throw new HttpsError(
      "invalid-argument",
      `La contraseña debe tener al menos ${PASSWORD_MINIMA} caracteres.`,
    );
  }
  return valor;
}

// ---------------------------------------------------------------- auditoria

export interface EntradaAuditoria {
  accion: string;
  /** Texto legible: "Anula la entrada de Ana López del 12/10/2026 08:01". */
  descripcion: string;
  objetivo?: { coleccion: string; id: string };
  motivo?: string;
}

/**
 * Registro de auditoria solo-añadir (clientes/{c}/auditoria): nadie lo puede
 * modificar ni borrar desde la app (ver firestore.rules).
 */
export function auditar(
  escritor: Transaction | WriteBatch,
  sesion: Sesion,
  entrada: EntradaAuditoria,
) {
  const ref = refCliente(sesion.clienteId).collection("auditoria").doc();
  const datos = {
    ...entrada,
    motivo: entrada.motivo ?? null,
    objetivo: entrada.objetivo ?? null,
    por: { uid: sesion.uid, nombre: sesion.nombre },
    fecha: FieldValue.serverTimestamp(),
  };
  (escritor as WriteBatch).set(ref, datos);
}

// ---------------------------------------------------------------- fechas

/** Desfase (minutos) de una zona horaria respecto a UTC en un instante dado. */
function desfaseMinutos(zona: string, instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instante);
  const v = (t: string) => Number(partes.find((p) => p.type === t)!.value);
  const comoUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return Math.round((comoUtc - instante.getTime()) / 60000);
}

/** Convierte una fecha y hora "de pared" en una zona horaria a un instante. */
export function fechaEnZona(
  zona: string,
  anio: number,
  mes: number,
  dia: number,
  hora = 0,
  minuto = 0,
): Date {
  const aprox = new Date(Date.UTC(anio, mes - 1, dia, hora, minuto));
  const primero = new Date(aprox.getTime() - desfaseMinutos(zona, aprox) * 60000);
  // Segunda pasada por si el cambio de hora cae entre medias.
  return new Date(aprox.getTime() - desfaseMinutos(zona, primero) * 60000);
}

/** Inicio del dia (00:00) en la zona horaria de la empresa. */
export function inicioDelDia(zona: string, instante = new Date()): Date {
  const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: zona })
    .format(instante)
    .split("-")
    .map(Number);
  return fechaEnZona(zona, anio, mes, dia);
}

export function formatoFechaHora(zona: string, instante: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: zona,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(instante)
    .replace(",", "");
}
