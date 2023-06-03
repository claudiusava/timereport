const { query } = require('express');
const express = require('express');
const router = express.Router();

const pool = require('../database');

const {isLoggedIn} = require('../lib/auth');

router.get('/administrarComunidades', isLoggedIn, (req,res) =>{
    const comunidades = pool.query('SELECT id, nombre, codigo FROM comunidades', function(error, results){
        if (error) throw error;

        res.render('imputaciones/administrarComunidades', {results});
    })
});

router.post('/administrarComunidades', isLoggedIn, async (req, res)=>{
    const {nombre, codigo} = req.body;    

    const newComunidad = {
        nombre,
        codigo
    };

    await pool.query('INSERT INTO comunidades set ?', [newComunidad]);
    req.flash('success', 'Comunidad guardada correctamente!');
    res.redirect('/imputaciones/administrarComunidades');
});

router.get('/administrarComunidades/delete/:id', (req, res)=>{
    const id = req.params.id;
    pool.query('DELETE FROM comunidades WHERE id = ?',[id], (error, results)=>{
        if (error) throw error;

        req.flash('success', 'Comunidad eliminada correctamente!');
        res.redirect('/imputaciones/administrarComunidades');
    })
})

module.exports = router;