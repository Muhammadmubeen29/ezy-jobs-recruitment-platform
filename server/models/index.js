'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const basename = path.basename(__filename);
const db = {};

// Load all model files
fs.readdirSync(__dirname)
  .filter((file) => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file));
    const modelName = model.modelName || file.replace('.js', '');
    db[modelName] = model;
  });

// Export mongoose and connection
db.mongoose = mongoose;

module.exports = db;
