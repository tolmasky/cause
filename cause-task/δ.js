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

module.exports.depend = function (lifted, callee, ...arguments)
{
    return Dependent.wrap({ lifted, callee, arguments });
}

module.exports.success = function (value)
{
    return Task.Success({ value });
}

function liftedCall(lift, f)
{
    if (!lift)
        return f();

    try { return Task.Success({ value: f() }); }
    catch (e) { return Task.Failure({ error: e }); }
}

module.exports.operators = Object.fromEntries(Object.entries(
{
    "+": (lhs, rhs) => lhs + rhs,
    "-": (lhs, rhs) => lhs - rhs,
    "*": (lhs, rhs) => lhs * rhs,
    "/": (lhs, rhs) => lhs / rhs,
    "%": (lhs, rhs) => lhs / rhs,
    "**": (lhs, rhs) => lhs ** rhs,
    "u(-)": value => -value,
    "u(+)": value => +value,

    "&": (lhs, rhs) => lhs & rhs,
    "|": (lhs, rhs) => lhs | rhs,
    "^": (lhs, rhs) => lhs ^ rhs,
    "<<": (lhs, rhs) => lhs << rhs,
    ">>": (lhs, rhs) => lhs >> rhs,
    ">>>": (lhs, rhs) => lhs >> rhs,
    "u(~)": value => ~value,

    "==": (lhs, rhs) => lhs == rhs,
    "===": (lhs, rhs) => lhs === rhs,
    "!=": (lhs, rhs) => lhs != rhs,
    "!==": (lhs, rhs) => lhs !== rhs,
    ">": (lhs, rhs) => lhs > rhs,
    ">=": (lhs, rhs) => lhs >= rhs,
    "<": (lhs, rhs) => lhs < rhs,
    "<=": (lhs, rhs) => lhs <= rhs,

    "&&": (lhs, rhs) => lhs && rhs,
    "||": (lhs, rhs) => lhs || rhs,
    "u(!)": value => !value,

    "if": (condition, consequent, alternate) =>
        liftedCall(...(condition ? consequent : alternate)),

    "u(typeof)": value => typeof value,
    "in": (lhs, rhs) => lhs in rhs,
    "instancoef": (lhs, rhs) => lhs instanceof rhs,

    ".": (lhs, rhs) => (value =>
        typeof value === "function" ?
            value.bind(lhs) : value)(lhs[rhs]),

    "=([])": (...args) => args
}).map(([operator, f]) => [operator, Task.Success({ value: f })]));
