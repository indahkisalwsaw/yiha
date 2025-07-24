const path = require('path');

const DB_PATH = path.join(__dirname, '../database');
const EXPORTS_PATH = path.join(__dirname, '../../exports');

module.exports = {
    DB_PATH,
    EXPORTS_PATH,
    getDbPath: (filename) => path.join(DB_PATH, filename),
    getExportPath: (filename) => path.join(EXPORTS_PATH, filename)
};
