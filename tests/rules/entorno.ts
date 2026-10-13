import {
  RulesTestContext,
  RulesTestEnvironment,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { GeoPoint, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const PROYECTO = 'demo-timereport';

/**
 * Datos de prueba: dos clientes (a y b) para comprobar el aislamiento.
 *   a: adminA, socA (socorrista), maqA (maquinista), bajaA (desactivado)
 *   b: adminB, socB
 *   comA1 asignada a socA, maqA y bajaA; comA2 sin asignar; comB1 a socB.
 */
export const USUARIOS = {
  adminA: { clienteId: 'a', rol: 'admin', nombre: 'Admin A', activo: true },
  socA: { clienteId: 'a', rol: 'socorrista', nombre: 'Socorrista A', activo: true },
  maqA: { clienteId: 'a', rol: 'maquinista', nombre: 'Maquinista A', activo: true },
  bajaA: { clienteId: 'a', rol: 'socorrista', nombre: 'Baja A', activo: false },
  adminB: { clienteId: 'b', rol: 'admin', nombre: 'Admin B', activo: true },
  socB: { clienteId: 'b', rol: 'socorrista', nombre: 'Socorrista B', activo: true },
} as const;

export type NombreUsuario = keyof typeof USUARIOS;

export async function crearEntorno(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROYECTO,
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
    },
    storage: {
      rules: readFileSync(resolve(__dirname, '../../storage.rules'), 'utf8'),
    },
  });
}

export function como(env: RulesTestEnvironment, nombre: NombreUsuario): RulesTestContext {
  const u = USUARIOS[nombre];
  return env.authenticatedContext(nombre, { clienteId: u.clienteId, rol: u.rol });
}

export async function sembrar(env: RulesTestEnvironment) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const c of ['a', 'b']) {
      await setDoc(doc(db, 'clientes', c), {
        nombre: `Cliente ${c}`,
        activo: true,
        branding: { nombreApp: 'TimeReport', logoPath: '', colorPrimario: '#0e7490', colorSecundario: '#164e63' },
        config: { radioFichajeM: 1000, maxFichajesDia: 2 },
      });
    }
    for (const [uid, u] of Object.entries(USUARIOS)) {
      await setDoc(doc(db, 'clientes', u.clienteId, 'usuarios', uid), {
        nombre: u.nombre,
        username: uid.toLowerCase(),
        email: `${uid.toLowerCase()}@${u.clienteId}.timereport.invalid`,
        rol: u.rol,
        activo: u.activo,
      });
    }
    const comunidad = (nombre: string, asignados: string[]) => ({
      nombre,
      codigo: nombre,
      ubicacion: new GeoPoint(40.4, -3.7),
      asignados,
      activa: true,
    });
    await setDoc(doc(db, 'clientes/a/comunidades/comA1'), comunidad('Comunidad A1', ['socA', 'maqA', 'bajaA']));
    await setDoc(doc(db, 'clientes/a/comunidades/comA2'), comunidad('Comunidad A2', []));
    await setDoc(doc(db, 'clientes/b/comunidades/comB1'), comunidad('Comunidad B1', ['socB']));
  });
}
