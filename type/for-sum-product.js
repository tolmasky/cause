const InspectSymbol = require("util").inspect.custom;
const { Record } = require("immutable");
const { getPrototypeOf } = Object;
const { isArray } = Array;
const isFunction = value => typeof value === "function";

const fNameRegExp = /([^=\s]+)\s*=>/;
const fNameParse = f => fNameRegExp.exec(f + "")[1];
const fParseMap = farray => farray.map(f => [fNameParse(f), f()]);


module.exports = function forSumProduct (type, T, declaration, parameters)
{
    const parameterNames = parameters.length <= 0 ?
        "" :
        `<${parameters.map(T => type.description(T).typename)}>`;
    const typename = fNameParse(declaration) + parameterNames;
    const components = fParseMap(declaration(T));

    const isSum = components.every(([, c]) => isFunction(c));
    const isProduct = components.every(([, c]) => isArray(c));

    if (!isSum && !isProduct)
        throw TypeError(
            `Could not parse declaration for ${typename}. ` +
            `Perhaps you are mixing constructors and properties?`);

    const products = isSum ?
        [typename, fParseMap(components)] :
        components.map(([name, properties]) =>
            [name, fParseMap(properties)]);

    const constructors = products
        .map(([name, properties]) =>
            [name, toConstructor(type, T, typename, name, properties)]);
    const keyedConstructors = constructors.reduce(fromPairs, { });
    const call = isSum ?
        constructors[0][1] :
        () => { throw TypeError(`${typename} is a type, not a constructor`) };
    const firstConstructor = constructors[0][1];
    const initializer = typeof firstConstructor === "function" ?
        firstConstructor : () => firstConstructor;
    const is = value =>
        getPrototypeOf(value).constructor.type === T;

    return { typename, products, call, keyedConstructors, initializer, is };
}

function toConstructor(type, T, typename, name, properties)
{
    if (properties.length === 0)
        return Object.create(
        {
            constructor: { type: T },
            toString: () => `${typename}.${name}`,
            [InspectSymbol]: () => `${typename}.${name}`
        });

    const fields = properties
        .map(([name, T]) =>
            [name, type.description(T).initializer()])
        .reduce(fromPairs, { });

    return Object.assign(
        Record(fields, `${typename}.${name}`),
        { type: T });
}

function fromPairs(object, [name, value])
{
    return (object[name] = value, object);
}

function serializeRecord({ components }, value, state, reference)
{
    const storage = [];

    return [components.reduce(function (state, [name, type])
    {
        const [outState, UID] =
            reference(state, components[name], value[name]);

        return (storage.push(UID), outState);
    }, inState), storage];
}