import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { emailDeLogin, normalizarUsername } from '../../src/app/shared/email-usuario';

describe('email-usuario', () => {
  it('la copia de functions es idéntica a la del frontend (salvo la cabecera)', () => {
    const cuerpo = (ruta: string) =>
      readFileSync(resolve(__dirname, '../..', ruta), 'utf8')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .slice(2)
        .join('\n');
    expect(cuerpo('functions/src/email-usuario.ts')).toBe(cuerpo('src/app/shared/email-usuario.ts'));
  });

  it('normaliza nombres de usuario', () => {
    expect(normalizarUsername('  JPérez ')).toBe('jperez');
    expect(normalizarUsername('María José')).toBe('maria.jose');
    expect(normalizarUsername('Núñez__2')).toBe('nunez__2');
    expect(normalizarUsername('!!!')).toBe('');
  });

  it('construye el email de login', () => {
    expect(emailDeLogin('JPérez', 'simasport')).toBe('jperez@simasport.timereport.invalid');
    expect(emailDeLogin('Ana@Empresa.com', 'simasport')).toBe('ana@empresa.com');
    expect(() => emailDeLogin('***', 'simasport')).toThrow();
  });
});
