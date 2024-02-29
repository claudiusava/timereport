const express = require('express');
const router = express.Router();
const { isNotLoggedIn } = require('../lib/auth');

router.get('/', isNotLoggedIn, async (req, res) => {
  try {
    res.render('index');
  } catch (error) {
    console.error(error);
    // Manejar el error de alguna manera adecuada para tu aplicación
    res.status(500).send('Error al renderizar la página');
  }
});

module.exports = router;
