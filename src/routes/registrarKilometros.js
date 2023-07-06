const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/registrarKilometros', isLoggedIn, async (req, res) => {
  try {
    let vehiculos = [];
    vehiculos = await new Promise((resolve, reject) => {
      pool.query(`
        SELECT *
        FROM vehiculos
        `,
        [req.user.id],
        (error, resultados) => {
          if (error) reject(error);
          resolve(resultados);
        });
    });

    let registroskilometraje = [];
    registroskilometraje = await new Promise((resolve, reject) => {
      pool.query(`
        SELECT *,
        DATE_FORMAT(registroskilometraje.created_at, '%d/%m/%Y %H:%i') AS formatted_created_at
        FROM registroskilometraje
        WHERE user_id = ?
        ORDER BY formatted_created_at DESC
        `,
        [req.user.id],
        (error, resultados) => {
          if (error) reject(error);
          resolve(resultados);
        });
    });

    let registrosKilometrajeSelect = [];
    registrosKilometrajeSelect = await new Promise((resolve, reject) => {
      pool.query(`
          SELECT *,
          DATE_FORMAT(registroskilometraje.created_at, '%d/%m/%Y %H:%i') AS formatted_created_at
          FROM registroskilometraje
          WHERE user_id = ?
          ORDER BY registroskilometraje.kilometros DESC
          LIMIT 1;
        `,
        [req.user.id],
        (error, resultados) => {
          if (error) reject(error);
          resolve(resultados);
        });
    });
    res.render("imputaciones/registrarKilometros", { vehiculos, registroskilometraje, registrosKilometrajeSelect });
  } catch (error) {
    req.flash("danger", "Error al obtener los vehiculos.");
    res.redirect("/imputaciones/registrarKilometros");
  }
});

// INSERT
router.post('/registrarKilometros', isLoggedIn, async (req, res) => {
  try {
    const { matricula, kilometros } = req.body;

    // Verificar si ya existe un vehículo con la matrícula ingresada
    const vehiculoExistente = await new Promise((resolve, reject) => {
      pool.query('SELECT * FROM registroskilometraje WHERE matricula = ? ORDER BY created_at DESC LIMIT 1', [matricula], (error, resultados) => {
        if (error) reject(error);
        resolve(resultados[0]);
      });
    });

    if (vehiculoExistente && kilometros <= vehiculoExistente.kilometros) {
      req.flash('danger', 'El kilometraje ingresado debe ser mayor al último registrado');
      res.redirect('/imputaciones/registrarKilometros');
      return;
    }

    // Crear un nuevo registro de vehículo
    const newVehiculo = {
      matricula,
      kilometros,
      user_id: req.user.id,
    };

    await pool.query('INSERT INTO registroskilometraje SET ?', [newVehiculo]);
    req.flash('success', 'Vehículo registrado correctamente');
    res.redirect('/imputaciones/registrarKilometros');
  } catch (error) {
    req.flash('danger', 'Error al guardar los datos del vehículo');
    res.redirect('/imputaciones/registrarKilometros');
  }
});

// DELETE
router.get('/registrarKilometros/delete/:id', (req, res) => {
  const id = req.params.id;
  pool.query('DELETE FROM registroskilometraje WHERE id = ?', [id], (error) => {
    if (error) {
      req.flash('danger', 'Ocurrió un error al eliminar la furgoneta.');
    } else {
      req.flash('success', 'Furgoneta eliminada correctamente!');
    }
    res.redirect('/imputaciones/registrarKilometros');
  });
});

module.exports = router;
