const { query } = require('express');
const express = require('express');
const router = express.Router();

const pool = require('../database');

const {isLoggedIn} = require('../lib/auth');

// SELECT
router.get('/administrarComunidades', isLoggedIn, (req,res) =>{
    const comunidades = pool.query('SELECT id, nombre, codigo FROM comunidades', function(error, comunidades){
        if (error) throw error;

        res.render('imputaciones/administrarComunidades', {comunidades});
    })
});

// INSERT
router.post('/administrarComunidades', isLoggedIn, async (req, res)=>{
    const {nombre, codigo} = req.body;    

    const newComunidad = {
        nombre,
        codigo
    };

    console.log("LA NUEVA COMUNIDAD A INGRESAR ES: ");
    console.log(newComunidad);

    await pool.query('INSERT INTO comunidades set ?', [newComunidad]);
    req.flash('success', 'Comunidad guardada correctamente!');
    res.redirect('/imputaciones/administrarComunidades');
});

// DELETE
router.get('/administrarComunidades/delete/:id', (req, res)=>{
    const id = req.params.id;
    pool.query('DELETE FROM comunidades WHERE id = ?',[id], (error, results)=>{
        if (error) throw error;

        req.flash('success', 'Comunidad eliminada correctamente!');
        res.redirect('/imputaciones/administrarComunidades');
    })
})

module.exports = router;