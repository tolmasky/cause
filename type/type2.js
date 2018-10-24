const { Map, Set, OrderedSet, List, Stack } = require("immutable");
const data = require("./data");

exports.data = require("./data");

const primitive = function primitive(typename)
{
    const is = value => typeof value === typename;
    const toString = () => `type ${typename}`;

    return { is };
}

exports.boolean = primitive("boolean");
exports.number = primitive("number");
exports.string = primitive("string");
exports.regexp = primitive("regexp");

/*
const I = function pI(type, parameters)
{
    return function (...Ts)
    {
        if (Ts.length !== parameters.length)
            throw TypeError(
                `${type.name} takes ${Ts.length} parameterized types, ` +
                `but received only ${parameters.length}.`);

        const typename = `${I.name}<${parameters.map(T => type + "")}>`;

        return I(type, typename);
    };
}


function 


const { Map, Set, OrderedSet, List, Stack } = require("immutable");
const Description = Symbol("description");
const forSumProduct = require("./for-sum-product");
const InspectSymbol = require("util").inspect.custom;
const type = module.exports = function type (declaration)
{
    const evaluated = declaration(0);

    // We are paramaterized
    return typeof evaluated === "function" ?
        (...args) => construct(T =>
            forSumProduct(type, T, declaration(...args), args)) :
        construct(T => forSumProduct(type, T, declaration, []));
}

type.type = type;
type.description = T => T[Description];

type.is = (...args) => args.length < 2 ?
    value => type.is(args[0], value) :
    args[0][Description].is(args[1]);

function construct (f)
{
    const T = (...args) => call(...args);

    // We should calculate the name first...
    Object.defineProperty(T, Description, { writable:true, value: { typename:"RECURSIVE" } });

    const description = f(T);
    const call = description.call;

    Object.defineProperty(T, "name", { value: description.typename });
    Object.defineProperty(T, Description, { value: description });

    Object.assign(T, { toString: () => description.typename });
    Object.assign(T, { [InspectSymbol]: () => description.typename });

    if (description.keyedConstructors)
        Object.assign(T, description.keyedConstructors);

    return T;
}

const primitive = (function ()
{
    return (typename, initial, root) =>
        construct(T => fromPrimitive(T, typename, initial, root));

    function fromPrimitive(T, typename, initial, root)
    {
        const initializer = () => initial;
        const is = value => typeof value === name;
        const call = initial => primitive(typename, initial, root || T);

        return { call, typename, is, root, initializer };
    }
})();

type.string = primitive("string", "");
type.number = primitive("number", 0);
type.regexp = primitive("regexp", /./g);
type.boolean = primitive("boolean", true);

type.Maybe = type (T => Maybe => [Nothing => [], Just => [ value => T ]]);

const collection = (function()
{
    return I => (...args) => construct(T => forCollection(T, I, args));

    function forCollection(T, I, parameters)
    {
        const parameterNames =
            `<${parameters.map(T => type.description(T).typename)}>`;
        const typename = `${I.name}${parameterNames}`;

        // We probably want something better than this, we're not checking
        // the actual contents here.
        const is = value => value instanceof I;
        const initializer = I;
        const call = I;
        const keyedConstructors = I;

        return { typename, call, initializer, is, keyedConstructors };
    }
})();

type.Map = collection(Map);
type.Set = collection(Set);
type.OrderedSet = collection(OrderedSet);
type.List = collection(List);
type.Stack = collection(Stack);


type.fromNative = function (from)
{
    const { constructor } = from.prototype;
    const typename = constructor.name;
    const is = value => value instanceof constructor;
    const initializer = (...args) => new constructor(...args);
    const call = (...args) => new constructor(...args);

    return construct(T => ({ typename, call, initializer, is }));
}


/*T.Record = function Record (declaration)
{
    return construct(type => forRecord(T, type, declaration));
}

T.Maybe = function (type)
{
    
}
*/

/*


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
*/
