const { Record, fromJS } = require("immutable");
const ErrorRegExp = /^Error\n\s+at[^\n]+\n\s+at([^\n]+)/;
const constructors = Object.create(null);
const type = object => Object.getPrototypeOf(object).constructor;


module.exports = function (fields, name)
{
    const line = Error().stack.match(ErrorRegExp)[1];
    const id = JSON.stringify({ name, line, fields });
    const constructor = Record(fields, name);

    Object.defineProperty(constructor, "id", { value: id });
    Object.defineProperty(constructor, "name", { value: name });

    constructors[id] = constructor;

    return constructor;
}

module.exports.serialize = function serialize(record)
{
    return { id: type(record).id, serialized: record.toJS() };
}

module.exports.deserialize = function deserialize(data)
{console.log(data);
    return constructors[data.id](fromJS(data.serialized));
}
