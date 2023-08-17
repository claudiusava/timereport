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
            SELECT v.*,
            DATE_FORMAT(DATE_ADD(v.created_at, INTERVAL 2 HOUR), '%d/%m/%Y %H:%i') AS formatted_created_at,
            v.id AS id_vehiculo,
            u.fullname,
            r.kilometros
            FROM vehiculos AS v
            JOIN registroskilometraje AS r ON v.matricula = r.matricula
            JOIN users AS u ON v.user_id = u.id
            WHERE r.kilometros = (
                SELECT MAX(kilometros)
                FROM registroskilometraje
                WHERE matricula = v.matricula)
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
        const { marca, modelo, matricula, kilometros } = req.body;

        const newVehiculo = {
            marca,
            modelo,
            matricula,
            user_id: req.user.id,
        };

        const newKilometraje = {
            matricula,
            kilometros,
            user_id: req.user.id,
        };

        let usuariosAdmin = await new Promise((resolve, reject) => {
            pool.query(`
            SELECT id 
            FROM users
            WHERE permisoDeAdministracion = 1
            `,
                (error, results) => {
                    if (error) reject(error);
                    resolve(results);
                });
        });

        for (const admin of usuariosAdmin) {
            const newAsignacionVehiculo = {
                user_id: admin.id,
                matricula
            }
            await pool.query('INSERT INTO asignacionvehiculos SET ?', [newAsignacionVehiculo]);
        }

        // Insert newVehiculo into the 'vehiculos' table
        await pool.query('INSERT INTO vehiculos SET ?', [newVehiculo]);

        // Insert newKilometraje into the 'registroskilometraje' table
        await pool.query('INSERT INTO registroskilometraje SET ?', [newKilometraje]);

        req.flash('success', 'Vehículo y Kilometraje registrados correctamente');
        res.redirect('/imputaciones/vehiculos');

    } catch (error) {
        req.flash('danger', 'Error al guardar los datos del vehículo y kilometraje');
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
            req.flash('success', 'Vehículo eliminado correctamente!');
        }
        res.redirect('/imputaciones/vehiculos');
    });
});

module.exports = router;
