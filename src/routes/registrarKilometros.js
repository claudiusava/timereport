const { query } = require('express');
const express = require('express');
const router = express.Router();

const pool = require('../database');

const {isLoggedIn} = require('../lib/auth');

router.get('/registrarKilometros', isLoggedIn, (req,res) =>{
        res.render('imputaciones/registrarKilometros');
});

module.exports = router;