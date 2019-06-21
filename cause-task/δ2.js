const { fNamed } = require("@algebraic/type/declaration");
const { Task, fromAsync } = require("@cause/task");
const CachedDeltas = Symbol("δs");
const get = (object, key, make) => object[key] || (object[key] = make());
const cache = (f, ds, getδf) =>
    get(get(f, CachedDeltas, () => Object.create(null)),
        JSON.stringify(ds), () =>
            fNamed(`(δ/${ds.map(d => `δ${d}`).join("")})(${f.name})`,
                getδf(f, ds)));
const success = value => Task.Success({ value });


module.exports = δ;
module.exports.success = success;

function δ(f, ...ds)
{
    return cache(f, ds, fromStandard);
}

function fromStandard(f, ds, knownSync = false)
{
    if (ds.length > 0)
        throw TypeError(`Can not take δ of ${f.name} on [${ds.join(", ")}]`);

    return knownSync ?
        (...args) => success(f(...args)) :
        fromAsync((...args) => Promise.resolve(f(...args)));
}

const operators = Object.fromEntries(Object.entries(
{
    "+": (lhs, rhs) => lhs + rhs,
    "-": (lhs, rhs) => lhs - rhs,
    "*": (lhs, rhs) => lhs * rhs,
    "/": (lhs, rhs) => lhs / rhs,
    "%": (lhs, rhs) => lhs / rhs,
    "**": (lhs, rhs) => lhs ** rhs,
    "unary -": value => -value,
    "unary +": value => +value,

    "&": (lhs, rhs) => lhs & rhs,
    "|": (lhs, rhs) => lhs | rhs,
    "^": (lhs, rhs) => lhs ^ rhs,
    "<<": (lhs, rhs) => lhs << rhs,
    ">>": (lhs, rhs) => lhs >> rhs,
    ">>>": (lhs, rhs) => lhs >> rhs,
    "~": value => ~value,

    "==": (lhs, rhs) => lhs == rhs,
    "===": (lhs, rhs) => lhs === rhs,
    "!=": (lhs, rhs) => lhs != rhs,
    "!==": (lhs, rhs) => lhs !== rhs,
    ">": (lhs, rhs) => lhs > rhs,
    ">=": (lhs, rhs) => lhs >= rhs,
    "<": (lhs, rhs) => lhs < rhs,
    "<=": (lhs, rhs) => lhs <= rhs,

    "!": value => !value,

    "typeof": value => typeof value,
    "in": (lhs, rhs) => lhs in rhs,
    "instanceof": (lhs, rhs) => lhs instanceof rhs
}).map(([operator, f]) =>
    [operator, (cache(fNamed(operator, f), [],
        (f, ds) => fromStandard(f, ds, true)), f)]));

operators["?:"] = fNamed("?:",
    (test, consequent, alternate) =>
        test ? consequent() : alternate()); 

cache(operators["?:"], [1], () =>
    (test, δconsequent, alternate) =>
        test ? δconsequent() : success(alternate()));
cache(operators["?:"], [2], () =>
    (test, consequent, δalternate) =>
        test ? success(consequent()) : δalternate());
cache(operators["?:"], [1,2], () =>
    (test, δconsequent, δalternate) =>
        test ? δconsequent() : δalternate());

operators["||"] = fNamed("||", () => (lhs, rhs) => lhs() || rhs());
cache(operators["||"], [0], () => (δlhs, rhs) => δlhs() || success(rhs()));
cache(operators["||"], [1], () => (lhs, δrhs) => success(lhs()) || δrhs());
cache(operators["||"], [0, 1], () => (δlhs, δrhs) => δlhs() || δrhs());

operators["&&"] = fNamed("&&", () => (lhs, rhs) => lhs() && rhs());
cache(operators["&&"], [0], () => (δlhs, rhs) => δlhs() && success(rhs()));
cache(operators["&&"], [1], () => (lhs, δrhs) => success(lhs()) && δrhs());
cache(operators["&&"], [0, 1], () => (δlhs, δrhs) => δlhs() && δrhs());


console.log(δ(operators["?:"], 1)+"");
console.log(δ(operators["?:"], 1));
console.log(δ(operators["?:"], 2));
console.log(δ(operators["?:"], 1, 2));

console.log(δ(operators["||"], 0)+"");
console.log(δ(operators["||"], 0));
console.log(δ(operators["||"], 1));
console.log(δ(operators["||"], 0, 1));

console.log(δ(operators["&&"], 0)+"");
console.log(δ(operators["&&"], 0));
console.log(δ(operators["&&"], 1));
console.log(δ(operators["&&"], 0, 1));

console.log(δ(operators["+"])(1, 2));
console.log(δ(operators["&&"], 1)+"");
module.exports.operators = operators;
