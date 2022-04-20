const bcrypt = require('bcryptjs');
const { param } = require('../routes/authentication');

const helpers = {};

helpers.encryptPassword =  (password) => {
  const salt =  bcrypt.genSaltSync(10);
  const hash =  bcrypt.hashSync(password, salt);
  return hash;
};

helpers.matchPassword = (password, savedPassword) => {
  try {
    return bcrypt.compareSync(password, savedPassword);
  } catch (e) {
    console.log(e)
  }
};

module.exports = helpers;