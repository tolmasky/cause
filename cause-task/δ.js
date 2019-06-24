const { fNamed } = require("@algebraic/type/declaration");
const { Task, fromAsync } = require("@cause/task");
const Dependent = require("@cause/task/dependent");
const CachedDeltas = Symbol("δs");
const get = (object, key, make) => object[key] || (object[key] = make());
const cache = (f, ds, getδf) =>
    get(get(f, CachedDeltas, () => Object.create(null)),
        JSON.stringify(ds), () =>
            fNamed(`(δ/${ds.map(d => `δ${d}`).join("")})(${f.name})`,
                getδf(f, ds)));
const success = value => Task.Success({ value });


module.exports = δ;

function δ(f, ds)
{
    return cache(f, ds, fromStandard);
}

δ.success = success;

δ.depend = function (lifted, callee, ...rest)
{
    return Dependent.wrap({ lifted, callee, arguments: rest });
}

δ.apply = function (object, property, ds, args)
{
    return δ(object[property], ds).apply(object, args);
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
    "instanceof": (lhs, rhs) => lhs instanceof rhs,

    ".": (lhs, rhs) => (value =>
        typeof value === "function" ?
            value.bind(lhs) : value)(lhs[rhs])

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

const δmap = (map, convertBack) => cache(map, [0], () => function (f)
{
    const dependencies = map.call(this, f);
    const callee = (...args) => convertBack(args);

    return δ.depend(true, success(callee), ...dependencies);
});

δmap(Array.prototype.map, Array.from);

const { List, Set, OrderedSet, Seq, Stack } = require("@algebraic/collections");

[List, Set, OrderedSet, Seq, Stack]
    .map(type => [type, Object.getPrototypeOf(type(Object)())])
    .map(([type, prototype]) => δmap(prototype.map, type(Object)));

δ.operators = operators;

/*
console.log(δ(operators["?:"], [1])+"");
console.log(δ(operators["?:"], [1]));
console.log(δ(operators["?:"], [2]));
console.log(δ(operators["?:"], [1, 2]));

console.log(δ(operators["||"], [0])+"");
console.log(δ(operators["||"], [0]));
console.log(δ(operators["||"], [1]));
console.log(δ(operators["||"], [0, 1]));

console.log(δ(operators["&&"], [0])+"");
console.log(δ(operators["&&"], [0]));
console.log(δ(operators["&&"], [1]));
console.log(δ(operators["&&"], [0, 1]));

//console.log(δ(operators["+"], [1, 2]));
console.log(δ(operators["&&"], [1])+"");
module.exports.operators = operators;*/
