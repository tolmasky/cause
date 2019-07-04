const Node = require("./node");
const { parse, parseExpression } = require("@babel/parser");

module.exports = (...args) => Node.upgrade(parse(...args));
module.exports.expression =  (...args) => Node.upgrade(parseExpression(...args));

