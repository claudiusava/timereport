const {format} = require('timeago.js');

const helpers = {};

helpers.timeago =(relativeDate) => {
    return format(relativeDate);
};

module.exports = helpers;