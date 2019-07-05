const t = require("@babel/types");

module.exports = t.TYPES
    .filter(name => t[name] && !t.DEPRECATED_KEYS[name]);
