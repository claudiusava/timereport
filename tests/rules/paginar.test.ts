import { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, collection, doc, orderBy, query, setDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { leerTodo } from '../../src/app/data/paginar';
import { como, crearEntorno, sembrar } from './entorno';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await crearEntorno();
  await sembrar(env);
  // 25 fichajes; varios comparten la misma hora para comprobar los empates.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (let i = 0; i < 25; i++) {
      await setDoc(doc(db, `clientes/a/imputaciones/pag${String(i).padStart(2, '0')}`), {
        uid: 'maqA',
        tipo: 'entrada',
        fecha: Timestamp.fromMillis(Date.UTC(2025, 0, 1) + Math.floor(i / 3) * 60000),
        anulado: null,
      });
    }
  });
});

afterAll(async () => {
  await env.cleanup();
});

describe('leerTodo', () => {
  it('lee todas las páginas sin repetir ni perder documentos', async () => {
    const db = como(env, 'adminA').firestore();
    const base = query(
      collection(db, 'clientes/a/imputaciones'),
      where('fecha', '<', Timestamp.fromMillis(Date.UTC(2026, 0, 1))),
      orderBy('fecha', 'desc'),
    );
    for (const porPagina of [1, 7, 10, 25, 100]) {
      const docs = await leerTodo(base, porPagina);
      const ids = docs.map((d) => d.id);
      expect(ids).toHaveLength(25);
      expect(new Set(ids).size).toBe(25);
    }
  });
});
