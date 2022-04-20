const { query } = require('express');
const express = require('express');
const router = express.Router();

const pool = require('../database');

const {isLoggedIn} = require('../lib/auth');

const excel = require('excel4node');

router.get('/registrosDeUsuarios', isLoggedIn, (req, res) => {

    const imputaciones = pool.query('SELECT u.fullname, i.user_id, i.fecha, i.comunidad, i.horas, i.minutos FROM imputaciones AS i JOIN users AS u ON u.id = i.user_id ORDER BY u.fullname, i.fecha, i.comunidad', function(error, results, fields){
        if (error) throw error;
        res.render('imputaciones/registrosDeUsuarios', {results});
    });
});

module.exports = router;