const { query } = require('express');
const express = require('express');
const router = express.Router();

const pool = require('../database');

const {isLoggedIn} = require('../lib/auth');

const excel = require('excel4node');

router.get('/registrosDeUsuarios', isLoggedIn, async (req, res) => {

    const imputaciones = pool.query('SELECT u.fullname, i.user_id, DATE_FORMAT(fecha,"%d/%m/%Y") as fechaFormateada, i.comunidad, i.horas, LPAD(i.minutos,2,"0") as minutos, LPAD(i.minutosFormateados,2,"0") as minutosFormateados FROM imputaciones AS i JOIN users AS u ON u.id = i.user_id ORDER BY u.fullname, i.fecha, i.comunidad', function(error, results, fields){
        if (error) throw error;

        res.render('imputaciones/registrosDeUsuarios', {results}); 
    });
    
});

module.exports = router;