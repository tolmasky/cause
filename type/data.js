const { isArray } = Array;
const { Record } = require("immutable");
const Description = Symbol("description");
const InspectSymbol = require("util").inspect.custom;

const data = function ([typename])
{
    let singleConstructor = false;
    const dataConstructors = [];
    const description = { name:typename, dataConstructors };
    const declareDataConstructor = function ([dataConstructorName])
    {
        const [defineDataConstructor, dataConstructor] =
            toDataConstructor(`${typename}.${dataConstructorName}`);

        dataConstructors.push(dataConstructor);
        T[dataConstructorName] = dataConstructor;

        return defineDataConstructor;
    }
    const state = { defineDataConstructor: false };
    const T = function (...args)
    {
        if (singleConstructor)
            return singleConstructor(...args);

        if (!state.defineDataConstructor &&
            dataConstructors.length === 0 &&
            !isArray(args[0]))
        {
            const [defineDataConstructor, dataConstructor] =
                toDataConstructor(typename);

            defineDataConstructor(...args);
            singleConstructor = dataConstructor;
        }

        else if (!state.defineDataConstructor || isArray(args[0]))
            state.defineDataConstructor =
                declareDataConstructor(...args);
        else
        {
            state.defineDataConstructor(...args);
            state.defineDataConstructor = false;
        }

        return T;
    }

    Object.defineProperty(T, "name", { value: typename });
    Object.defineProperty(T, Description, { value: description });

    T.is = value => 
        dataConstructors.some(dataConstructor => dataConstructor.is(value));
    T.toString = () => typename;
    T[InspectSymbol] = () => typename;
    
    Object.assign(T, { toString: () => typename });
    Object.assign(T, { [InspectSymbol]: () => typename });

    return T;
}

module.exports = data;

const fParseMap = (function ()
{
    const fNameRegExp = /([^=\s]+)\s*=>/;
    const fNameParse = f => fNameRegExp.exec(f + "")[1];

    return farray => farray.map(f => [fNameParse(f), f()]);
})();

function toDataConstructor(name)
{
    const description = { name };
    const dataConstructor = function (...args)
    {
        const unary = !description.properties;

        if (unary)
            throw TypeError(
                `${name} is a unary data constructor, use ${name} ` +
                `instead of ${name}()`);

        if (!description.create)
        {
            const [create, is] = toCreate(description);
            description.create = create;
            dataConstructor.is = is;
        }

        return description.create(...args);
    }

    Object.defineProperty(dataConstructor, "name", { value: name });

    dataConstructor.is = value => value === dataConstructor;
    dataConstructor.toString = () => name;
    dataConstructor[InspectSymbol] = () => name;

    const specify = (...properties) =>
        description.properties = properties;

    return [specify, dataConstructor];
}

function toCreate({ name, properties })
{
    const parsed = fParseMap(properties);
    const named = parsed[0][0] !== "()";console.log(name + " " + named);
    const types = named ?
        parsed :
        parsed.map((pair, index) => [index, pair[1]]);
    const record = Record(types.reduce(fromPairs, { }), name);
    const create = function (...args)
    {
        if (args.length === 0)
            throw TypeError(`${name} expects ${types.length} fields.`);

        const fields = named ?
            args[0] :
            args.map((arg, index) => [index, arg])
                .reduce(fromPairs, { });

        for (const [property, type] of types)
            if (!type.is(fields[property]))
                throw TypeError(
                    `${name} data constructor passed field "${property}" ` +
                    `of wrong type. Expected type ${type}`);

        return record(fields);
    };
    const is = value => value instanceof record;

    return [create, is];
}

function fromPairs(object, [name, value])
{
    return (object[name] = value, object);
}
/*
data.of = function (definition)
{
    return 
}
*/