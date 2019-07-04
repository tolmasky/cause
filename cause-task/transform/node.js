const { data, union, parameterized, primitives, tnull, string, getTypename } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const t = require("@babel/types");

const Nullable = parameterized(T =>
    union `Nullable<${T}>` (T, tnull) );
//const Alias = parameterized((name, ...Ts) =>
//    union `${name}<${Ts.map(getTypename)}>` (...Ts));
const Or = parameterized((...Ts) =>
    Ts.length === 1 ?
        Ts[0] :
        union `Alias<${Ts.map(getTypename)}>` (...Ts));

const fromValidate = validate =>
    !validate ? (() => Object) :
    validate.type && validate.type !== "array" ?
        () => primitives[validate.type] :
    validate.oneOfNodeTypes ?
        () => Or(...validate.oneOfNodeTypes
            .map(name => concrete[name] || aliases[name])) :
    validate.each ?
        () => List(fromValidate(validate.each)()) :
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
        () => definition.default :
        hasTrueDefaultValue ?
            () => (type => parameterized.is(List, type) ?
                type(data.default) : data.default)(typeDeferred()) :
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
const a = aliases;
const node = c.FunctionExpression({ id: c.Identifier({ name: "name" }), params:List(a.Pattern)(), body:c.BlockStatement({ body: List(a.Statement)() }) });

console.log(c.FunctionExpression);
console.log(node);
console.log(require("@babel/generator").default(node).code);
