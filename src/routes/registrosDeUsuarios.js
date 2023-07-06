const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/registrosDeUsuarios', isLoggedIn, async (req, res) => {
  try {
    let imputaciones = [];
    imputaciones = await new Promise((resolve, reject) => {
      pool.query(
        `SELECT *
        FROM
          imputaciones
        ORDER BY
          created_at DESC`,
        (error, imputaciones) => {
          if (error) reject(error);
          resolve(imputaciones);
        });
    });

    let vehiculos = [];
    vehiculos = await new Promise((resolve, reject) => {
      pool.query(
        `SELECT *
        FROM
          vehiculos
          ORDER BY
          created_at DESC`,
        (error, vehiculos) => {
          if (error) reject(error);
          resolve(vehiculos);
        });
    });

    let controlagua = [];
    controlagua = await new Promise((resolve, reject) => {
      pool.query(
        `SELECT *
        FROM controlagua
        ORDER BY
          created_at DESC`,
        (error, controlagua) => {
          if (error) reject(error);
          resolve(controlagua);
        });
    });

    res.render("imputaciones/registrosDeUsuarios", { imputaciones, vehiculos, controlagua });
  } catch (error) {
    req.flash("danger", "Error al obtener las vehiculos.");
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

// DELETE kilometros
router.get('/registrosDeUsuarios/deleteKm/:id', (req, res) => {
  const id = req.params.id;
  pool.query(`DELETE FROM vehiculos WHERE id = ?`, [id], (error) => {
    if (error) {
      req.flash('danger', 'Ocurrió un error al eliminar el registro.');
    } else {
      req.flash('success', '¡Registro eliminado correctamente!');
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