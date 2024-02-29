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
router.get('/registrosDeUsuarios', isLoggedIn, async (req, res) => {
  try {
    res.render("imputaciones/registrosDeUsuarios");
  } catch (error) {
    console.error(error);
    req.flash("danger", "Error al obtener...");
    res.redirect("imputaciones/registrosDeUsuarios");
  }
});

// DELETE horas
router.get('/registrosDeUsuarios/deleteHoras/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;

  try {
    await poolQuery(`DELETE FROM imputaciones WHERE id = ?`, [id]);
    req.flash('success', '¡Registro eliminado correctamente!');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Ocurrió un error al eliminar el registro.');
  }

  res.redirect('/imputaciones/registrosDeUsuarios');
});

// DELETE controlAgua
router.get('/registrosDeUsuarios/deleteControlAgua/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;

  try {
    await poolQuery(`DELETE FROM controlagua WHERE id = ?`, [id]);
    req.flash('success', '¡Registro eliminado correctamente!');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Ocurrió un error al eliminar el registro.');
  }

  res.redirect('/imputaciones/registrosDeUsuarios');
});

module.exports = router;
