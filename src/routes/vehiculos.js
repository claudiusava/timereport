const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/vehiculos', isLoggedIn, async (req, res) => {
    try {
        let vehiculos = [];
        vehiculos = await new Promise((resolve, reject) => {
            pool.query(`
            SELECT *,
            DATE_FORMAT(vehiculos.created_at, '%d/%m/%Y %H:%i') AS formatted_created_at,
            users.fullname
            FROM vehiculos
            JOIN users ON vehiculos.user_id = users.id
      `,
                [req.user.id],
                (error, resultados) => {
                    if (error) reject(error);
                    resolve(resultados);
                });
        });
        res.render("imputaciones/vehiculos", { vehiculos });
    } catch (error) {
        req.flash("danger", "Error al obtener los vehiculos.");
        res.redirect("/imputaciones/vehiculos");
    }
});

// INSERT
router.post('/vehiculos', isLoggedIn, async (req, res) => {
    try {
        const { matricula } = req.body;

        // Verificar si ya existe un vehículo con la misma matrícula
        const vehiculoExistente = await new Promise((resolve, reject) => {
            pool.query('SELECT * FROM vehiculos WHERE matricula = ?', [matricula], (error, resultados) => {
                if (error) reject(error);
                resolve(resultados);
            });
        });

        if (vehiculoExistente.length > 0) {
            req.flash('danger', 'Ya existe un vehículo con esta matrícula');
            res.redirect('/imputaciones/vehiculos');
        } else {
            // Crear un nuevo registro de vehículo
            const newVehiculo = {
                matricula,
                user_id: req.user.id,
            };

            await pool.query('INSERT INTO vehiculos SET ?', [newVehiculo]);
            req.flash('success', 'Vehículo registrado correctamente');
            res.redirect('/imputaciones/vehiculos');
        }
    } catch (error) {
        req.flash('danger', 'Error al guardar los datos del vehículo');
        res.redirect('/imputaciones/vehiculos');
    }
});

// DELETE
router.get('/vehiculos/delete/:id', (req, res) => {
    const id = req.params.id;
    pool.query('DELETE FROM vehiculos WHERE id = ?', [id], (error) => {
        if (error) {
            console.error('Error al eliminar la furgoneta:', error);
            req.flash('danger', 'Ocurrió un error al eliminar la furgoneta.');
        } else {
            req.flash('success', 'Vehiculo eliminado correctamente!');
        }
        res.redirect('/imputaciones/vehiculos');
    });
});

module.exports = router;
