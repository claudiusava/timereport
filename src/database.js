const mysql = require('mysql2');
const { promisify } = require('util');
const { database } = require('./keys');

const pool = mysql.createPool(database);

// Promisify Pool Queries
pool.query = promisify(pool.query);

// Manejar eventos de conexión y errores
pool.getConnectionAsync = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
          console.error('DATABASE CONNECTION WAS CLOSED');
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
          console.error('DATABASE HAS TOO MANY CONNECTIONS');
        }
        if (err.code === 'ECONNREFUSED') {
          console.error('DATABASE CONNECTION WAS REFUSED');
        }
        reject(err);
      } else {
        resolve(connection);
      }
    });
  });
};

// Establecer conexión inicial
(async () => {
  try {
    const connection = await pool.getConnectionAsync();
    connection.release();
    console.log('DB is connected');
  } catch (error) {
    console.error('Error connecting to database:', error);
  }
})();

module.exports = pool;
