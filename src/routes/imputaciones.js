const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../lib/auth');
const pool = require('../database');

// SELECT
router.get("/add", isLoggedIn, async (req, res) => {
    try {
      let comunidades = [];
      let imputaciones = [];
  
      try {
        comunidades = await new Promise((resolve, reject) => {
          pool.query(`SELECT nombre FROM comunidades`, (error, resultados) => {
            if (error) reject(error);
            resolve(resultados);
          });
        });
      } catch (error) {
        req.flash("danger", "Error al obtener las comunidades.");
      }
  
      try {
        imputaciones = await new Promise((resolve, reject) => {
          pool.query(
            `SELECT 
              DATE_FORMAT(fecha, "%d/%m/%Y") AS fechaFormateada, 
              comunidad, 
              horas, 
              LPAD(minutos, 2, "0") AS minutos, 
              id,
              createad_at
            FROM imputaciones
            WHERE user_id = ?
            ORDER BY createad_at DESC`,
            [req.user.id],
            (error, results) => {
              if (error) reject(error);
              resolve(results);
            }
          );
        });
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
      minutosFormateados: (minutos / 60) * 100,
      user_id: req.user.id,
    };
  
    try {
      await pool.query(`INSERT INTO imputaciones SET ?`, [newImputacion]);
      req.flash("success", "Registro guardado!");
      res.redirect("/imputaciones/add");
    } catch (error) {
      req.flash("danger", "Error al guardar el registro");
      res.redirect("/imputaciones/add");
    }
  });  

// DELETE
router.get('/delete/:id', isLoggedIn, async (req, res) => {
    const { id } = req.params;
    try {
      await pool.query(`DELETE FROM imputaciones WHERE id = ?`, [id]);
      req.flash('success', 'Registro eliminado correctamente!');
      res.redirect('/imputaciones/add');
    } catch (error) {
      req.flash('danger', 'Error al eliminar el registro');
      res.redirect('/imputaciones/add');
    }
  });
  
module.exports = router;
