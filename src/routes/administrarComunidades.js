const express = require('express');
const router = express.Router();
const connection = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/administrarComunidades', isLoggedIn, async (req, res) => {
  try {
    const comunidades = await connectionQuery('SELECT id, nombre, codigo, coordenadas FROM comunidades');
    res.render('imputaciones/administrarComunidades', { comunidades });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error en la consulta');
  }
});

// INSERT
router.post('/administrarComunidades', isLoggedIn, async (req, res) => {
  const { nombre, codigo, coordenadas } = req.body;
  const newComunidad = { nombre, codigo, coordenadas };

  try {
    const usuariosAdmin = await connectionQuery('SELECT id FROM users WHERE permisoDeAdministracion = 1');

    for (const admin of usuariosAdmin) {
      const newAsignacionComunidad = { user_id: admin.id, codigo };
      await connectionQuery('INSERT INTO asignacioncomunidades SET ?', [newAsignacionComunidad]);
    }

    await connectionQuery('INSERT INTO comunidades SET ?', [newComunidad]);
    req.flash('success', 'Comunidad guardada correctamente!');
    res.redirect('/imputaciones/administrarComunidades');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Error al guardar una nueva comunidad');
    res.redirect('/imputaciones/administrarComunidades');
  }
});

// UPDATE
router.get('/administrarComunidades/editar', isLoggedIn, async (req, res) => {
  const { id, nombre, codigo, coordenadas } = req.query;

  try {
    await connectionQuery('UPDATE comunidades SET nombre = ?, codigo = ?, coordenadas = ? WHERE id = ?', [nombre, codigo, coordenadas, id]);
    req.flash('success', 'Comunidad editada correctamente!');
    res.redirect('/imputaciones/administrarComunidades');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Error al editar la comunidad');
    res.redirect('/imputaciones/administrarComunidades');
  }
});

// DELETE
router.get('/administrarComunidades/delete/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;
  const codigo = req.query.codigo; // Accede al parámetro 'codigo' desde la consulta

  try {
    // Eliminar registros de la tabla asignacioncomunidad relacionados con la comunidad
    await connectionQuery('DELETE FROM asignacioncomunidades WHERE codigo = ?', [codigo]);

    // Luego eliminar la comunidad de la tabla comunidades
    await connectionQuery('DELETE FROM comunidades WHERE id = ?', [id]);

    req.flash('success', 'Comunidad eliminada correctamente!');
    res.redirect('/imputaciones/administrarComunidades');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Error al eliminar la comunidad');
    res.redirect('/imputaciones/administrarComunidades');
  }
});

// Función para realizar consultas a la base de datos y liberar la conexión
async function connectionQuery(sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

module.exports = router;
