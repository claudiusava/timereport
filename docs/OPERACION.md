# Operación

Proyecto de Firebase: `timereport-app` (plan Blaze, región `europe-southwest1`).

Los scripts de administración están en `functions/cli/` y se ejecutan desde la
raíz del repo con `npx tsx`. Con `--emulador` trabajan contra los emuladores
locales; con `--proyecto timereport-app`, contra producción. En producción
necesitan credenciales de administrador: la clave de una cuenta de servicio en
`GOOGLE_APPLICATION_CREDENTIALS`, guardada **fuera del repo** y borrada al
terminar (o `gcloud auth application-default login`).

## Publicar

**Web**: cada push a `main` ejecuta los tests y, si pasan, publica en GitHub
Pages (`.github/workflows/deploy.yml`).

**Reglas, índices y Cloud Functions** (a mano, cuando cambien):

```bash
npx firebase deploy --only firestore,storage,functions
```

Si el análisis de las Functions tarda más de 10 s (pasa en Windows), define
antes la variable `FUNCTIONS_DISCOVERY_TIMEOUT=60`.

## Dar de alta una empresa

```bash
npx tsx functions/cli/crear-cliente.ts --proyecto timereport-app --id piscinas-norte --nombre "Piscinas Norte" --admin-usuario mgarcia --admin-nombre "María García"
```

Muestra una sola vez la contraseña generada para el administrador. Él cambia
logo, colores y reglas de fichaje desde **Ajustes**, da de alta al resto de
usuarios y crea las comunidades. El script nunca modifica una empresa que ya
existe.

## Empresa demo

Se regenera sola cada 3 horas (Cloud Function `restablecerDemo`). Las
contraseñas de sus usuarios se restablecen una vez al día, a las 03:00, para no
cerrar las sesiones abiertas de los visitantes. Para regenerarla a mano:

```bash
npx tsx functions/cli/demo.ts --proyecto timereport-app
```

Usuarios `admin`, `socorrista` y `maquinista`, contraseña `demo1234` (es
pública a propósito). En la demo se puede fichar desde cualquier sitio y no se
pueden cambiar contraseñas ni desactivar usuarios.

## Borrar una empresa

```bash
npx tsx functions/cli/borrar-cliente.ts --proyecto timereport-app --id <empresa>
```

Pide escribir una confirmación. Borra sus datos, sus fotos y las cuentas de
sus usuarios, y no se puede deshacer. El registro de jornada debe conservarse
4 años: úsalo solo con empresas de prueba o que ya no tengan esa obligación.

## Configuración del proyecto (una vez)

```bash
npx tsx functions/cli/configurar-proyecto.ts --proyecto timereport-app
```

- CORS del bucket de Storage, para descargar las fotos desde la web.
- Firebase Auth: desactiva el registro libre y el borrado de cuenta por el propio usuario, y activa la protección contra enumeración.

Recomendaciones en la consola de Google Cloud:
- Restringir la API key del navegador a los referentes `https://claudiusava.github.io/*` y `http://localhost:4200/*`, y a las APIs de Identity Toolkit, Token Service, Firestore, Storage y Cloud Functions.
- Activar la recuperación a un momento anterior (PITR) y las copias programadas de Firestore.
- Mantener la alerta de presupuesto.

## Pendiente / ideas

- App Check (reCAPTCHA Enterprise) para limitar el uso de la API a la propia web.
- Dominio propio (mejor que el dominio compartido `github.io`).
- Purga automática de registros con más de 4 años (RGPD).
