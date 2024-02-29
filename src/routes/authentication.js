const express = require('express');
const router = express.Router();
const passport = require('passport');
const { isLoggedIn, isNotLoggedIn } = require('../lib/auth');
const pool = require('../database');

// Función para realizar consultas a la base de datos y liberar la conexión
async function poolQuery(sql, params) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });
  });
}

// SELECT
router.get('/signup', isLoggedIn, async (req, res) => {
  try {
    const usuarios = await poolQuery(`
      SELECT id, fullname, username, 
        CASE permisoDeAdministracion
          WHEN 1 THEN 'Si'
          WHEN 0 THEN 'No'
        END AS permisoDeAdministracion,
        CASE COALESCE(socorrista, 0)
          WHEN 1 THEN 'Si'
          ELSE 'No'
        END AS socorrista
      FROM users
    `);

    const comunidadesSelect = await poolQuery(`
      SELECT id, nombre, codigo FROM comunidades
    `);

    res.render('auth/signup', { usuarios, comunidadesSelect });
  } catch (error) {
    console.error(error);
    // Manejar el error de alguna manera adecuada para tu aplicación
    res.status(500).send('Error en la consulta');
  }
});

// DELETE
router.get('/auth/signup/delete/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;
  const id_logado = req.user.id.toString();

  if (id === id_logado) {
    req.flash('danger', '¡No te puedes eliminar a ti mismo!');
    res.redirect('/signup');
  } else {
    try {
      await poolQuery('DELETE FROM users WHERE id = ?', [id]);
      req.flash('success', 'Usuario eliminado correctamente!');
      res.redirect('/signup');
    } catch (error) {
      console.error(error);
      req.flash('danger', 'Error al eliminar el usuario');
      res.redirect('/signup');
    }
  }
});


router.post('/signup', passport.authenticate('local.signup', {
  successRedirect: '/signup',
  failureRedirect: '/signup',
  failureFlash: true
}));

router.get('/signin', isNotLoggedIn, (req, res) => {
  res.render('auth/signin');
});

router.post('/signin', isNotLoggedIn, (req, res, next) => {
  passport.authenticate('local.signin', {
    successRedirect: '/profile',
    failureRedirect: '/signin'
  })(req, res, next);
});

router.get('/profile', isLoggedIn, (req, res) => {
  res.render('profile');
});

router.get('/logout', (req, res) => {
  req.logOut();
  res.redirect('/signin');
});

module.exports = router;