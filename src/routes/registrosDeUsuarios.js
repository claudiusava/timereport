const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

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
router.get('/registrosDeUsuarios', isLoggedIn, async (req, res) => {
  try {
    let controlagua = [];
    let imputaciones = [];
    try {
      imputaciones = await poolQuery(
        `SELECT 
        u.fullname, 
        i.fecha, 
        i.comunidad, 
        i.horas, 
        LPAD(i.minutos, 2, "0") AS minutos, 
        CASE i.isEntrada
            WHEN 1 THEN 'ENTRADA'
            WHEN 0 THEN 'SALIDA'
        END AS isEntrada,
        i.id,
        DATE_FORMAT(i.created_at, '%d/%m/%Y %H:%i') AS formatted_created_at
    FROM 
        imputaciones i
    JOIN 
        users u ON i.user_id = u.id
    ORDER BY created_at DESC
    `,
        [req.user.id]
      );
    } catch (error) {
      console.log(error)
      req.flash("danger", "Error al obtener las imputaciones.");
    }

    try {
      controlagua = await poolQuery(
        `SELECT 
            u.fullname, 
            c.nivelCloro,
            c.nivelPh,
            c.piscina,
            c.numeroBanistas,
            c.nivelRebosadero,
            c.aguaDepurada,
            c.foto,
            DATE_FORMAT(c.created_at, '%d/%m/%Y %H:%i') AS formatted_created_at,
            c.id
        FROM 
            controlagua c
        JOIN 
            users u ON c.user_id = u.id
        ORDER BY created_at DESC`,
        [req.user.id]
      );
    } catch (error) {
      console.log(error)
      req.flash("danger", "Error al obtener las imputaciones.");
    }

    // Convertir la foto a cadena base64
    controlagua.forEach(result => {
      if (result.foto) {
        result.foto = Buffer.from(result.foto).toString('base64');
      }
    });

    res.render("imputaciones/registrosDeUsuarios",{ controlagua, imputaciones });
  } catch (error) {
    console.error(error);
    req.flash("danger", "Error al obtener...");
    res.redirect("imputaciones/registrosDeUsuarios");
  }
});

// DELETE horas
router.get('/registrosDeUsuarios/deleteHoras/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;

  try {
    await poolQuery(`DELETE FROM imputaciones WHERE id = ?`, [id]);
    req.flash('success', '¡Registro eliminado correctamente!');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Ocurrió un error al eliminar el registro.');
  }

  res.redirect('/imputaciones/registrosDeUsuarios');
});

// DELETE controlAgua
router.get('/registrosDeUsuarios/deleteControlAgua/:id', isLoggedIn, async (req, res) => {
  const id = req.params.id;

  try {
    await poolQuery(`DELETE FROM controlagua WHERE id = ?`, [id]);
    req.flash('success', '¡Registro eliminado correctamente!');
  } catch (error) {
    console.error(error);
    req.flash('danger', 'Ocurrió un error al eliminar el registro.');
  }

  res.redirect('/imputaciones/registrosDeUsuarios');
});

module.exports = router;
