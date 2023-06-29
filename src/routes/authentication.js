const express = require('express');
const router = express.Router();
const passport = require('passport');
const{isLoggedIn} = require('../lib/auth');
const{isNotLoggedIn} = require('../lib/auth');
const pool = require('../database');

// SELECT
router.get('/signup', isLoggedIn, async (req, res) => {
    try {
      const usuarios = await new Promise((resolve, reject) => {
        pool.query(`SELECT id, fullname, username, 
          CASE permisoDeAdministracion
            WHEN 1 THEN 'Si'
            WHEN 0 THEN 'No'
          END AS permisoDeAdministracion, 
          CASE COALESCE(maquinista, 0)
            WHEN 1 THEN 'Si'
            ELSE 'No'
          END AS maquinista, 
          CASE COALESCE(socorrista, 0)
            WHEN 1 THEN 'Si'
            ELSE 'No'
          END AS socorrista
          FROM users`, (error, results) => {
          if (error) reject(error);
          resolve(results);
        });
      });
  
      const vehiculosSelect = await new Promise((resolve, reject) => {
        pool.query(`
          SELECT v1.id, v1.matricula, v1.kilometros, DATE_FORMAT(v1.fechaActualizacion, '%d/%m/%Y %H:%i') AS fechaActualizacionFormateada
          FROM vehiculos v1
          LEFT JOIN vehiculos v2 ON v1.matricula = v2.matricula AND v1.kilometros < v2.kilometros
          WHERE v2.id IS NULL
        `, (error, resultados) => {
          if (error) reject(error);
          resolve(resultados);
        });
      });
  
      res.render('auth/signup', { usuarios, vehiculosSelect });
    } catch (error) {
      console.error(error);
      // Manejar el error de alguna manera adecuada para tu aplicación
      res.status(500).send('Error en la consulta');
    }
  });
  

// DELETE
router.get('/auth/signup/delete/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;
  const id_logado = req.user.id.toString(); // Convertir a string
  if (id === id_logado) { // Comparación de strings
    req.flash('danger', '¡No te puedes eliminar a ti mismo!');
    res.redirect('/signup');
  } else {
    await pool.query('DELETE FROM users WHERE id = ?', [id], (error) => {
      if (error) throw error;
      req.flash('success', 'Usuario eliminado correctamente!');
      res.redirect('/signup');
    });
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

router.post('/signin', isNotLoggedIn, (req,res, next)=>{
    passport.authenticate('local.signin', {
        successRedirect: '/profile', 
        failureRedirect: '/signin'
    })(req,res, next);
});

router.get('/profile', isLoggedIn, (req,res) => {
    res.render('profile');
});

router.get('/logout', (req,res) => {
    req.logOut();
    res.redirect('/signin');
});

module.exports = router;