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
                `SELECT
                DATE_FORMAT(fecha, "%d/%m/%Y") AS fechaFormateada,
                comunidad,
                horas,
                LPAD(minutos, 2, "0") AS minutos,
                minutosFormateados,
                id,
                user_id,
                DATE_FORMAT(createad_at, "%d/%m/%Y %H:%i") AS fechaCreacionFormateada,
                createad_at
            FROM
                imputaciones
            ORDER BY
                createad_at DESC
            `,
                (error, imputaciones) => {
                    if (error) reject(error);
                    resolve(imputaciones);
                });
        });

        let vehiculos = [];
        vehiculos = await new Promise((resolve, reject) => {
            pool.query(
                `SELECT
                id,
                matricula,
                kilometros,
                DATE_FORMAT(fechaActualizacion, '%d/%m/%Y %H:%i') AS fechaActualizacionFormateada,
                user_id,
                createad_at
            FROM
                vehiculos
            ORDER BY
                createad_at DESC
            `,
                (error, vehiculos) => {
                    if (error) reject(error);
                    resolve(vehiculos);
                });
        });

        let controlagua = [];
        controlagua = await new Promise((resolve, reject) => {
            pool.query(
                `SELECT DATE_FORMAT(fecha, '%d/%m/%Y %H:%i') AS fechaFormateada,
                piscina, 
                nivelPh,
                nivelCloro,
                numeroBanistas,
                id
                FROM controlagua 
                ORDER BY fechaFormateada DESC`,
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
    pool.query('DELETE FROM imputaciones WHERE id = ?', [id], (error) => {
      if (error) {
        console.error('Error al eliminar la furgoneta:', error);
        req.flash('error', 'Ocurrió un error al eliminar la furgoneta.');
      } else {
        req.flash('success', 'Furgoneta eliminada correctamente!');
      }
      res.redirect('/imputaciones/registrosDeUsuarios');
    });
  });
  
// DELETE kilometros
router.get('/registrosDeUsuarios/deleteKm/:id', (req, res) => {
    const id = req.params.id;
    pool.query('DELETE FROM vehiculos WHERE id = ?', [id], (error) => {
      if (error) {
        console.error('Error al eliminar la furgoneta:', error);
        req.flash('error', 'Ocurrió un error al eliminar la furgoneta.');
      } else {
        req.flash('success', 'Furgoneta eliminada correctamente!');
      }
      res.redirect('/imputaciones/registrosDeUsuarios');
    });
  });

// DELETE controlAgua
router.get('/registrosDeUsuarios/deleteControlAgua/:id', (req, res) => {
    const id = req.params.id;
    pool.query('DELETE FROM controlagua WHERE id = ?', [id], (error) => {
      if (error) {
        console.error('Error al eliminar la furgoneta:', error);
        req.flash('error', 'Ocurrió un error al eliminar la furgoneta.');
      } else {
        req.flash('success', 'Control de calidad de agua eliminado correctamente!');
      }
      res.redirect('/imputaciones/registrosDeUsuarios');
    });
  });

module.exports = router;