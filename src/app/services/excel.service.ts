import { Injectable, inject } from '@angular/core';

import { BrandingService } from './branding.service';

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
}

@Injectable({ providedIn: 'root' })
export class ExcelService {
  private readonly branding = inject(BrandingService);

  /** Genera el .xlsx en el navegador y lo descarga. */
  async exportar(nombreArchivo: string, hojas: Hoja[]): Promise<void> {
    // exceljs pesa ~1 MB: se carga solo cuando alguien exporta.
    const { Workbook } = await import('exceljs');
    const libro = new Workbook();
    libro.creator = this.branding.nombreApp();
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-primario')
      .trim()
      .replace('#', '');

    for (const hoja of hojas) {
      const ws = libro.addWorksheet(hoja.nombre, {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      ws.columns = hoja.columnas.map((c) => ({
        header: c.titulo,
        width: c.ancho,
        style: c.formato ? { numFmt: c.formato } : {},
      }));
      // exceljs escribe las fechas como UTC: se desplazan para que en el
      // Excel salga la hora local (la que ve el usuario en la app).
      ws.addRows(
        hoja.filas.map((fila) =>
          fila.map((v) =>
            v instanceof Date ? new Date(v.getTime() - v.getTimezoneOffset() * 60000) : v,
          ),
        ),
      );

      const cabecera = ws.getRow(1);
      cabecera.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cabecera.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${color || '0E7490'}` },
      };
      cabecera.alignment = { vertical: 'middle' };
      cabecera.height = 20;
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: hoja.columnas.length },
      };
    }

    const buffer = await libro.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
