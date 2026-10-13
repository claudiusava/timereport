import { hashSync } from 'bcryptjs';
import { initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { getStorage as adminStorage } from 'firebase-admin/storage';
import { deleteApp, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { emailDeLogin } from '../../src/app/shared/email-usuario';
import { parsearDump } from '../../scripts/migracion/sql-dump';

// Volcado ficticio con el formato de mysqldump de la app antigua (datos
// inventados). Mezcla INSERT con columnas (--complete-insert) y extendidos.
const HASH = hashSync('clave-antigua', 10);
const JPEG = 'ffd8ffe000104a46494600010100000100010000ffd9';

const DUMP = `
/*!40103 SET TIME_ZONE='+00:00' */;
DROP TABLE IF EXISTS \`users\`;
CREATE TABLE \`users\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`fullname\` varchar(45) DEFAULT NULL,
  \`username\` varchar(45) DEFAULT NULL,
  \`password\` char(200) DEFAULT NULL,
  \`permisoDeAdministracion\` tinyint(1) DEFAULT NULL,
  \`maquinista\` tinyint(1) DEFAULT NULL,
  \`socorrista\` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb3;
INSERT INTO \`users\` VALUES (1,'Ana Jefa','ana','${HASH}',1,NULL,NULL),(2,'José O\\'Neill','José','${HASH}',0,NULL,1),(3,'Pedro Máquina','pedro','${HASH}',0,1,0),(4,'Otro José','jose','${HASH}',0,NULL,0),(5,'Sin Clave','sinclave','',0,NULL,0);
CREATE TABLE \`comunidades\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`nombre\` varchar(200) NOT NULL,
  \`codigo\` varchar(45) NOT NULL,
  \`coordenadas\` varchar(45) NOT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
INSERT INTO \`comunidades\` (\`id\`, \`nombre\`, \`codigo\`, \`coordenadas\`, \`created_at\`) VALUES (7,'Residencial Las Palmeras','100','40.4168, -3.7038','2023-05-01 10:00:00');
INSERT INTO \`comunidades\` (\`id\`, \`nombre\`, \`codigo\`, \`coordenadas\`, \`created_at\`) VALUES (8,'Comunidad Sin GPS','200','pendiente','2023-05-01 10:00:00');
CREATE TABLE \`asignacioncomunidades\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`user_id\` int NOT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`codigo\` varchar(20) NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
INSERT INTO \`asignacioncomunidades\` VALUES (1,2,'2023-05-01 10:00:00','100'),(2,3,'2023-05-01 10:00:00','100'),(3,3,'2023-05-01 10:00:00','200'),(4,1,'2023-05-01 10:00:00','100'),(5,99,'2023-05-01 10:00:00','100');
CREATE TABLE \`imputaciones\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`fecha\` varchar(12) DEFAULT NULL,
  \`comunidad\` varchar(200) NOT NULL,
  \`horas\` int NOT NULL,
  \`minutos\` int NOT NULL,
  \`minutos_formateados\` int NOT NULL,
  \`user_id\` int NOT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`isEntrada\` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
INSERT INTO \`imputaciones\` VALUES (1,'15/07/2024','Residencial Las Palmeras',8,5,8,3,'2024-07-15 06:05:00',1),(2,'15/07/2024','residencial las palmeras',14,0,0,3,'2024-07-15 12:00:00',0),(3,'16/07/2024','Comunidad Borrada',8,0,0,3,'2024-07-16 06:00:00',NULL),(4,'16/07/2024','Comunidad Borrada',13,0,0,3,'2024-07-16 11:00:00',NULL);
CREATE TABLE \`controlagua\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`nivelCloro\` varchar(45) NOT NULL,
  \`nivelPh\` varchar(45) NOT NULL,
  \`piscina\` varchar(100) NOT NULL,
  \`numeroBanistas\` int NOT NULL,
  \`nivelRebosadero\` int NOT NULL,
  \`aguaDepurada\` int NOT NULL,
  \`foto\` mediumblob,
  \`user_id\` int NOT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB;
INSERT INTO \`controlagua\` VALUES (1,'1.5','7.2','Residencial Las Palmeras',20,3,40,0x${JPEG},2,'2024-07-15 09:30:00'),(2,'2,0','7.4','Residencial Las Palmeras',5,2,10,NULL,2,'2024-07-16 09:30:00');
`;

const PROYECTO = 'demo-timereport';
let directorio: string;

describe('lector de volcados', () => {
  it('lee INSERT extendidos, con columnas, escapes, NULL y hex', () => {
    const d = parsearDump(DUMP);
    expect(d.fechasEnUtc).toBe(true);
    expect(d.tablas.get('users')!.filas).toHaveLength(5);
    expect(d.tablas.get('users')!.filas[1][1]).toBe("José O'Neill");
    expect(d.tablas.get('comunidades')!.filas).toHaveLength(2);
    const foto = d.tablas.get('controlagua')!.filas[0][7] as Buffer;
    expect(foto.toString('hex')).toBe(JPEG);
    expect(d.tablas.get('controlagua')!.filas[1][7]).toBeNull();
  });
});

describe('migración contra los emuladores', () => {
  beforeAll(() => {
    directorio = mkdtempSync(join(tmpdir(), 'migracion-'));
    const dump = join(directorio, 'dump.sql');
    writeFileSync(dump, DUMP);
    execFileSync(
      process.execPath,
      [resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/migrar-mysql.ts', '--dump', dump, '--cliente', 'prueba', '--emulador', '--aplicar'],
      { stdio: 'pipe' },
    );
    initAdmin({ projectId: PROYECTO, storageBucket: 'demo-timereport.appspot.com' });
  }, 120000);

  const app = initializeApp({ projectId: PROYECTO, apiKey: 'demo-api-key' }, 'migracion');
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

  afterAll(async () => {
    await deleteApp(app);
  });

  it('importa los usuarios con email sintético y claims', async () => {
    const user = await adminAuth().getUserByEmail(emailDeLogin('José', 'prueba'));
    expect(user.uid).toBe('prueba_2');
    expect(user.displayName).toBe("José O'Neill");
    expect(user.customClaims).toEqual({ clienteId: 'prueba', rol: 'socorrista' });
    // El emulador de Auth no verifica hashes bcrypt reales (usa un formato
    // de hash falso propio), asi que el login con la contraseña antigua se
    // comprueba en produccion con una cuenta de prueba (ver docs/MIGRACION.md).
    // Aqui solo se comprueba que el usuario sin hash no puede entrar.
    await expect(
      signInWithEmailAndPassword(auth, emailDeLogin('sinclave', 'prueba'), 'cualquiera'),
    ).rejects.toThrow();
  });

  it('asigna los roles', async () => {
    expect((await adminAuth().getUser('prueba_1')).customClaims).toEqual({ clienteId: 'prueba', rol: 'admin' });
    expect((await adminAuth().getUser('prueba_3')).customClaims).toEqual({ clienteId: 'prueba', rol: 'maquinista' });
  });

  it('resuelve choques de nombre de usuario al normalizar', async () => {
    // "José" y "jose" normalizan igual: el segundo pasa a "jose4".
    expect((await adminAuth().getUser('prueba_4')).email).toBe(emailDeLogin('jose4', 'prueba'));
    const perfil = (await adminDb().doc('clientes/prueba/usuarios/prueba_4').get()).data();
    expect(perfil?.['username']).toBe('jose4');
  });

  it('crea las comunidades con ubicación y asignaciones (sin admins)', async () => {
    const palmeras = (await adminDb().doc('clientes/prueba/comunidades/m7').get()).data()!;
    expect(palmeras['ubicacion'].latitude).toBeCloseTo(40.4168);
    expect([...palmeras['asignados']].sort()).toEqual(['prueba_2', 'prueba_3']);
    const sinGps = (await adminDb().doc('clientes/prueba/comunidades/m8').get()).data()!;
    expect(sinGps['ubicacion']).toBeNull();
    expect(sinGps['asignados']).toEqual(['prueba_3']);
  });

  it('migra los fichajes con la hora del servidor y enlaza comunidades', async () => {
    const i1 = (await adminDb().doc('clientes/prueba/imputaciones/m1').get()).data()!;
    expect(i1['fecha'].toDate().toISOString()).toBe('2024-07-15T06:05:00.000Z');
    expect(i1).toMatchObject({ uid: 'prueba_3', tipo: 'entrada', comunidadId: 'm7', usuarioNombre: 'Pedro Máquina' });
    const i2 = (await adminDb().doc('clientes/prueba/imputaciones/m2').get()).data()!;
    expect(i2).toMatchObject({ tipo: 'salida', comunidadId: 'm7', comunidadNombre: 'Residencial Las Palmeras' });
    // Sin tipo en origen: se alterna en el dia. Comunidad borrada: se conserva el nombre.
    const i3 = (await adminDb().doc('clientes/prueba/imputaciones/m3').get()).data()!;
    const i4 = (await adminDb().doc('clientes/prueba/imputaciones/m4').get()).data()!;
    expect([i3['tipo'], i4['tipo']]).toEqual(['entrada', 'salida']);
    expect(i3).toMatchObject({ comunidadId: '', comunidadNombre: 'Comunidad Borrada' });
  });

  it('migra los controles de agua y sube las fotos a Storage', async () => {
    const c1 = (await adminDb().doc('clientes/prueba/controlesAgua/m1').get()).data()!;
    expect(c1).toMatchObject({ cloro: 1.5, ph: 7.2, banistas: 20, comunidadId: 'm7' });
    expect(c1['fotoPath']).toBe('clientes/prueba/controlesAgua/prueba_2/m1.jpg');
    const [bytes] = await adminStorage().bucket().file(c1['fotoPath']).download();
    expect(bytes.toString('hex')).toBe(JPEG);
    const c2 = (await adminDb().doc('clientes/prueba/controlesAgua/m2').get()).data()!;
    expect(c2).toMatchObject({ cloro: 2, fotoPath: null });
  });
});
