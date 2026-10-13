import { Timestamp } from 'firebase/firestore';

const formatoFechaHora = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const formatoFecha = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatoHora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const formatoDiaLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const formatoDiaCorto = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const formatoMes = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Justo despues de escribir con serverTimestamp la fecha puede venir a null. */
export function aFecha(ts: Timestamp | Date | null | undefined): Date | null {
  if (!ts) return null;
  return ts instanceof Date ? ts : ts.toDate();
}

export const fechaHora = (f: Timestamp | Date | null | undefined) => {
  const d = aFecha(f);
  return d ? formatoFechaHora.format(d).replace(',', '') : '—';
};
export const fecha = (d: Date) => formatoFecha.format(d);
export const hora = (f: Timestamp | Date) => formatoHora.format(aFecha(f)!);
export const diaLargo = (d: Date) => mayuscula(formatoDiaLargo.format(d));
export const diaCorto = (d: Date) => mayuscula(formatoDiaCorto.format(d));
export const mes = (d: Date) => mayuscula(formatoMes.format(d));

export function inicioDelDia(d = new Date()): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function sumarDias(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

export function inicioDelMes(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sumarMeses(d: Date, meses: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + meses, 1);
}

export function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "7 h 05 min" */
export function duracion(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')} min` : `${m} min`;
}

/** "7,1 h" */
export function horasDecimal(minutos: number): string {
  return `${(minutos / 60).toFixed(1).replace('.', ',')} h`;
}

/** yyyy-mm-dd para nombres de fichero. */
export function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
