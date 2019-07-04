const { data, union, parameterized, primitives, tnull, string } = require("@algebraic/type");
const t = require("@babel/types");

const Nullable = parameterized(T =>
    union `Nullable<${T}>` (T, tnull) );
const Alias = parameterized((...Ts) =>
    union `Alias<${Ts.join(", ")}>` (...Ts));

const fromValidate = validate =>
    !validate ? (() => Object) :
    validate.type && validate.type !== "array" ?
        () => primitives[validate.type] :
    validate.oneOfNodeTypes ?
        () => Alias(...validate.oneOfNodeTypes
            .map(name => concrete[name] || aliases[name])) :
    validate.chainOf ?
        validate.chainOf.map(fromValidate).find(x => !!x) :
    false;



const toNodeField = function ([name, definition])
{
    const typeDeferred =
        fromValidate(definition.validate) || (() => Object);
    const typeDeferredWrapped = definition.optional ?
        () => Nullable(typeDeferred()) :
        typeDeferred;

    // By default every definition is assigned a default of null, so we can't
    // just blindly use that.
    const hasTrueDefaultValue = definition.default !== null;
    const defaultValue = definition.optional ?
        definition.default :
        hasTrueDefaultValue ?
            data.default :
            data.Field.NoDefault;

    return data.Field({ name, type: typeDeferredWrapped, defaultValue });
}


const concrete = Object.fromEntries(t
    .TYPES
    .filter(name => t[name] && !t.DEPRECATED_KEYS[name])
    .map(name => [name,
        data ([name]) (
        type => [string, name],
        ...Object
            .entries(t.NODE_FIELDS[name])
            .map(toNodeField))]));
const aliases = Object.fromEntries(Object
    .entries(t.FLIPPED_ALIAS_KEYS)
    .map(([name, aliases]) =>
        [name, union ([name]) (...aliases.map(name => concrete[name]))]));
const c = concrete;
const node = c.FunctionExpression({ id: c.Identifier({ name: "name" }), params:[], body:c.BlockStatement({ body:[], directives:[] }) });

console.log(c.FunctionExpression);
console.log(node);
console.log(require("@babel/generator").default(node).code);
