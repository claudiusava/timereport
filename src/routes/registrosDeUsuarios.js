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
                DATE_FORMAT(createad_at, "%d/%m/%Y %H:%i:%s") AS fechaCreacionFormateada
            FROM
                imputaciones
            ORDER BY
                fechaCreacionFormateada DESC
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
                user_id
            FROM
                vehiculos
            ORDER BY
                fechaActualizacionFormateada DESC
            `,
                (error, vehiculos) => {
                    if (error) reject(error);
                    resolve(vehiculos);
                });
        });

        let controlagua = [];
        controlagua = await new Promise((resolve, reject) => {
            pool.query(
                `SELECT * FROM controlagua ORDER BY fecha DESC`,
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

// DELETE
router.get('/delete/:id', isLoggedIn, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM imputaciones WHERE id = ?', [id]);
        req.flash('success', 'Registro eliminado correctamente!');
        res.redirect("imputaciones/registrosDeUsuarios");
    } catch (error) {
        req.flash('danger', 'Error al eliminar el registro');
        res.redirect("imputaciones/registrosDeUsuarios");
    }
});

module.exports = router;