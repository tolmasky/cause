const type = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Task = require("@cause/task");
const { Dependent, Dependency } = require("@cause/task/dependent");
const { iterator } = Symbol;
const { isArray } = Array;


module.exports = function δ(task)
{
    if (type.is(Dependency, task))
        return task;

    const isIterable =
        typeof task !== "undefined" &&
        typeof task !== "string" &&
        typeof task[iterator] === "function";

    if (!isIterable)
        return Task.Failure({ error: TypeError(`Was not expecting ${task} at δ`) });

    const typecast = isArray(task) ? Array.from : type.of(task);
    const lifted = true;
    const arguments = List(Dependency)(task);
    const typecasted =  (...args) => typecast(args);
    const callee = Task.Success({ value: typecasted });

    return Dependent.wrap({ lifted, callee, arguments });
}
