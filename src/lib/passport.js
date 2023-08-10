const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const pool = require('../database');
const helpers = require('../lib/helpers');

// SELECT
passport.use('local.signin', new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true
}, (req, username, password, done) => {
  pool.query('SELECT * FROM users WHERE username = ?', username, function (error, rows) {
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
  let { permisoDeAdministracion, maquinista, socorrista, fullname } = req.body;

  var vehiculosAsociados = req.body.vehiculosAsociados.split(',');
  var vehiculosAsociadosAll = req.body.vehiculosAsociadosAll.split(',');
  var comunidadesAsociadas = req.body.comunidadesAsociadas.split(',');
  var comunidadesAsociadasAll = req.body.comunidadesAsociadasAll.split(',');

  console.log('vehiculosAsociados: ');
  console.log(vehiculosAsociados);
  console.log('vehiculosAsociadosAll: ');
  console.log(vehiculosAsociadosAll);
  console.log('comunidadesAsociadas: ');
  console.log(comunidadesAsociadas);
  console.log('comunidadesAsociadasAll: ');
  console.log(comunidadesAsociadasAll);

  if (permisoDeAdministracion == "on") {
    permisoDeAdministracion = 1;
  } else {
    permisoDeAdministracion = 0;
  }

  if (maquinista == "on") {
    maquinista = 1;
  } else {
    maquinista = 0;
  }

  if (socorrista == "on") {
    socorrista = 1;
  } else {
    socorrista = 0;
  }

  let newUser = {
    fullname,
    username,
    password,
    permisoDeAdministracion,
    maquinista,
    socorrista
  };

  newUser.password = helpers.encryptPassword(password);

  pool.query('SELECT * FROM users WHERE username=?', username, function (error, rows) {
    if (error) throw "Error en la consulta al buscar usuario: " + error;
    if (rows.length > 0) {
      done(null, false, req.flash('danger', 'Ese nombre de usuario ya existe.'));
    } else {
      pool.query('INSERT INTO users SET ?', [newUser], function (error, results) {
        if (error) {
          throw "Error en la consulta de insertar usuario: " + error;
        }
        newUser.id = results.insertId;

        if (permisoDeAdministracion == 1) {
          queryInsertAsignVehic(vehiculosAsociadosAll, newUser.id);
          queryInsertAsignComun(comunidadesAsociadasAll, newUser.id);
        } else {
          if (vehiculosAsociados[0] !== '' && comunidadesAsociadas[0] !== '') {
            queryInsertAsignVehic(vehiculosAsociados, newUser.id);
            queryInsertAsignComun(comunidadesAsociadas, newUser.id);
            console.log('Entra por el IF');
          } else if (vehiculosAsociados[0] != '' && comunidadesAsociadas[0] === '') {
            queryInsertAsignVehic(vehiculosAsociados, newUser.id);
            console.log('Entra por el primer Else If');
          } else if (comunidadesAsociadas[0] != '' && vehiculosAsociados[0] === '') {
            queryInsertAsignComun(comunidadesAsociadas, newUser.id);
            console.log('Entra por el segundo ELSE IF');
          }
        }
        return done(null, false, req.flash('success', 'Usuario creado correctamente!'));
      });
    }
  });
}));

function queryInsertAsignVehic(vehiculosAsociados, newUserId) {
  // Insertar registros en la tabla "asignacionvehiculos"
  var insertQueryVehiculos = 'INSERT INTO asignacionvehiculos (user_id, matricula) VALUES ?';
  var insertValuesVehiculos = vehiculosAsociados.map(function (matriculaVehiculo) {
    return [newUserId, matriculaVehiculo];
  });

  pool.query(insertQueryVehiculos, [insertValuesVehiculos], function (error, results) {
    if (error) {
      throw "Error en la consulta de insertar las asignaciones de vehiculos: " + error;
    }
  });
}

function queryInsertAsignComun(comunidadesAsociadas, newUserId) {
  var insertQueryComunidades = 'INSERT INTO asignacioncomunidades (user_id, comunidad_id) VALUES ?';
  var insertValuesComunidades = comunidadesAsociadas.map(function (comunidadId) {
    return [newUserId, parseInt(comunidadId)];
  });

  pool.query(insertQueryComunidades, [insertValuesComunidades], function (error, results) {
    if (error) {
      throw "Error en la consulta de insertar las asignaciones de vehiculos: " + error;
    }
  });
};


passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  pool.query('SELECT * FROM users WHERE id = ?', id, function (error, rows) {
    if (error) throw "Error en la deserialización: " + error;

    return done(null, rows[0]);
  });
});






