const express = require('express');
const router = express.Router();
const pool = require('../database');
const { isLoggedIn } = require('../lib/auth');

// SELECT
router.get('/calidadAgua', isLoggedIn, (req, res) => {
  // Obtener una conexión del pool
  pool.getConnection((error, connection) => {
    if (error) {
      throw error;
    }

    // Consulta para recuperar los registros de la tabla 'comunidades'
    connection.query(`
      SELECT c.nombre, c.codigo
      FROM comunidades c
      WHERE 
          (SELECT permisoDeAdministracion FROM users WHERE id = ?) = 1 
          OR 
          c.codigo IN (SELECT codigo FROM asignacioncomunidades WHERE user_id = ?);`, [req.user.id, req.user.id], function (error, comunidadesResults) {
      if (error) {
        connection.release(); // Liberar la conexión en caso de error
        throw error;
      }

      // Consulta para recuperar los registros de la tabla 'controlagua' con todos los campos
      connection.query(`SELECT *, 
          DATE_FORMAT(controlagua.created_at, '%d/%m/%Y %H:%i') AS formatted_created_at
          FROM controlagua
          WHERE user_id = ?
          ORDER BY created_at DESC;
  `, [req.user.id], function (error, controlaguaResults) {
        connection.release(); // Liberar la conexión después de la consulta

        if (error) {
          throw error;
        }

        // Convertir la foto a cadena base64
        controlaguaResults.forEach(result => {
          if (result.foto) {
            result.foto = Buffer.from(result.foto).toString('base64');
          }
        });

        res.render('imputaciones/calidadAgua', {
          comunidades: comunidadesResults,
          controlagua: controlaguaResults
        });
      });
    });
  });
});

// INSERT
router.post("/calidadAgua/add", isLoggedIn, async (req, res) => {
  const { piscina, nivelCloro, nivelPh, numeroBanistas, nivelRebosadero, aguaDepurada, foto } = req.body;

    fotoBuffer = Buffer.from(foto.split(",").pop(), 'base64');

    console.log(fotoBuffer)
  
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
  
    // Obtener una conexión del pool
    pool.getConnection(async (error, connection) => {
      if (error) {
        throw error;
      }
  
      try {
        // Insertar el nuevo registro
        await connection.query("INSERT INTO controlagua SET ?", [newWaterControl]);
        req.flash("success", "Registro guardado!");
        res.redirect("/imputaciones/calidadAgua");
      } catch (error) {
        req.flash("danger", "Error al guardar el registro");
      } finally {
        connection.release(); // Liberar la conexión después de la consulta
      }
    });
});


// DELETE
router.get('/calidadAgua/delete/:id', (req, res) => {
  const id = req.params.id;

  // Obtener una conexión del pool
  pool.getConnection((error, connection) => {
    if (error) {
      throw error;
    }

    // Eliminar el registro
    connection.query('DELETE FROM controlagua WHERE id = ?', [id], (error) => {
      connection.release(); // Liberar la conexión después de la consulta

      if (error) {
        console.error('Error al eliminar el control de calidad del agua seleccionado:', error);
        req.flash('danger', 'Ocurrió un error al eliminar el control de calidad del agua seleccionado.');
      } else {
        req.flash('success', 'Control de calidad de agua eliminado correctamente!');
      }
      res.redirect('/imputaciones/calidadAgua');
    });
  });
});

module.exports = router;
