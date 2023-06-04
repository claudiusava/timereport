const express = require('express');
const router = express.Router();

const pool = require('../database');

const {isLoggedIn} = require('../lib/auth');

router.get('/registrarKilometros', isLoggedIn, async (req,res) =>{
        try {
                let vehiculos = [];
                vehiculos = await new Promise((resolve, reject) => {
                      pool.query("SELECT matricula, kilometros FROM vehiculos", (error, resultados) => {
                        if (error) reject(error);
                        resolve(resultados);
                      });
                    });
            
                res.render("imputaciones/registrarKilometros", { vehiculos });
              } catch (error) {
                      req.flash("danger", "Error al obtener las vehiculos.");
                res.redirect("/imputaciones/registrarKilometros");
              }
});

router.post('/registrarKilometros', isLoggedIn, async (req, res) => {
        try {
          const { matricula, kilometros } = req.body;
          const newFurgoneta = {
            matricula,
            kilometros
          };
      
          await pool.query('INSERT INTO vehiculos SET ?', [newFurgoneta]);
          req.flash('success', 'Furgoneta guardada correctamente!');
          res.redirect('/imputaciones/registrarKilometros');
        } catch (error) {
          console.error('Error al registrar los kilómetros:', error);
          req.flash('error', 'Error al guardar la nueva furgoneta');
          res.redirect('/imputaciones/registrarKilometros');
        }
});

module.exports = router;