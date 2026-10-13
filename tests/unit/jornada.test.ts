import { describe, expect, it } from 'vitest';

import { calcularJornadas } from '../../src/app/shared/jornada';
import { siguienteTipo } from '../../src/app/shared/reglas';

const fecha = (dia: number, hora: number, minuto = 0) => {
  const d = new Date(2026, 9, dia, hora, minuto);
  return { toMillis: () => d.getTime(), toDate: () => d };
};
let n = 0;
const f = (tipo: 'entrada' | 'salida', dia: number, hora: number, minuto = 0, anulado: unknown = null) => ({
  id: String(++n),
  uid: 'u',
  tipo,
  fecha: fecha(dia, hora, minuto),
  anulado,
});

describe('calcularJornadas', () => {
  it('suma los tramos de una jornada partida', () => {
    const [j] = calcularJornadas([f('entrada', 5, 8), f('salida', 5, 13), f('entrada', 5, 16), f('salida', 5, 19, 30)]);
    expect(j.minutos).toBe(5 * 60 + 3.5 * 60);
    expect(j.incidencias).toEqual([]);
  });

  it('un turno de noche cuenta en el día de la entrada', () => {
    const jornadas = calcularJornadas([f('entrada', 5, 22), f('salida', 6, 6)], new Date(2026, 9, 7));
    const dia5 = jornadas.find((j) => j.dia.getDate() === 5)!;
    const dia6 = jornadas.find((j) => j.dia.getDate() === 6)!;
    expect(dia5.minutos).toBe(8 * 60);
    expect(dia6.minutos).toBe(0);
    expect(dia6.incidencias).toEqual([]);
  });

  it('detecta entradas sin salida y salidas sin entrada', () => {
    const jornadas = calcularJornadas([f('entrada', 5, 8), f('entrada', 6, 8), f('salida', 6, 14), f('salida', 7, 9)], new Date(2026, 9, 8));
    expect(jornadas.find((j) => j.dia.getDate() === 5)!.incidencias).toEqual(['Entrada sin salida']);
    expect(jornadas.find((j) => j.dia.getDate() === 6)!.minutos).toBe(6 * 60);
    expect(jornadas.find((j) => j.dia.getDate() === 7)!.incidencias).toEqual(['Salida sin entrada']);
  });

  it('una entrada reciente sin salida está en curso, no es incidencia', () => {
    const [j] = calcularJornadas([f('entrada', 5, 8)], new Date(2026, 9, 5, 12));
    expect(j.incidencias).toEqual([]);
    expect(j.tramos[0].abierto).toBe(true);
  });

  it('los anulados se muestran pero no cuentan', () => {
    const [j] = calcularJornadas([f('entrada', 5, 8), f('salida', 5, 9, 0, { motivo: 'x' }), f('salida', 5, 14)]);
    expect(j.fichajes).toHaveLength(3);
    expect(j.minutos).toBe(6 * 60);
  });
});

describe('siguienteTipo', () => {
  const ahora = new Date(2026, 9, 6, 6);
  it('sin fichajes o tras una salida toca entrada', () => {
    expect(siguienteTipo(null, ahora)).toBe('entrada');
    expect(siguienteTipo({ tipo: 'salida', fecha: new Date(2026, 9, 5, 22) }, ahora)).toBe('entrada');
  });

  it('con una entrada de hace menos de 16 h toca salida (aunque sea de ayer)', () => {
    expect(siguienteTipo({ tipo: 'entrada', fecha: new Date(2026, 9, 5, 22) }, ahora)).toBe('salida');
  });

  it('con una entrada de hace más de 16 h se da por olvidada', () => {
    expect(siguienteTipo({ tipo: 'entrada', fecha: new Date(2026, 9, 5, 8) }, ahora)).toBe('entrada');
  });
});
