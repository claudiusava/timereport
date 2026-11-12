import { DocumentData, Query, QueryDocumentSnapshot, getDocs, limit, query, startAfter } from 'firebase/firestore';

/** Documentos por pagina al leer consultas largas. */
export const POR_PAGINA = 1000;

/**
 * Lee todos los documentos de una consulta (que ya debe llevar su orderBy)
 * en paginas de POR_PAGINA, para no tener un tope de registros.
 */
export async function leerTodo(base: Query<DocumentData>, porPagina = POR_PAGINA): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const todos: QueryDocumentSnapshot<DocumentData>[] = [];
  for (;;) {
    const ultimo = todos.at(-1);
    const snap = await getDocs(query(base, ...(ultimo ? [startAfter(ultimo)] : []), limit(porPagina)));
    todos.push(...snap.docs);
    if (snap.docs.length < porPagina) return todos;
  }
}
