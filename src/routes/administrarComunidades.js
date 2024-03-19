const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

// Función para realizar consultas a la base de datos y liberar la conexión
async function poolQuery(sql, params) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

// SELECT
router.get('/administrarComunidades', isLoggedIn, async (req, res) => {
  try {
    const comunidades = await poolQuery('SELECT id, nombre, codigo, coordenadas FROM comunidades');
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
    const usuariosAdmin = await poolQuery('SELECT id FROM users WHERE permisoDeAdministracion = 1');

    for (const admin of usuariosAdmin) {
      const newAsignacionComunidad = { user_id: admin.id, codigo };
      await poolQuery('INSERT INTO asignacioncomunidades SET ?', [newAsignacionComunidad]);
    }

    await poolQuery('INSERT INTO comunidades SET ?', [newComunidad]);
    req.flash('success', 'Comunidad guardada correctamente!');
    res.redirect('/imputaciones/administrarComunidades');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Error al guardar una nueva comunidad');
    res.redirect('/imputaciones/administrarComunidades');
  }
});

// Actualización
router.get('/administrarComunidades/editar', isLoggedIn, async (req, res) => {
  const { id, nombre, codigo, coordenadas } = req.query;

  try {
    await poolQuery('UPDATE comunidades SET nombre = ?, codigo = ?, coordenadas = ? WHERE id = ?', [nombre, codigo, coordenadas, id]);
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
  
  try {
    await poolQuery('DELETE FROM comunidades WHERE id = ?', [id]);
    req.flash('success', 'Comunidad eliminada correctamente!');
    res.redirect('/imputaciones/administrarComunidades');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Error al eliminar la comunidad');
    res.redirect('/imputaciones/administrarComunidades');
  }
});

module.exports = router;
