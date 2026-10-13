import { Timestamp } from '@angular/fire/firestore';

const formatoFechaHora = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatoHora = new Intl.DateTimeFormat('es-ES', {
  hour: '2-digit',
  minute: '2-digit',
});

const formatoDia = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * Justo despues de escribir con serverTimestamp() y releer, la fecha puede
 * venir a null hasta que llega la del servidor.
 */
export function aFecha(ts: Timestamp | null | undefined): Date | null {
  return ts ? ts.toDate() : null;
}

export function fechaHora(ts: Timestamp | null | undefined): string {
  const d = aFecha(ts);
  return d ? formatoFechaHora.format(d).replace(',', '') : '—';
}

export function hora(fecha: Date): string {
  return formatoHora.format(fecha);
}

export function diaLargo(fecha: Date): string {
  const texto = formatoDia.format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function inicioDelDia(fecha = new Date()): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

export function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** yyyy-mm-dd en hora local, para <input type="date">. */
export function aInputDate(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function deInputDate(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
