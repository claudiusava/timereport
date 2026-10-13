// Genera src/app/core/iconos.generados.ts con el SVG de los iconos de Material
// Symbols que usa la app (paquete @material-symbols/svg-400, Apache-2.0). Asi
// solo se incluyen unos pocos KB en lugar de la fuente completa (4 MB).
//
//   node scripts/iconos.mjs
//
// Para usar un icono nuevo: añadelo a ICONOS y vuelve a ejecutar el script.
import { readFileSync, writeFileSync } from 'node:fs';

const ICONOS = [
  'account_circle', 'add', 'apartment', 'arrow_forward', 'block', 'bolt', 'domain', 'calendar_month',
  'check_circle', 'chevron_left', 'chevron_right', 'close', 'cloud_upload', 'contrast', 'dark_mode',
  'dashboard', 'delete', 'download', 'edit', 'edit_note', 'error', 'gavel', 'group', 'history',
  'hourglass_top', 'how_to_reg', 'info', 'key', 'light_mode', 'location_on', 'login', 'logout',
  'manage_history', 'map', 'menu', 'more_vert', 'my_location', 'open_in_new', 'palette', 'person',
  'person_add', 'person_off', 'photo_camera', 'pool', 'refresh', 'schedule', 'search', 'settings',
  'table_view', 'task_alt', 'timer', 'upload', 'verified_user', 'visibility', 'visibility_off',
  'warning', 'water_drop', 'wifi_off',
];

const lineas = ICONOS.map((nombre) => {
  const svg = readFileSync(`node_modules/@material-symbols/svg-400/outlined/${nombre}.svg`, 'utf8')
    .trim()
    .replace(/ width="48" height="48"/, ' fill="currentColor"');
  return `  ${nombre}: '${svg.replace(/'/g, "\'")}',`;
});

writeFileSync(
  'src/app/core/iconos.generados.ts',
  `// Generado por scripts/iconos.mjs: no editar a mano.\n// Material Symbols (Apache-2.0).\nexport const ICONOS: Record<string, string> = {\n${lineas.join('\n')}\n};\n`,
);
console.log(`${ICONOS.length} iconos generados`);
