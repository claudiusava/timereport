# Migración de Heroku a GitHub Pages + Firebase

Lista de pasos para poner en producción la versión nueva y traer los datos de
Simasport. Heroku no se toca hasta el paso 8.

## 1. Proyecto de Firebase (lo haces tú)

1. <https://console.firebase.google.com> → **Crear un proyecto** → nombre `timereport`.
   Apunta el **ID del proyecto** que te asigne (p. ej. `timereport-1a2b3`). Google Analytics no hace falta.
2. **Plan Blaze**: engranaje → *Uso y facturación* → *Detalles y configuración* → *Modificar plan* → Blaze.
   Es necesario para Cloud Functions y para el bucket de Storage. Con el uso previsto
   debería quedarse dentro de la capa gratuita; crea una **alerta de presupuesto**
   de 5 € en Google Cloud → *Facturación* → *Presupuestos y alertas*.
3. **Authentication** → *Comenzar* → *Correo electrónico/contraseña* → Habilitar (sin "vínculo de correo").
4. **Firestore Database** → *Crear base de datos* → ubicación **europe-southwest1 (Madrid)** → *modo producción*.
5. **Storage** → *Comenzar* → misma ubicación → *modo producción*.
6. *Configuración del proyecto* → *Tus apps* → icono **Web** (`</>`) → nombre `timereport-web`
   (sin Hosting). Copia el objeto `firebaseConfig` y pásamelo: va a `src/environments/environment.ts`
   (son valores públicos).
7. Recomendado: en Google Cloud → *APIs y servicios* → *Credenciales*, restringe la
   "Browser key" a los referentes `https://claudiusava.github.io/*` y `http://localhost:4200/*`.

## 2. Iniciar sesión en la CLI de Firebase (lo haces tú)

En una terminal, desde `C:\Develop\timereport`:

```bash
npx firebase login
```

## 3. Desplegar reglas, índices y Functions (lo hago yo)

Pongo el ID en `.firebaserc` y la configuración en `environment.ts`, y ejecuto:

```bash
npx firebase deploy --only firestore,storage,functions
```

## 4. Exportar la base de datos de Heroku (lo haces tú)

Solo lectura: no cambia nada en Heroku. Necesitas el cliente `mysqldump`
(viene con MySQL Workbench o "MySQL Shell"; también `winget install Oracle.MySQL`).
El host, el usuario y la base de datos son los de la app antigua; la contraseña
te la pedirá al ejecutar:

```bash
mysqldump --host=<host>.stackhero-network.com --port=3306 --user=root -p --ssl-mode=REQUIRED --single-transaction --set-gtid-purged=OFF --no-tablespaces --hex-blob --complete-insert --skip-extended-insert --tz-utc --result-file=docs/privado/export-heroku.sql dbtimereportsimasport users comunidades asignacioncomunidades imputaciones controlagua
```

- `--hex-blob` es imprescindible: sin él las fotos se estropean.
- `--tz-utc` (por defecto) deja las fechas en UTC, que es lo que espera el script.
- `docs/privado/` está en `.gitignore`: el volcado nunca se sube a git.

## 5. Simulacro de migración (lo hago yo)

```bash
npx tsx scripts/migrar-mysql.ts --dump docs/privado/export-heroku.sql
```

No escribe nada; genera `docs/privado/informe-migracion-simulacro-*.md` con los
recuentos y las incidencias: usuarios cuyo nombre cambia al normalizarlo,
comunidades con coordenadas inválidas, registros de comunidades borradas, etc.
Lo revisamos juntos antes de seguir.

## 6. Migración real (lo hacemos juntos)

1. Clave de cuenta de servicio (la generas tú): *Configuración del proyecto* →
   *Cuentas de servicio* → *Generar nueva clave privada* → guárdala como
   `docs/privado/service-account.json`.
2. Migración (repetible: si algo falla se puede volver a lanzar):

```bash
GOOGLE_APPLICATION_CREDENTIALS=docs/privado/service-account.json npx tsx scripts/migrar-mysql.ts --dump docs/privado/export-heroku.sql --proyecto <ID> --aplicar
```

3. Prueba de contraseña: entra con un usuario real y su contraseña de siempre.
   (El emulador no puede comprobar hashes bcrypt reales, así que esta es la prueba
   definitiva de que la importación con BCRYPT ha ido bien.)
4. **Borra la clave** `docs/privado/service-account.json` y revócala en
   Google Cloud → *IAM* → *Cuentas de servicio* → *Claves*.

Los usuarios entran con el mismo nombre de usuario y contraseña que antes
(si su nombre tenía mayúsculas, acentos o espacios, el informe indica cómo queda;
el login lo normaliza solo).

## 7. Publicar la web

1. GitHub → repo → *Settings* → *Pages* → *Source*: **GitHub Actions**.
   El repo es privado: Pages para repos privados requiere GitHub Pro.
   Si no lo tienes, la alternativa es hacer público el repo (ver más abajo).
2. Merge de la rama `migracion-firebase` en `main` → el workflow publica en
   `https://claudiusava.github.io/timereport/`.
3. Enlace para los trabajadores de Simasport: `https://claudiusava.github.io/timereport/#/c/simasport`.

## 8. Cierre de Heroku (solo cuando confirmes que todo funciona con datos reales)

Te pediré confirmación antes de cada paso:

```bash
git remote remove heroku
```

```bash
git remote remove git.heroku.com
```

```bash
heroku ps:scale web=0 -a timereportsimasport
```

Y, cuando ya no quieras conservarla, borrar la base de datos (complemento
Stackhero) y las apps:

```bash
heroku addons -a timereportsimasport
```

```bash
heroku addons:destroy <nombre-del-addon-mysql> -a timereportsimasport
```

```bash
heroku apps:destroy timereportsimasport
```

```bash
heroku apps:destroy timereport
```

**Cambia la contraseña de root de la base de datos antigua** en cuanto puedas:
estuvo escrita en `src/keys.js` y sigue en el historial de git.
