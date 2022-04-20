const { query } = require('express');
const express = require('express');
const router = express.Router();

const pool = require('../database');

const {isLoggedIn} = require('../lib/auth');

router.get('/add', isLoggedIn, (req,res) =>{
    res.render('imputaciones/add');
});

router.post('/add', isLoggedIn, async (req, res)=>{
    const {fecha, comunidad, horas, minutos} = req.body;
    const newImputacion = {
        fecha,
        comunidad,
        horas, 
        minutos,
        user_id: req.user.id 
    };

    await pool.query('INSERT INTO imputaciones set ?', [newImputacion]);
    req.flash('success', 'Registro guardado!');
    res.redirect('/imputaciones');
    
});

router.get('/', isLoggedIn, (req, res) => {

    const imputaciones = pool.query('SELECT DATE_FORMAT(fecha,"%d/%m/%Y") as fechaFormateada, comunidad, horas, minutos, id FROM imputaciones WHERE user_id = ? ORDER BY fecha', [req.user.id], function(error, results, fields){
        if (error) throw error;

        res.render('imputaciones/list', {results});
    });
});

router.get('/delete/:id', isLoggedIn, async (req, res) => {   
    const {id} = req.params;
    pool.query('DELETE FROM imputaciones WHERE id = ?', [id]);
    res.redirect('/imputaciones');
});

module.exports = router;