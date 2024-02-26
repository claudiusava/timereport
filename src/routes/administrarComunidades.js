const { query } = require('express');
const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/administrarComunidades', isLoggedIn, (req, res) => {
    const comunidades = pool.query('SELECT id, nombre, codigo, coordenadas FROM comunidades', function (error, comunidades) {
        if (error) throw error;

        res.render('imputaciones/administrarComunidades', { comunidades });
    })
});

// INSERT
router.post('/administrarComunidades', isLoggedIn, async (req, res) => {
    const { nombre, codigo, coordenadas } = req.body;

    const newComunidad = {
        nombre,
        codigo,
        coordenadas
    };

    try {
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
            const newAsignacionComunidad = {
                user_id: admin.id,
                codigo
            }
            await pool.query('INSERT INTO asignacioncomunidades SET ?', [newAsignacionComunidad]);
        }

        await pool.query('INSERT INTO comunidades set ?', [newComunidad]);

        req.flash('success', 'Comunidad guardada correctamente!');
        res.redirect('/imputaciones/administrarComunidades');
    } catch (error) {
        req.flash('danger', 'Error al guardar una nueva comunidad');
        res.redirect('/imputaciones/administrarComunidades');
    }
});

// DELETE
router.get('/administrarComunidades/delete/:id', (req, res) => {
    const id = req.params.id;
    pool.query('DELETE FROM comunidades WHERE id = ?', [id], (error, results) => {
        if (error) throw error;

        req.flash('success', 'Comunidad eliminada correctamente!');
        res.redirect('/imputaciones/administrarComunidades');
    })
})

module.exports = router;