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
        const serialize = serializeProduct;
        const description = { serialize, types, initializer, is };

        return T_(description, name);
    }
}

function serializeProduct(inState, reference, type, value)
{
    const { types } = type[Description];
    const storage = [];

    return [Object.keys(types).reduce(function (state, key)
    {
        const [outState, UID] =
            reference(state, types[key], value[key]);

        return (storage.push(UID), outState);
    }, inState), storage];
}

T.description = function Tdescription(type)
{
    return type[Description];
}

T.is = function (type)
{
    return value => type[Description].is(value);
}

T.number = primitive("number", 0, (s, _, __, v) => [s, v]);
T.string = primitive("string", "", (s, _, __, v) => [s, v]);
T.boolean = primitive("boolean", false, (s, _, __, v) => [s, v]);
T.regexp = primitive("regexp", /./g, (s, _, __, v) => [s, v]);
T.object = primitive("object", null, (s, _, __, v) => [s, v]);

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
        const which = value => representations.findIndex(type => T.is(type)(value))
        const is = value => which(value) >= 0;
        const initializer = () => representations[0][Description].initializer();
        const serialize = () =>
            (index => [index, representations[index][Description].serialize(value)])
            (which(value));
        const deserialize = storage =>
            representations[storage[0]][Description].deserialize(storage[1]);

        return T_({ deserialize, serialize, initializer, is, representations }, name);
    }
}

function primitive(name, initial, serialize, root)
{
    const initializer = () => initial;
    const is = value => typeof value === name;
    const direct = initial => primitive(name, initial, serialize, type);
    const type = T_({ initializer, direct, is, serialize, root }, name);

    return type;
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
