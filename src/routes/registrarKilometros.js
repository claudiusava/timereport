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

    let registrosKilometrajeList = [];
    registrosKilometrajeList = await new Promise((resolve, reject) => {
      pool.query(`
          SELECT id, matricula, MAX(kilometros) AS max_kilometros
          FROM heroku_b427b1ba4c318bd.registroskilometraje
          GROUP BY matricula
        `,
        [req.user.id],
        (error, resultados) => {
          if (error) reject(error);
          resolve(resultados);
        });
    });

    console.log("CONSULTA DE REGISTROS MATRICULAS DIFERENTES CON EL KILOMETRAJE MÁS ALTO");
    console.log(registrosKilometrajeList);

    let asignacionVehiculosList = [];
    asignacionVehiculosList = await new Promise((resolve, reject) => {
      pool.query(`
          SELECT matricula
          FROM asignacionvehiculos
          WHERE user_id = ?
        `,
        [req.user.id],
        (error, resultados) => {
          if (error) reject(error);
          resolve(resultados);
        });
    });

    console.log("CONSULTA DE REGISTROS DE ASIGNACIÓN DE VEHICULOS POR USUARIO ACTUAL");
    console.log(asignacionVehiculosList);

    // Crear una función para verificar si una matrícula existe en asignacionVehiculosList
    function matriculaExiste(matricula, asignacionVehiculosList) {
      return asignacionVehiculosList.some(item => item.matricula === matricula);
    }

    // Filtrar registrosKilometrajeList y mantener solo aquellos con matrículas coincidentes en asignacionVehiculosList
    const registrosKilometrajeSelect = registrosKilometrajeList.filter(item =>
      matriculaExiste(item.matricula, asignacionVehiculosList)
    );

    console.log("REGISTROS KILOMETRAJE DEFINITIVOS PARA EL SELECT");
    console.log(registrosKilometrajeSelect);

    res.render("imputaciones/registrarKilometros", { vehiculos, registroskilometraje, registrosKilometrajeSelect });
  } catch (error) {
    req.flash("danger", "Error al obtener los vehiculos.");
    res.redirect("/imputaciones/registrarKilometros");
  }
});

// INSERT
router.post('/registrarKilometros', isLoggedIn, async (req, res) => {

  const { matricula, kilometros } = req.body;

  try {
    // Crear un nuevo registro de vehículo
    const newVehiculo = {
      matricula,
      kilometros,
      user_id: req.user.id,
    };

    console.log('EL NUEVO KILOMETRAJE ES: ');
    console.log(newVehiculo);

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
