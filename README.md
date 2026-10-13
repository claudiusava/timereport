# TimeReport

Registro de jornada y control de calidad del agua para empresas de
mantenimiento de piscinas y comunidades. Es multiempresa: cada empresa cliente
tiene sus usuarios, comunidades y registros aislados, y su propio logo y colores.

- **Web**: Angular 22 + Angular Material 3, instalable en el móvil (PWA). Publicada en GitHub Pages.
- **Backend**: Firebase (Authentication, Firestore, Storage y Cloud Functions) en `europe-southwest1` (Madrid).
- **Demo pública**: empresa ficticia `demo`, que se regenera cada 3 horas.

## Funcionalidades

| Pantalla | Quién | Qué hace |
|---|---|---|
| Fichaje | todos | Entrada y salida en una comunidad asignada. Comprueba por GPS la distancia (y la precisión). La hora la pone el servidor. Admite turnos de noche y jornada partida. |
| Mi historial | todos | Fichajes y horas por día, mes a mes, con exportación a Excel. |
| Control de agua | socorrista, admin | Cloro, pH, bañistas, rebosadero y agua depurada, con foto. Avisa de los valores fuera del RD 742/2013. |
| Panel | admin | Quién está trabajando, quién ha fichado hoy, controles del día y avisos (salidas olvidadas, agua fuera de rango). |
| Registros | admin | Fichajes, horas y controles de cualquier periodo. Anulación con motivo, fichajes manuales y exportación a Excel. |
| Usuarios | admin | Altas, roles, comunidades asignadas, contraseñas y bajas. |
| Comunidades | admin | Piscinas, con su código, ubicación y estado. |
| Ajustes | admin | Logo, color y nombre de la app; radio de fichaje y entradas al día; auditoría. |

Cada empresa entra por su enlace: `https://claudiusava.github.io/timereport/#/c/<empresa>`.

## Registro de jornada (RD-ley 8/2019)

- Los fichajes solo los crea la Cloud Function `fichar`, que comprueba la comunidad, la distancia, la alternancia entrada/salida y el máximo diario, con la hora del servidor.
- **Nada se borra ni se modifica.** El administrador anula (con motivo) o registra un fichaje manual (con motivo), y queda marcado en el registro.
- Todas las acciones de los administradores quedan en una **auditoría** que nadie puede editar.
- Cada trabajador puede consultar y exportar su propio historial completo.

## Seguridad

- Las reglas de Firestore y Storage aíslan cada empresa (`clientes/{id}/...`).
- Los permisos de administrador se comprueban contra el perfil en Firestore (rol y activo), no solo contra el token. Así un admin desactivado pierde el acceso al instante.
- Las cuentas solo las crean los administradores (Cloud Functions). Solo existen nombres de usuario, sin emails, y siempre dentro de la propia empresa.
- Las fotos se descargan pasando por las reglas, sin enlaces públicos permanentes.
- La política de seguridad de contenidos (CSP) va en `index.html`, porque GitHub Pages no permite cabeceras propias.

Modelo de datos y reglas: [`firestore.rules`](firestore.rules), [`storage.rules`](storage.rules), [`functions/src`](functions/src).

## Desarrollo local

Requisitos: Node 22 y Java 21 (para los emuladores de Firestore y Storage).

```bash
npm install
```

```bash
npm --prefix functions install
```

```bash
npm --prefix functions run build
```

```bash
npm run emulators
```

En otra terminal, carga la empresa demo en los emuladores y arranca la app:

```bash
npm run seed
```

```bash
npm start
```

Abre `http://localhost:4200/#/c/demo` y entra con los botones de la demo. En desarrollo la app usa siempre los emuladores.

## Tests

```bash
npm test
```

Arranca los emuladores por su cuenta (no puede haber otros abiertos).
- `tests/unit`: cálculo de jornadas y reglas de fichaje.
- `tests/rules`: reglas de Firestore y Storage.
- `tests/functions`: Cloud Functions.

GitHub Actions los ejecuta en cada push y pull request; solo se publica si pasan.

## Despliegue y operación

Ver [docs/OPERACION.md](docs/OPERACION.md): publicar la web y el backend, dar de alta empresas, demo, configuración del proyecto.

## Iconos

```bash
node scripts/iconos.mjs
```

Solo se incluyen los iconos de Material Symbols que usa la app, generados en `src/app/core/iconos.generados.ts`. Para añadir uno, edita la lista del script y vuelve a ejecutarlo. `node scripts/iconos-pwa.mjs` regenera los iconos PNG de la app instalable.
