const express = require('express');
const router = express.Router();

const pool = require('../database');

const { isLoggedIn } = require('../lib/auth');

router.get('/calidadAgua', isLoggedIn, (req, res) => {
    // Consulta para recuperar los registros de la tabla 'comunidades'
    pool.query('SELECT nombre FROM comunidades', function(error, comunidadesResults) {
      if (error) throw error;
  
      // Consulta para recuperar los registros de la tabla 'controlagua' con todos los campos
      pool.query('SELECT * FROM controlagua', function(error, controlaguaResults) {
        if (error) throw error;
  
        res.render('imputaciones/calidadAgua', { 
          comunidades: comunidadesResults,
          controlagua: controlaguaResults
        });
      });
    });
  });
  

router.post("/calidadAgua/add", isLoggedIn, async (req, res) => {
    const { fecha, piscina, nivelPh, nivelCloro } = req.body;

    const newWaterControl = {
        fecha,
        piscina,
        nivelPh,
        nivelCloro
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

router.get('/calidadAgua/delete/:id', (req, res) => {
    const id = req.params.id;
    pool.query('DELETE FROM controlagua WHERE id = ?', [id], (error) => {
      if (error) {
        console.error('Error al eliminar el control de calidad del agua seleccionado:', error);
        req.flash('error', 'Ocurrió un error al eliminar el control de calidad del agua seleccionado.');
      } else {
        req.flash('success', 'Control de calidad de agua eliminado correctamente!');
      }
      res.redirect('/imputaciones/calidadAgua');
    });
});

module.exports = router;
