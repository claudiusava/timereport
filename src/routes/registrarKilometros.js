const express = require('express');
const router = express.Router();

const pool = require('../database');

const { isLoggedIn } = require('../lib/auth');

router.get('/registrarKilometros', isLoggedIn, async (req, res) => {
  try {
    let vehiculos = [];
    vehiculos = await new Promise((resolve, reject) => {
      pool.query(`
    SELECT id, matricula, kilometros, DATE_FORMAT(fechaActualizacion, '%d/%m/%Y %H:%i') AS fechaActualizacionFormateada
    FROM vehiculos
    WHERE user_id = ?
    ORDER BY fechaActualizacionFormateada DESC
  `, 
  [req.user.id],
  (error, resultados) => {
        if (error) reject(error);
        resolve(resultados);
      });
    });

    let vehiculosSelect = [];
    vehiculosSelect = await new Promise((resolve, reject) => {
      pool.query(`
    SELECT v1.id, v1.matricula, v1.kilometros, DATE_FORMAT(v1.fechaActualizacion, '%d/%m/%Y %H:%i') AS fechaActualizacionFormateada
    FROM vehiculos v1
    LEFT JOIN vehiculos v2 ON v1.matricula = v2.matricula AND v1.kilometros < v2.kilometros
    WHERE v2.id IS NULL
  `, (error, resultados) => {
        if (error) reject(error);
        resolve(resultados);
      });
    });

    res.render("imputaciones/registrarKilometros", { vehiculos, vehiculosSelect });
  } catch (error) {
    req.flash("danger", "Error al obtener las vehiculos.");
    res.redirect("/imputaciones/registrarKilometros");
  }
});

router.post('/registrarKilometros', isLoggedIn, async (req, res) => {
  try {
    const { matricula, kilometros, fechaActualizacion } = req.body;

    // Verificar si ya existe un vehículo con la matrícula ingresada
    const vehiculoExistente = await new Promise((resolve, reject) => {
      pool.query('SELECT * FROM vehiculos WHERE matricula = ? ORDER BY fechaActualizacion DESC LIMIT 1', [matricula], (error, resultados) => {
        if (error) reject(error);
        resolve(resultados[0]);
      });
    });

    if (vehiculoExistente && kilometros <= vehiculoExistente.kilometros) {
      req.flash('error', 'El kilometraje ingresado debe ser mayor al último registrado');
      res.redirect('/imputaciones/registrarKilometros');
      return;
    }

    // Crear un nuevo registro de vehículo
    const newVehiculo = {
      matricula,
      kilometros,
      fechaActualizacion,
      user_id: req.user.id,
    };

    await pool.query('INSERT INTO vehiculos SET ?', [newVehiculo]);
    req.flash('success', 'Vehículo registrado correctamente');

    res.redirect('/imputaciones/registrarKilometros');
  } catch (error) {
    console.error('Error al registrar los kilómetros:', error);
    req.flash('error', 'Error al guardar los datos del vehículo');
    res.redirect('/imputaciones/registrarKilometros');
  }
});


router.get('/registrarKilometros/delete/:id', (req, res) => {
  const id = req.params.id;
  pool.query('DELETE FROM vehiculos WHERE id = ?', [id], (error) => {
    if (error) {
      console.error('Error al eliminar la furgoneta:', error);
      req.flash('error', 'Ocurrió un error al eliminar la furgoneta.');
    } else {
      req.flash('success', 'Furgoneta eliminada correctamente!');
    }
    res.redirect('/imputaciones/registrarKilometros');
  });
});


module.exports = router;
