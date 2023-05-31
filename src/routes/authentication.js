const express = require('express');
const router = express.Router();
const passport = require('passport');
const{isLoggedIn} = require('../lib/auth');
const{isNotLoggedIn} = require('../lib/auth');
const pool = require('../database');

router.get('/signup', isLoggedIn, (req, res) => {
    const comunidades = pool.query(`SELECT id, fullname, username, 
    CASE permisoDeAdministracion
      WHEN 1 THEN 'Si'
      WHEN 0 THEN 'No'
    END AS permisoDeAdministracion,
    CASE maquinista
      WHEN 1 THEN 'Si'
      WHEN 0 THEN 'No'
    END AS maquinista
  from users;`, function(error, results){
        if (error) throw error;

        res.render('auth/signup', {results});
    });
});

router.get('/auth/signup/delete/:id', (req, res)=>{
    const id = req.params.id;
    pool.query('DELETE FROM users WHERE id = ?',[id], (error, results)=>{
        if (error) throw error;

        req.flash('success', 'Comunidad eliminada correctamente!');
        res.redirect('/signup');
    })
})

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