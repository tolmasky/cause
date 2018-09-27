const { Map, Set, OrderedSet, List, Stack, Record } = require("immutable");
const Description = Symbol("description");

module.exports = T;

function T([name])
{
    return function (types)
    {
        const fields = Object.keys(types)
            .map(name => [name, types[name][Description].initializer])
            .reduce((fields, [name, initializer]) =>
                (fields[name] = initializer(), fields),
                { });
        const initializer = Record(fields, name);
        const is = value => value instanceof initializer;
        const description = { initializer, is };

        return T_(description, name);
    }
}

T.is = function (type)
{
    return value => type[Description].is(value);
}

T.number = primitive("number", 0);
T.string = primitive("string", "");
T.boolean = primitive("boolean", false);
T.regexp = primitive("regexp", /./g);
T.object = primitive("object", null);

T.Map = parameterized(Map);
T.Set = parameterized(Set);
T.OrderedSet = parameterized(OrderedSet);
T.List = parameterized(List);
T.Stack = parameterized(Stack);

T.Product = T;

T.Sum = function([name])
{
    return function (...representations)
    {
        const is = value => !!representations.find(type => T.is(type)(value));
        const initializer = () => representations[0][Description].initializer();

        return T_({ initializer, is, representations });
    }
}

function primitive(type, initial)
{
    const initializer = () => initial;
    const is = value => typeof value === type;
    const direct = initial => primitive(type, initial);
    
    return T_({ initializer, direct, is }, type);
}

function parameterized(base)
{
    return function (...parameters)
    {
        const initializer = (...args) => base(...args);
        const is = value => value instanceof base;
        const names = parameters.map(type => type.name).join(", ");
        const name = `${base.name} <${names}>`;

        return T_({ parameters, initializer, is }, name);
    }
}

function T_(description, name)
{
    const { initializer, direct } = description;
    const call =
        direct && ((...args) => direct(...args)) ||
        initializer && ((...args) => initializer(...args)) ||
        ((...args) => { throw TypeError(`${name} cannot be called directly`); });

    Object.defineProperty(call, "name", { value: name });
    Object.defineProperty(call, Description, { value: description });

    return call;
}