const { data, union, parameterized, primitives, tnull } = require("@algebraic/type");
const { Optional, None } = require("@algebraic/type/optional");
const fail = require("@algebraic/type/fail");

const nullable = parameterized(T =>
    union `nullable<${T}>` (T, tnull) );

const t = require("@babel/types");
const fromDefinition = ({ optional, validate }) =>
    (deferred => optional ?
        () => nullable(deferred()) :
        deferred)(fromValidate(validate) || (() => Object));
const cached = f => (cache => (...args) =>
    cache[JSON.stringify(args)] ||
    (cache[JSON.stringify(args)] = f(...args)))
    (Object.create(null));
const fromOneOfNodeTypes = cached(names =>
    union ([`${JSON.stringify(names)}`])
        (...names.map(name =>
            toDeferredField(name, () => concrete[name] || aliases[name]))));
const fromValidate = validate =>
    !validate ? (() => Object) :
    validate.type && validate.type !== "array" ?
        () => primitives[validate.type] :
    validate.oneOfNodeTypes ?
        () => fromOneOfNodeTypes(validate.oneOfNodeTypes) :
    validate.chainOf ?
        validate.chainOf.map(fromValidate).find(x => !!x) :
    false;
const toDeferredField = (name, deferred) =>(console.log((new Function(`return ${name === "extends" || name === "default" || name === "const" ? "_extends" : name } => arguments[0]()`))(deferred)+""),
    (new Function(`return ${name === "extends" || name === "default" || name === "const" ? "_extends" : name } => arguments[0]()`))(deferred));

const concrete = Object.fromEntries(t
    .TYPES
    .filter(name => t[name] && !t.DEPRECATED_KEYS[name])
    .map(name => [name, data ([name]) (...Object
        .entries(t.NODE_FIELDS[name])
        .map(([name, definition]) => [name, fromDefinition(definition)])
        .map(([name, type]) => data.Field({ name, type, defaultValue: null })))]));
const aliases = Object.fromEntries(Object
    .entries(t.FLIPPED_ALIAS_KEYS)
    .map(([name, aliases]) =>
        [name, union ([name]) (...aliases.map(name => concrete[name]))]));
const c = concrete;

console.log(c.FunctionExpression({ id: c.Identifier({ name: "name" }), params:[], body:c.BlockStatement({ body:[], directives:[] }) }));
