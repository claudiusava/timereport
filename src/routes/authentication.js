const express = require('express');
const router = express.Router();
const passport = require('passport');
const { isLoggedIn, isNotLoggedIn } = require('../lib/auth');
const connection = require('../database');

// Función para realizar consultas a la base de datos y liberar la conexión
async function connectionQuery(sql, params) {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, results) => {
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
    const usuarios = await connectionQuery(`
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

    const comunidadesSelect = await connectionQuery(`
      SELECT id, nombre, codigo FROM comunidades
    `);

    res.render('auth/signup', { usuarios, comunidadesSelect });
  } catch (error) {
    console.error(error);
    // Manejar el error de alguna manera adecuada para tu aplicación
    res.status(500).send('Error en la consulta');
  }
});


// SELECT
router.get("/coumunidadesById/:id", isLoggedIn, async (req, res) => {
  try {
    let comunidades = [];
    // Utilizando async/await y try/catch para manejar las consultas de manera más limpia
    comunidades = await connectionQuery(`
    SELECT c.id, c.nombre, c.codigo
    FROM comunidades c
    WHERE 
        (SELECT permisoDeAdministracion FROM users WHERE id = ?) = 1 
        OR 
        c.codigo IN (SELECT codigo FROM asignacioncomunidades WHERE user_id = ?);`,[req.params.id, req.params.id]);
    res.send({ comunidades });
  } catch (error) {
    req.flash("danger", "Error al obtener las comunidades.");
    res.redirect("/imputaciones/add");
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
      await connectionQuery('DELETE FROM users WHERE id = ?', [id]);
      req.flash('success', 'Usuario eliminado correctamente!');
      res.redirect('/signup');
    } catch (error) {
      console.error(error);
      req.flash('danger', 'Error al eliminar el usuario');
      res.redirect('/signup');
    }
  }
});

// DELETE Asignación de comunidad
async function queryInsertAsignComun(comunidadesAsociadas, userId) {
  // First, delete all rows where user_id == userId
  var deleteQuery = 'DELETE FROM asignacioncomunidades WHERE user_id = ?';

  connection.query(deleteQuery, [userId], function (error, results) {
    if (error) {
      throw "Error en la consulta de eliminar las asignaciones de comunidades: " + error;
    }else if(comunidadesAsociadas.length === 0){ 
      return
    }
    else {
      // Proceed with insertion after deletion
      var insertQueryComunidades = 'INSERT INTO asignacioncomunidades (user_id, codigo) VALUES ?';
      var insertValuesComunidades = comunidadesAsociadas.map(function (comunidadId) {
        return [userId, comunidadId.toString()];
      });

      connection.query(insertQueryComunidades, [insertValuesComunidades], function (error, results) {
        if (error) {
          throw "Error en la consulta de insertar las asignaciones de comunidades: " + error;
        }
      });
    }
  });
}

function makeArray(codes){
  if (!codes) return []
  else if (!Array.isArray(codes)) return [codes]
  else return codes
}
// Editar usuario
router.get('/userEdit', isLoggedIn, async (req, res) => {
  const { id, fullname, username, socorrista, admin, codes } = req.query;
  let Socorrista = socorrista == 'true' ? '1' : '0';
  let Admin = admin == 'true' ? '1' : '0';
  let arrayCodes = makeArray(codes)

  try {
    await connectionQuery('UPDATE users SET username = ?, fullname = ?, socorrista = ?, permisoDeAdministracion = ? WHERE id = ?', [username, fullname, Socorrista, Admin, id]);
    if(socorrista) await queryInsertAsignComun(arrayCodes, id)
    req.flash('success', 'Usuario editado correctamente!');
    res.redirect('/signup');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Error al editar el usuario');
    res.redirect('/signup');
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