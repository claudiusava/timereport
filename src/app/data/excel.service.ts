import { Injectable, inject } from '@angular/core';

import { EmpresaService } from '../core/empresa.service';

export interface Columna {
  titulo: string;
  ancho: number;
  /** Formato de numero de Excel, p. ej. 'dd/mm/yyyy hh:mm' o '0.0'. */
  formato?: string;
}

export interface Hoja {
  nombre: string;
  columnas: Columna[];
  filas: (string | number | Date | null)[][];
  /** Indices de filas a resaltar en gris (p. ej. registros anulados). */
  atenuadas?: number[];
}

export const FORMATO_FECHA_HORA = 'dd/mm/yyyy hh:mm';
export const FORMATO_FECHA = 'dd/mm/yyyy';

@Injectable({ providedIn: 'root' })
export class ExcelService {
  private readonly empresa = inject(EmpresaService);

  /** Genera el .xlsx en el navegador y lo descarga. */
  async exportar(nombreArchivo: string, hojas: Hoja[]): Promise<void> {
    // exceljs pesa ~1 MB: se carga solo cuando alguien exporta.
    const { Workbook } = await import('exceljs');
    const libro = new Workbook();
    libro.creator = this.empresa.nombreApp();
    libro.created = new Date();
    const color = (this.empresa.empresa()?.branding.colorPrimario ?? '#00658f').replace('#', '').toUpperCase();

    for (const hoja of hojas) {
      const ws = libro.addWorksheet(hoja.nombre.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = hoja.columnas.map((c) => ({
        header: c.titulo,
        width: c.ancho,
        style: c.formato ? { numFmt: c.formato } : {},
      }));
      // exceljs escribe las fechas como UTC: se desplazan para que en el
      // Excel salga la hora local (la que se ve en la app).
      ws.addRows(
        hoja.filas.map((fila) =>
          fila.map((v) => (v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 60000) : v)),
        ),
      );
      const cabecera = ws.getRow(1);
      cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cabecera.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${color}` } };
      cabecera.height = 20;
      for (const i of hoja.atenuadas ?? []) {
        ws.getRow(i + 2).font = { color: { argb: 'FF8A8A8A' }, strike: true };
      }
      if (hoja.filas.length) {
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnas.length } };
      }
    }

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
