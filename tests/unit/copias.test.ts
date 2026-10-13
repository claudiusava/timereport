import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Algunos ficheros se comparten entre la app y las Cloud Functions como
// copias (cada proyecto compila por separado). Tienen que ser identicos salvo
// la cabecera y el estilo de comillas.
const cuerpo = (ruta: string) =>
  readFileSync(resolve(__dirname, '../..', ruta), 'utf8')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((linea) => !/^\/\/ (Copia de|comprueba)/.test(linea))
    .join('\n')
    .replace(/"/g, "'");

describe('copias compartidas', () => {
  for (const fichero of ['email-usuario.ts', 'reglas.ts']) {
    it(`${fichero} es igual en la app y en las Functions`, () => {
      expect(cuerpo(`functions/src/${fichero}`)).toBe(cuerpo(`src/app/shared/${fichero}`));
    });
  }
});
