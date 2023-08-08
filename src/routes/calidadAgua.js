const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/calidadAgua', isLoggedIn, (req, res) => {
  // Consulta para recuperar los registros de la tabla 'comunidades'
  pool.query('SELECT c.nombre FROM asignacioncomunidades AS ac JOIN comunidades AS c ON ac.comunidad_id = c.id WHERE ac.user_id = ?', [req.user.id], function (error, comunidadesResults) {
    if (error) throw error;
    // Consulta para recuperar los registros de la tabla 'controlagua' con todos los campos
    pool.query(`SELECT *, 
        DATE_FORMAT(controlagua.created_at, '%d/%m/%Y %H:%i') AS formatted_created_at
        FROM controlagua
        WHERE user_id = ?
        ORDER BY created_at DESC;
`, [req.user.id], function (error, controlaguaResults) {
      if (error) throw error;

      res.render('imputaciones/calidadAgua', {
        comunidades: comunidadesResults,
        controlagua: controlaguaResults
      });
    });
  });
});

// INSERT
router.post("/calidadAgua/add", isLoggedIn, async (req, res) => {
  const { piscina, nivelCloro, nivelPh, numeroBanistas, nivelRebosadero, aguaDepurada } = req.body;

  const newWaterControl = {
    piscina,
    nivelCloro,
    nivelPh,
    numeroBanistas,
    nivelRebosadero,
    aguaDepurada,
    user_id: req.user.id,
  };

  try {
    await pool.query("INSERT INTO controlagua SET ?", [newWaterControl]);
    req.flash("success", "Registro guardado!");
    res.redirect("/imputaciones/calidadAgua");
  } catch (error) {
    req.flash("danger", "Error al guardar el registro");
    res.redirect("/imputaciones/calidadAgua");
  }
});

// DELETE
router.get('/calidadAgua/delete/:id', (req, res) => {
  const id = req.params.id;
  pool.query('DELETE FROM controlagua WHERE id = ?', [id], (error) => {
    if (error) {
      console.error('Error al eliminar el control de calidad del agua seleccionado:', error);
      req.flash('danger', 'Ocurrió un error al eliminar el control de calidad del agua seleccionado.');
    } else {
      req.flash('success', 'Control de calidad de agua eliminado correctamente!');
    }
    res.redirect('/imputaciones/calidadAgua');
  });
});

module.exports = router;
