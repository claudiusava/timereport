const { hash } = require('bcryptjs');
const passport = require ('passport');
const LocalStrategy = require('passport-local').Strategy;

const pool = require('../database');
const helpers = require ('../lib/helpers');

passport.use('local.signin', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true
}, (req, username, password, done) => {
  pool.query('SELECT * FROM users WHERE username = ?', username, function(error, rows){
    if(error) throw "Error en la consulta al buscar usuario: "+error;
    if (rows.length > 0) {
      const user = rows[0];
      
      const validPassword = helpers.matchPassword(password, user.password);
      if (validPassword) {
        done(null, user);
      } else {
        done(null, false,  req.flash('danger', 'Contraseña incorrecta.'));
      }
    } else {
    return done(null, false, req.flash('danger', 'El usuario introducido no existe.'));
    }
  });
}));


passport.use('local.signup', new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
    }, (req, username, password, done) => {

    const  { fullname }  = req.body;
    let { permisoDeAdministracion } = req.body;

    if(permisoDeAdministracion == "on"){
      permisoDeAdministracion =1;
    }else{
      permisoDeAdministracion = 0;
    }

    let newUser = {
        fullname,
        username, 
        password,
        permisoDeAdministracion
    };

    newUser.password = helpers.encryptPassword(password);

    pool.query('SELECT * FROM users WHERE username=?', username, function (error, rows){
      if(error) throw "Error en la consulta al buscar usuario: "+error;
      if(rows.length > 0){
        done(null, false,  req.flash('danger', 'Ese nombre de usaurio ya existe.'));
      }else{
        pool.query('INSERT INTO users SET ? ', [newUser], function(error, results){
          if(error) {
            throw "Error en la consulta: "+error;
          }
          newUser.id = results.insertId;
          return done(null, false, req.flash('success', 'Usuario creado correctamente!'));
        });
      }
    });
}));


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  pool.query('SELECT * FROM users WHERE id = ?', id, function(error, rows){
    if(error) throw "Error en la deserialización: "+error;
   
    return done (null, rows[0]); 
  });
});


