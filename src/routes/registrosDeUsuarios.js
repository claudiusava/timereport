const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/registrosDeUsuarios', isLoggedIn, (req, res) => {
  try {
    res.render("imputaciones/registrosDeUsuarios");
  } catch (error) {
    req.flash("danger", "Error al obtener...");
    res.redirect("imputaciones/registrosDeUsuarios");
  }
});

// DELETE horas
router.get('/registrosDeUsuarios/deleteHoras/:id', (req, res) => {
  const id = req.params.id;
  pool.query(`DELETE FROM imputaciones WHERE id = ?`, [id], (error) => {
    if (error) {
      req.flash('danger', 'Ocurrió un error al eliminar el registro.');
    }
    res.redirect('/imputaciones/registrosDeUsuarios');
  });
});

// DELETE controlAgua
router.get('/registrosDeUsuarios/deleteControlAgua/:id', (req, res) => {
  const id = req.params.id;
  pool.query(`DELETE FROM controlagua WHERE id = ?`, [id], (error) => {
    if (error) {
      req.flash('danger', 'Ocurrió un error al eliminar el registro.');
    } else {
      req.flash('success', '¡Registro eliminado correctamente!');
    }
    res.redirect('/imputaciones/registrosDeUsuarios');
  });
});

module.exports = router;