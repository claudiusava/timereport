import { inject, provideEnvironmentInitializer } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

import { ICONOS } from './iconos.generados';

/**
 * Registra los iconos SVG de Material Symbols. El contenido es estatico y
 * viene del paquete oficial (scripts/iconos.mjs), no de datos de usuarios.
 */
export function provideIconos() {
  return provideEnvironmentInitializer(() => {
    const registro = inject(MatIconRegistry);
    const sanitizer = inject(DomSanitizer);
    for (const [nombre, svg] of Object.entries(ICONOS)) {
      registro.addSvgIconLiteral(nombre, sanitizer.bypassSecurityTrustHtml(svg));
    }
  });
}
