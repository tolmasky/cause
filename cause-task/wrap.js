const Task = require("./task");
const { Dependent, Dependency } = require("./dependent");


module.exports = function (callee, ...arguments)
{
    return Dependent.wrap({ lifted: false, callee, arguments });
}

module.exports.lift = function (callee, ...arguments)
{
    return Dependent.wrap({ lifted: true, callee, arguments });
}

module.exports.success = function (value)
{
    return Task.Success({ value });
}

const operators = Object.entries(
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
        condition ? consequent() : alternate(),

    "u(typeof)": value => typeof value,
    "in": (lhs, rhs) => lhs in rhs,
    "instancoef": (lhs, rhs) => lhs instanceof rhs,

    ".": (lhs, rhs) => (value =>
        typeof value === "function" ?
            value.bind(lhs) : value)(lhs[rhs]),

    "=([])": (...args) => args
});

for (const [operator, f] of operators)
    module.exports[operator] = Task.Success({ value: f });
