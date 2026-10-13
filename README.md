# TimeReport

Registro de jornada y control de calidad del agua para empresas de
mantenimiento de piscinas y comunidades. Multi-cliente: cada empresa tiene sus
usuarios, comunidades y registros aislados, y su propio logo y colores.

- **Frontend**: Angular 18 (componentes standalone) + `@angular/fire`, publicado en GitHub Pages.
- **Backend**: Firebase (Authentication, Firestore, Storage y Cloud Functions), región `europe-southwest1`.
- La versión anterior (Express + MySQL en Heroku) está en el tag `v1-heroku`.

## Funcionalidades

| Pantalla | Quién | Qué hace |
|---|---|---|
| Fichaje | todos | Entrada/salida en una comunidad asignada, comprobando por GPS que estás a menos de 1 km. La hora la pone el servidor. Máximo 2 entradas y 2 salidas al día. |
| Control agua | socorrista, admin | Cloro, pH, bañistas, rebosadero, agua depurada y una foto (se comprime en el móvil y va a Storage). |
| Registros | admin | Fichajes y controles de todos, filtrados por fechas y trabajador; borrado; exportación a Excel (con hoja de horas por día). |
| Usuarios | admin | Alta, edición (rol y comunidades), cambio de contraseña, desactivación. |
| Comunidades | admin | Alta, edición, borrado y exportación a Excel. |

Cada empresa entra por su enlace: `https://claudiusava.github.io/timereport/#/c/<cliente>`.
El dispositivo lo recuerda; después basta con abrir `…/timereport/`.

## Modelo de datos

```
clientes/{clienteId}                      marca y configuración (lectura pública, sin listar)
clientes/{c}/usuarios/{uid}               nombre, username, email, rol, activo   (solo Functions)
clientes/{c}/comunidades/{id}             nombre, codigo, ubicacion, asignados[uid], activa
clientes/{c}/imputaciones/{id}            uid, usuarioNombre, comunidadId, comunidadNombre, tipo, fecha
clientes/{c}/controlesAgua/{id}           uid, usuarioNombre, comunidad…, cloro, ph, banistas,
                                          rebosadero, aguaDepurada, fotoPath, fecha
Storage: clientes/{c}/controlesAgua/{uid}/{id}.jpg     clientes/{c}/branding/logo.*
```

El rol y el cliente de cada usuario van en sus *custom claims* (`{ clienteId, rol }`),
que solo asignan las Cloud Functions (`functions/src/usuarios.ts`) o los scripts.
Las reglas (`firestore.rules`, `storage.rules`) usan esos claims: nadie ve datos
de otro cliente, los trabajadores solo ven lo suyo y los registros no se pueden
modificar (solo el admin los borra).

**Login sin email**: los trabajadores entran con nombre de usuario. Por debajo,
cada uno tiene el email sintético `usuario@cliente.timereport.invalid`
(`src/app/shared/email-usuario.ts`). Si se escribe un email real, se usa tal cual.

## Desarrollo local

Requisitos: Node 22 (`.node-version`) y Java 11+ (para los emuladores de Firestore y Storage).

```bash
npm install
npm --prefix functions install
```

```bash
npm --prefix functions run build
```

```bash
npm run emulators
```

En otra terminal, datos de prueba (usuarios `admin`, `socorrista` y `maquinista`
de la empresa `demo`; la contraseña está en `scripts/seed-emulador.ts`):

```bash
npm run seed
```

```bash
npm start
```

Abre `http://localhost:4200/#/c/demo`. En modo desarrollo la app usa siempre
los emuladores (`src/environments/environment.development.ts`).

## Tests

Se ejecutan contra los emuladores (los arrancan solos; para eso no puede
haber otros emuladores abiertos):

```bash
npm test
```

- `tests/rules`: reglas de Firestore y Storage (aislamiento entre clientes, permisos por rol, forma de los datos).
- `tests/functions`: Cloud Functions de gestión de usuarios.
- `tests/migracion`: script de migración desde MySQL.

## Despliegue

- **Web**: cada push a `main` publica en GitHub Pages (`.github/workflows/deploy.yml`).
  Se usan rutas con hash (`#/fichaje`) porque Pages solo sirve ficheros que existen:
  con rutas normales, recargar `/timereport/fichaje` daría 404.
- **Reglas, índices y Functions**:

```bash
npx firebase deploy --only firestore,storage,functions
```

La configuración pública de Firebase está en `src/environments/environment.ts`
(no es secreta: la seguridad está en las reglas). Nunca se sube a git ninguna
clave de cuenta de servicio ni datos personales (`docs/privado/` está ignorado).

## Scripts de administración

- `scripts/crear-cliente.ts`: alta de una empresa nueva y su primer admin, o cambio de su logo y colores.
- `scripts/migrar-mysql.ts`: importación del volcado MySQL de la versión anterior (ver `docs/MIGRACION.md`).
