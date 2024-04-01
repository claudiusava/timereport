const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../lib/auth');
const pool = require('../database');

// SELECT
router.get("/add", isLoggedIn, async (req, res) => {
  try {
    let comunidades = [];
    let imputaciones = [];

    // Utilizando async/await y try/catch para manejar las consultas de manera más limpia
    try {
      comunidades = await poolQuery(`
      SELECT c.id, c.nombre, c.coordenadas, c.codigo
      FROM comunidades c
      WHERE 
          (SELECT permisoDeAdministracion FROM users WHERE id = ?) = 1 
          OR 
          c.codigo IN (SELECT codigo FROM asignacioncomunidades WHERE user_id = ?);`,[req.user.id, req.user.id]);
    } catch (error) {
      req.flash("danger", "Error al obtener las comunidades.");
    }

    try {
      imputaciones = await poolQuery(
        `SELECT 
            DATE_FORMAT(fecha, "%d/%m/%Y") AS fechaFormateada, 
            comunidad, 
            horas, 
            LPAD(minutos, 2, "0") AS minutos, 
            id,
            created_at
          FROM imputaciones
          WHERE user_id = ?
          ORDER BY created_at DESC`,
        [req.user.id]
      );
    } catch (error) {
      req.flash("danger", "Error al obtener las imputaciones.");
    }

    res.render("imputaciones/add", { comunidades, imputaciones });
  } catch (error) {
    req.flash("danger", "Error general.");
    res.redirect("/imputaciones/add");
  }
});

// INSERT
router.post("/add", isLoggedIn, async (req, res) => {
  const { fecha, comunidad, horas, minutos } = req.body;

  const newImputacion = {
    fecha,
    comunidad,
    horas,
    minutos,
    minutos_formateados: (minutos / 60) * 100,
    user_id: req.user.id,
    isEntrada: 1
  };

  try {
    await poolQuery(`INSERT INTO imputaciones SET ?`, [newImputacion]);
    req.flash("success", "Registro guardado!");
    res.redirect("/imputaciones/add");
  } catch (error) {
    console.log(error)
    req.flash("danger", "Error al guardar el registro");
    res.redirect("/imputaciones/add");
  }
});

// DELETE
router.get('/delete/:id', isLoggedIn, async (req, res) => {
  const { id } = req.params;
  try {
    await poolQuery(`DELETE FROM imputaciones WHERE id = ?`, [id]);
    req.flash('success', 'Registro eliminado correctamente!');
    res.redirect('/imputaciones/add');
  } catch (error) {
    req.flash('danger', 'Error al eliminar el registro');
    res.redirect('/imputaciones/add');
  }
});

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

module.exports = router;
