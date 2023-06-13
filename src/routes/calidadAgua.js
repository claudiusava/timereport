const express = require('express');
const router = express.Router();

const pool = require('../database');

const { isLoggedIn } = require('../lib/auth');

router.get('/calidadAgua', isLoggedIn, async (req, res) => {
    res.render("imputaciones/calidadAgua");
});


module.exports = router;
