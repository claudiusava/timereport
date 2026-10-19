const FORMATOS = new Map<number, Intl.NumberFormat>();

/** Numero con coma decimal y un numero fijo de decimales: 7.2 -> "7,2". */
export function decimal(valor: number | null | undefined, decimales = 1): string {
  if (valor == null || Number.isNaN(valor)) return '';
  let formato = FORMATOS.get(decimales);
  if (!formato) {
    formato = new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    FORMATOS.set(decimales, formato);
  }
  return formato.format(valor);
}
