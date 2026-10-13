// Lector minimo de volcados de mysqldump: extrae, por tabla, el orden de las
// columnas (del CREATE TABLE o de la lista del INSERT) y las filas de los
// INSERT (con o sin --extended-insert). Pensado para el volcado de la app
// antigua, no es un parser SQL general.
//
// Los BLOB tienen que venir con --hex-blob (0x...): como texto binario no
// sobreviven a la lectura del fichero como UTF-8.

export type Valor = string | number | null | Buffer;

export interface Tabla {
  columnas: string[];
  filas: Valor[][];
}

export interface Dump {
  tablas: Map<string, Tabla>;
  /** El volcado fija TIME_ZONE='+00:00' (por defecto en mysqldump: --tz-utc). */
  fechasEnUtc: boolean;
  avisos: string[];
}

export function parsearDump(sql: string): Dump {
  const tablas = new Map<string, Tabla>();
  const avisos: string[] = [];
  const fechasEnUtc = /SET\s+TIME_ZONE\s*=\s*'\+00:00'/i.test(sql);

  const reCreate = /CREATE TABLE `([^`]+)` \(([\s\S]*?)\n\)[^;]*;/g;
  for (const m of sql.matchAll(reCreate)) {
    const columnas = [...m[2].matchAll(/^\s*`([^`]+)`/gm)].map((c) => c[1]);
    tablas.set(m[1], { columnas, filas: [] });
  }

  const reInsert = /INSERT INTO `([^`]+)`\s*(\(([^)]*)\))?\s*VALUES\s*/g;
  let m: RegExpExecArray | null;
  while ((m = reInsert.exec(sql))) {
    const nombre = m[1];
    let tabla = tablas.get(nombre);
    if (!tabla) {
      tabla = { columnas: [], filas: [] };
      tablas.set(nombre, tabla);
    }
    if (m[3]) {
      const columnas = [...m[3].matchAll(/`([^`]+)`/g)].map((c) => c[1]);
      if (!tabla.columnas.length) tabla.columnas = columnas;
      else if (columnas.join() !== tabla.columnas.join()) {
        throw new Error(`Columnas distintas en los INSERT de ${nombre}`);
      }
    }
    const lector = new Lector(sql, reInsert.lastIndex);
    const filas = lector.leerTuplas();
    if (lector.vioBinarioComoTexto) {
      avisos.push(`${nombre}: hay BLOB volcados como texto; repite el volcado con --hex-blob.`);
    }
    tabla.filas.push(...filas);
    reInsert.lastIndex = lector.pos;
  }

  for (const [nombre, tabla] of tablas) {
    if (tabla.filas.length && !tabla.columnas.length) {
      throw new Error(`No se sabe el orden de columnas de ${nombre} (falta el CREATE TABLE).`);
    }
    for (const fila of tabla.filas) {
      if (fila.length !== tabla.columnas.length) {
        throw new Error(`${nombre}: una fila tiene ${fila.length} valores y la tabla ${tabla.columnas.length} columnas.`);
      }
    }
  }
  return { tablas, fechasEnUtc, avisos };
}

/** Convierte las filas de una tabla en objetos { columna: valor }. */
export function filasComoObjetos(dump: Dump, tabla: string): Record<string, Valor>[] {
  const t = dump.tablas.get(tabla);
  if (!t) return [];
  return t.filas.map((fila) =>
    Object.fromEntries(t.columnas.map((c, i) => [c, fila[i]])),
  );
}

const ESCAPES: Record<string, string> = {
  '0': '\0',
  b: '\b',
  n: '\n',
  r: '\r',
  t: '\t',
  Z: '\x1a',
};

class Lector {
  vioBinarioComoTexto = false;

  constructor(
    private readonly s: string,
    public pos: number,
  ) {}

  leerTuplas(): Valor[][] {
    const filas: Valor[][] = [];
    for (;;) {
      this.espacios();
      this.esperar('(');
      const fila: Valor[] = [];
      for (;;) {
        this.espacios();
        fila.push(this.valor());
        this.espacios();
        const c = this.s[this.pos++];
        if (c === ')') break;
        if (c !== ',') throw this.error(`se esperaba , o ) y hay "${c}"`);
      }
      filas.push(fila);
      this.espacios();
      const c = this.s[this.pos++];
      if (c === ';') return filas;
      if (c !== ',') throw this.error(`se esperaba , o ; y hay "${c}"`);
    }
  }

  private valor(): Valor {
    const s = this.s;
    if (s.startsWith('NULL', this.pos)) {
      this.pos += 4;
      return null;
    }
    if (s[this.pos] === "'") return this.cadena();
    if (s.startsWith('_binary', this.pos)) {
      this.pos += 7;
      this.espacios();
      this.vioBinarioComoTexto = true;
      return Buffer.from(this.cadena(), 'latin1');
    }
    const hex = /^0x([0-9A-Fa-f]*)/.exec(s.slice(this.pos, this.pos + 64));
    if (hex) {
      const fin = s.slice(this.pos + 2).search(/[^0-9A-Fa-f]/);
      const digitos = s.slice(this.pos + 2, fin === -1 ? undefined : this.pos + 2 + fin);
      this.pos += 2 + digitos.length;
      return Buffer.from(digitos, 'hex');
    }
    const num = /^-?\d+(\.\d+)?([eE][-+]?\d+)?/.exec(s.slice(this.pos, this.pos + 64));
    if (num) {
      this.pos += num[0].length;
      return Number(num[0]);
    }
    throw this.error('valor no reconocido');
  }

  private cadena(): string {
    this.esperar("'");
    let out = '';
    for (;;) {
      const c = this.s[this.pos++];
      if (c === undefined) throw this.error('cadena sin cerrar');
      if (c === '\\') {
        const e = this.s[this.pos++];
        out += ESCAPES[e] ?? e;
      } else if (c === "'") {
        if (this.s[this.pos] === "'") {
          out += "'";
          this.pos++;
        } else {
          return out;
        }
      } else {
        out += c;
      }
    }
  }

  private espacios() {
    while (/\s/.test(this.s[this.pos] ?? '')) this.pos++;
  }

  private esperar(c: string) {
    if (this.s[this.pos] !== c) throw this.error(`se esperaba "${c}"`);
    this.pos++;
  }

  private error(msg: string) {
    const linea = this.s.slice(0, this.pos).split('\n').length;
    return new Error(`Volcado SQL, linea ${linea}: ${msg}`);
  }
}
