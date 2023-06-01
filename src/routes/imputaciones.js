const { query } = require('express');
const express = require('express');
const router = express.Router();

const pool = require('../database');

const {isLoggedIn} = require('../lib/auth');


router.get('/add', isLoggedIn, async (req, res) => {
    try {
        const comunidadesPromise = new Promise((resolve, reject) => {
            pool.query('SELECT nombre FROM comunidades', (error, resultados) => {
                if (error) reject(error);
                resolve(resultados);
            });
        });

        const imputacionesPromise = new Promise((resolve, reject) => {
            pool.query('SELECT DATE_FORMAT(fecha,"%d/%m/%Y") as fechaFormateada, comunidad, horas, LPAD(minutos, 2, "0") as minutos, id FROM imputaciones WHERE user_id = ? ORDER BY fecha DESC', [req.user.id], (error, results) => {
                if (error) reject(error);
                resolve(results);
            });
        });

        const [comunidades, imputaciones] = await Promise.all([comunidadesPromise, imputacionesPromise]);

        res.render('imputaciones/add', { comunidades, imputaciones });
    } catch (error) {
        throw error;
    }
});


router.post('/add', isLoggedIn, async (req, res)=>{
    const {fecha, comunidad, horas, minutos} = req.body;
    let minutosFormateados = 0;

        minutosFormateados = (minutos/60)*100;

    const newImputacion = {
        fecha,
        comunidad,
        horas, 
        minutos,
        minutosFormateados,
        user_id: req.user.id 
    };

    await pool.query('INSERT INTO imputaciones set ?', [newImputacion]);
    req.flash('success', 'Registro guardado!');
    res.redirect('/imputaciones');
    
});

router.get('/delete/:id', isLoggedIn, async (req, res) => {   
    const {id} = req.params;

    pool.query('DELETE FROM imputaciones WHERE id = ?', [id]);
    req.flash('success', 'Registro eliminado correctamente!');
    res.redirect('/imputaciones');

});

module.exports = router;