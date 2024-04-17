const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const connection = require('../database');
const helpers = require('../lib/helpers');

// SELECT
passport.use('local.signin', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true
}, (req, username, password, done) => {
  connection.query('SELECT * FROM users WHERE username = ?', username, function (error, rows) {
    if (error) throw "Error en la consulta al buscar usuario: " + error;
    if (rows.length > 0) {
      const user = rows[0];

      const validPassword = helpers.matchPassword(password, user.password);
      if (validPassword) {
        done(null, user);
      } else {
        done(null, false, req.flash('danger', 'Contraseña incorrecta.'));
      }
    } else {
      return done(null, false, req.flash('danger', 'El usuario introducido no existe.'));
    }
  });
}));

// INSERT
passport.use('local.signup', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true
}, (req, username, password, done) => {
  let { role, fullname } = req.body;

  var comunidadesAsociadas = req.body.comunidadesAsociadas.split(',');
  var comunidadesAsociadasAll = req.body.comunidadesAsociadasAll.split(',');

  let newUser = {
    fullname,
    username,
    password,
    permisoDeAdministracion: (role == "admin") ? 1 : 0,
    socorrista: (role == "socorrista") ? 1 : 0
  };

  newUser.password = helpers.encryptPassword(password);

  connection.query('SELECT * FROM users WHERE username=?', username, function (error, rows) {
    if (error) throw "Error en la consulta al buscar usuario: " + error;
    if (rows.length > 0) {
      done(null, false, req.flash('danger', 'Ese nombre de usuario ya existe.'));
    } else {
      connection.query('INSERT INTO users SET ?', [newUser], function (error, results) {
        if (error) {
          throw "Error en la consulta de insertar usuario: " + error;
        }
        newUser.id = results.insertId;

        if (role == "admin") {
          if (comunidadesAsociadasAll[0] != '') {
            queryInsertAsignComun(comunidadesAsociadasAll, newUser.id);
          }
        } else {
          if (comunidadesAsociadas[0] != '') {
            queryInsertAsignComun(comunidadesAsociadas, newUser.id);
          }
        }
        return done(null, false, req.flash('success', 'Usuario creado correctamente!'));
      });
    }
  });
}));

function queryInsertAsignComun(comunidadesAsociadas, newUserId) {
  var insertQueryComunidades = 'INSERT INTO asignacioncomunidades (user_id, codigo) VALUES ?';
  var insertValuesComunidades = comunidadesAsociadas.map(function (comunidadId) {
    return [newUserId, parseInt(comunidadId)];
  });

  connection.query(insertQueryComunidades, [insertValuesComunidades], function (error, results) {
    if (error) {
      throw "Error en la consulta de insertar las asignaciones de comunidades: " + error;
    }
  });
};

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  connection.query('SELECT * FROM users WHERE id = ?', id, function (error, rows) {
    if (error) throw "Error en la deserialización: " + error;

    return done(null, rows[0]);
  });
});






