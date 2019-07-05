const { data, parameterized, any, primitives, nullable, or } = require("@algebraic/type");
const fail = require("@algebraic/type/fail");
const valueTypes = { ...primitives, "null": primitives.tnull };


module.exports = function fieldFromBabelDefinition(Node, name, definition)
{
    const deferredType =
        deferredTypeFromValidate(Node, definition.validate) || (() => any);
    const wrappedDeferredType = definition.optional ?
        () => nullable(deferredType()) :
        deferredType;

    // By default every definition is assigned a default of null, so we can't
    // just blindly use that.
    const hasTrueDefaultValue = definition.default !== null;
    const defaultValue = definition.optional ?
        () => definition.default :
        hasTrueDefaultValue ?
            deferredType :
            data.Field.NoDefault;

//     () => (type => parameterized.is(List, type) ?
//        type(data.default) : data.default)(deferredType()) :

    return data.Field({ name, type: wrappedDeferredType, defaultValue });
}

function deferredTypeFromValidate(Node, validate)
{
    const { aliases } = Node;

    // There are only 10 fields that don't define a proper validation
    // function, and they all appear to be bugs.
    return !validate ? () => any :

    // The value types are easy.
    validate.direct ? () => validate.direct :
    validate.type === "array" ? () => Array :
    validate.type ? () => valueTypes[validate.type] :

    // This is a weird one. Sometimes the use of `oneOf` is suspect, or at least
    // inconsistent. For example, sometimes oneOf: [true, false] is used instead
    // of the identical in meaning type: "boolean". Other times, the use is more
    // legitimate, such as specifying the specific strings that can be
    // operators. But in these cases we lack the expressiveness to convey this
    // and remain backwards compatible with ESTree (if we used an union, then we
    // wouldn't be a string, but perhaps we could make use of a toString hack?)
    validate.oneOf ?
        (type => () => type)(
            valueTypes[typeof validate.oneOf[0]] ||
            fail(`Could not convert oneOf validation to primitive type.`)) :

    validate.oneOfNodeTypes ?
        () => or(...validate.oneOfNodeTypes
            .map(name => Node[name]|| fail("FOUND NOTHING FOR " + name))) :

    validate.oneOfNodeOrValueTypes ?
        () => or(...validate.oneOfNodeOrValueTypes
            .map(name => valueTypes[name] || Node[name] || fail("FOUND NOTHING FOR " + name))) :

    // FIXME: Maybe when we support properly typed arrays bring this back?
    // validate.each ? () => /*List(fromValidate(validate.each)())*/Array :

    // Just get the first working version of this.
    validate.chainOf ? validate.chainOf
        .map(validate => deferredTypeFromValidate(Node, validate))
        .find(x => !!x) :

    false;
}
