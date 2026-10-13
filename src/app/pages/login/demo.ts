// Empresa de demostracion (se crea con functions/cli/demo.ts y se regenera
// cada 3 horas). Sus credenciales son publicas a proposito.
export const DEMO = {
  id: 'demo',
  password: 'demo1234',
  usuarios: [
    { usuario: 'admin', rol: 'Administradora', nombre: 'Laura Martín' },
    { usuario: 'socorrista', rol: 'Socorrista', nombre: 'Carlos Ruiz' },
    { usuario: 'maquinista', rol: 'Maquinista', nombre: 'Ana López' },
  ],
};
