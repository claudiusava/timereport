const express = require('express');
const router = express.Router();
const connection = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/calidadAgua', isLoggedIn, async (req, res, next) => {
  try {
    // Consultar las comunidades
    const comunidadesResults = await connection.query(`
      SELECT c.nombre, c.codigo
      FROM comunidades c
      WHERE 
        (SELECT permisoDeAdministracion FROM users WHERE id = ?) = 1 
        OR 
        c.codigo IN (SELECT codigo FROM asignacioncomunidades WHERE user_id = ?)
    `, [req.user.id, req.user.id]);

    // Consultar los registros de control de agua
    const controlaguaResults = await connection.query(`
      SELECT *
      FROM controlagua
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [req.user.id]);

    // Convertir la foto a cadena base64
    controlaguaResults.forEach(result => {
      if (result.foto) {
        result.foto = Buffer.from(result.foto).toString('base64');
      }
    });

    // Formatear las fechas en los resultados
    controlaguaResults.forEach(result => {
      if (result.created_at) {
        const date = new Date(result.created_at);
        result.formatted_created_at = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}`;
      }
    });

    res.render('imputaciones/calidadAgua', {
      comunidades: comunidadesResults,
      controlagua: controlaguaResults
    });
  } catch (error) {
    next(error);
  }
});


// INSERT
router.post("/calidadAgua/add", isLoggedIn, async (req, res, next) => {
  try {
    const { piscina, nivelCloro, nivelPh, numeroBanistas, nivelRebosadero, aguaDepurada, foto } = req.body;
    const fotoBuffer = Buffer.from(foto.split(",").pop(), 'base64');

    const newWaterControl = {
      piscina,
      nivelCloro,
      nivelPh,
      numeroBanistas,
      nivelRebosadero,
      aguaDepurada,
      foto: fotoBuffer,
      user_id: req.user.id,
    };

    await connection.query("INSERT INTO controlagua SET ?", [newWaterControl]);
    req.flash("success", "Registro guardado!");
    res.redirect("/imputaciones/calidadAgua");
  } catch (error) {
    next(error);
  }
});

// DELETE
router.get('/calidadAgua/delete/:id', isLoggedIn, async (req, res, next) => {
  const id = req.params.id;
  try {
    await connection.query('DELETE FROM controlagua WHERE id = ?', [id]);
    req.flash('success', 'Control de calidad de agua eliminado correctamente!');
  } catch (error) {
    console.error('Error al eliminar el control de calidad del agua seleccionado:', error);
    req.flash('danger', 'Ocurrió un error al eliminar el control de calidad del agua seleccionado.');
  }
  res.redirect('/imputaciones/calidadAgua');
});

module.exports = router;
