const { Record, fromJS } = require("immutable");
const ErrorRegExp = /^Error\n(?:\s+at[^\n]+\n){2}\s+at\s+([^\(]+\(([^\)]+)[^\n]+)/;
const LocationRegExp = /^.+\:\d+\:\d+$/;
const constructors = Object.create(null);
const type = object => Object.getPrototypeOf(object).constructor;


module.exports = function (fields, name)
{
    const [_, line, location] = Error().stack.match(ErrorRegExp);
    const path = location.substr(0,
        location.lastIndexOf(":", location.lastIndexOf(":") - 1));
    const id = JSON.stringify({ name, line, fields });
    const constructor = Record(fields, name);
    const unnamespaced =
        (split => split[split.length - 1])
        (name.split("."));

    Object.defineProperty(constructor, "id", { value: id });
    Object.defineProperty(constructor, "name", { value: name });
    Object.defineProperty(constructor, "path", { value: path });
    Object.defineProperty(constructor, unnamespaced, { value: constructor });

    constructors[id] = constructor;

    return constructor;
}

module.exports.serialize = function serialize(record)
{
    return { id: type(record).id, serialized: record.toJS() };
}

module.exports.deserialize = function deserialize(data)
{
    return constructors[data.id](fromJS(data.serialized));
}
