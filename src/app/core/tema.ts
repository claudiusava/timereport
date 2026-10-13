import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

// Genera el esquema de color de Material 3 (claro y oscuro) a partir del
// color de la empresa y lo aplica sobre las variables --mat-sys-* que usan
// todos los componentes de Angular Material.

const ROLES = [
  'background', 'onBackground', 'surface', 'surfaceDim', 'surfaceBright',
  'surfaceContainerLowest', 'surfaceContainerLow', 'surfaceContainer', 'surfaceContainerHigh',
  'surfaceContainerHighest', 'onSurface', 'surfaceVariant', 'onSurfaceVariant', 'outline',
  'outlineVariant', 'inverseSurface', 'inverseOnSurface', 'shadow', 'scrim', 'surfaceTint',
  'primary', 'onPrimary', 'primaryContainer', 'onPrimaryContainer', 'inversePrimary',
  'primaryFixed', 'primaryFixedDim', 'onPrimaryFixed', 'onPrimaryFixedVariant',
  'secondary', 'onSecondary', 'secondaryContainer', 'onSecondaryContainer',
  'secondaryFixed', 'secondaryFixedDim', 'onSecondaryFixed', 'onSecondaryFixedVariant',
  'tertiary', 'onTertiary', 'tertiaryContainer', 'onTertiaryContainer',
  'tertiaryFixed', 'tertiaryFixedDim', 'onTertiaryFixed', 'onTertiaryFixedVariant',
  'error', 'onError', 'errorContainer', 'onErrorContainer',
] as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export const COLOR_POR_DEFECTO = '#00658f';

export function aplicarTema(colorHex: string) {
  const color = /^#[0-9a-fA-F]{6}$/.test(colorHex) ? colorHex : COLOR_POR_DEFECTO;
  const fuente = Hct.fromInt(argbFromHex(color));
  const claro = new SchemeTonalSpot(fuente, false, 0);
  const oscuro = new SchemeTonalSpot(fuente, true, 0);
  const colores = new MaterialDynamicColors();
  const estilo = document.documentElement.style;
  for (const rol of ROLES) {
    const dinamico = colores[rol]();
    estilo.setProperty(
      `--mat-sys-${kebab(rol)}`,
      `light-dark(${hexFromArgb(dinamico.getArgb(claro))}, ${hexFromArgb(dinamico.getArgb(oscuro))})`,
    );
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hexFromArgb(colores.primary().getArgb(claro)));
}

export type ModoTema = 'sistema' | 'claro' | 'oscuro';

export function aplicarModo(modo: ModoTema) {
  document.documentElement.style.colorScheme =
    modo === 'claro' ? 'light' : modo === 'oscuro' ? 'dark' : 'light dark';
}
