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
        `SELECT i.id, i.fecha, i.comunidad, i.horas, i.minutos, i.minutos_formateados,
        DATE_FORMAT(DATE_ADD(i.created_at, INTERVAL 2 HOUR), '%d/%m/%Y %H:%i') AS formatted_created_at,
        u.fullname
        FROM imputaciones AS i
        INNER JOIN users AS u ON i.user_id = u.id
        ORDER BY
          i.created_at DESC
        `,
        (error, imputaciones) => {
          if (error) reject(error);
          resolve(imputaciones);
        });
    });

    let registrosKilometraje = [];
    registrosKilometraje = await new Promise((resolve, reject) => {
      pool.query(
        `SELECT rk.id, rk.matricula, rk.kilometros, 
        DATE_FORMAT(DATE_ADD(rk.created_at, INTERVAL 2 HOUR), '%d/%m/%Y %H:%i') AS formatted_created_at,
        u.fullname
        FROM registroskilometraje AS rk
        INNER JOIN users AS u ON rk.user_id = u.id
        ORDER BY
          rk.created_at DESC`,
        (error, vehiculos) => {
          if (error) reject(error);
          resolve(vehiculos);
        });
    });

    let controlagua = [];
    controlagua = await new Promise((resolve, reject) => {
      pool.query(
        `SELECT ca.id, ca.nivelCloro, ca.nivelPh, ca.piscina, ca.numeroBanistas, ca.nivelRebosadero, ca.aguaDepurada,
        DATE_FORMAT(DATE_ADD(ca.created_at, INTERVAL 2 HOUR), '%d/%m/%Y %H:%i') AS formatted_created_at,
        u.fullname
        FROM controlagua AS ca
        INNER JOIN users AS u ON ca.user_id = u.id
        ORDER BY
          created_at DESC`,
        (error, controlagua) => {
          if (error) reject(error);
          resolve(controlagua);
        });
    });

    res.render("imputaciones/registrosDeUsuarios", { imputaciones, registrosKilometraje, controlagua });
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
  pool.query(`DELETE FROM registroskilometraje WHERE id = ?`, [id], (error) => {
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