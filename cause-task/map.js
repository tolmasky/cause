const type = require("@algebraic/type");
const { List } = require("@algebraic/collections");

const Task = require("./task");
const { Dependent, Dependency } = require("./dependent");


module.exports = function map(tf, list)
{
    const lifted = true;
    const arguments = List(Dependency)(list.map(tf));
    const typecasted =  (...args) => list.map((_, index) => args[index]);
    const callee = Task.Success({ value: typecasted });

    return Dependent.wrap({ lifted, callee, arguments });
}
