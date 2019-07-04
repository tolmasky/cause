const { is, data, union, parameterized, primitives, tnull, string, getTypename } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const t = require("@babel/types");

const Nullable = parameterized(T =>
    union `Nullable<${T}>` (tnull, T) );
const Or = parameterized((...Ts) =>
    Ts.length === 1 ?
        Ts[0] :
        union `Alias<${Ts.map(getTypename)}>` (...Ts));
const valueTypes = { ...primitives, "null": tnull };
const oneOfType = validate =>
    validate.oneOfNodeTypes ||
    validate.oneOfNodeOrValueTypes;

const fromValidate = validate =>
    !validate ? (() => Object) :
    validate.type && validate.type !== "array" ?
        () => primitives[validate.type] :
    validate.oneOf ?
        (() => primitives[typeof validate.oneOf[0]]) || false :
    oneOfType(validate) ?
        () => Or(...oneOfType(validate).map(name =>
            valueTypes[name] || concrete[name] || aliases[name])) :
    validate.each ?
        () => /*List(fromValidate(validate.each)())*/Array :
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

const undeprecated = t
    .TYPES
    .filter(name => t[name] && !t.DEPRECATED_KEYS[name]);

function toNode(name, bridgeName, ...fields)
{
    const NodeType = data ([name]) (...fields);

    if (fields.length === 0)
        NodeType.type = bridgeName;
    else
        NodeType.prototype.type = bridgeName;

    return NodeType;
}

const concrete = Object.fromEntries(
    undeprecated.map(name => [name,
        toNode(name, name, ...Object
            .entries(t.NODE_FIELDS[name])
            .map(toNodeField))]));

concrete["IdentifierPattern"] =
    toNode("IdentifierPattern", "Identifier", name => string );

concrete["IdentifierExpression"] =
    toNode("IdentifierExpression", "Identifier", name => string );

module.exports.concrete = concrete;

const builtInAliases = t.FLIPPED_ALIAS_KEYS;
const expandedAliases =
{
    ...builtInAliases,
    LVal: [...builtInAliases["LVal"], "IdentifierPattern"],
    Pattern: [...builtInAliases["Pattern"], "IdentifierPattern"],
    PatternLike: [...builtInAliases["PatternLike"], "IdentifierPattern"],
    Expression: [...builtInAliases["Expression"], "IdentifierExpression"],
    Node: ["IdentifierPattern", "IdentifierExpression", ...undeprecated]
};

const aliases = Object.fromEntries(Object
    .entries(expandedAliases)
    .map(([name, aliases]) =>
        [name, union ([name])
            (...aliases.map(name => concrete[name]))]));

module.exports.aliases = aliases;

const typecasts = Object.fromEntries(Object
    .entries(concrete)
    .map(([name, type]) => [name, Object.fromEntries(
        data.fields(type)
            .map(([name, type]) => [name,
                parameterized.is(List, type) ?
                    type :
                parameterized.is(Nullable, type) &&
                parameterized.is(List, union.components(type)[1]) ?
                    type : false]))]));

const builders = Object.fromEntries(Object
    .entries(concrete)
    .map(([name, type, typecast]) =>
        [name, ((keys, typecast) => (...args) =>
            type(Object.fromEntries(args
                .map((value, index) => [keys[index], value])
                .map(([key, value]) =>
                    [key, typecast[key] && value ?
                        typecast[key](value) : value]))))
        (t.BUILDER_KEYS[name], typecasts[name])]));

module.exports.builders = builders;

module.exports.upgrade = function upgrade(node, nested)
{
    if (node === void(0) || node === null)
        return null;

    if (is(aliases.Node, node))
        return node;

    if (Array.isArray(node))
        return node.map(upgrade);//List(aliases.Node)(node.map(upgrade));

    if (node.type === "EmptyStatement")
        return concrete.EmptyStatement;

/*
    if (target.upgrade)
        return target.upgrade(node, nested);

    if (node.type === "Identifier" && nested)
        return concrete.IdentifierExpression(node);
*/

    const target = concrete[node.type];
    const keys = t.VISITOR_KEYS[node.type];
    const pairs = keys.map(key => [key, upgrade(node[key], nested)]);

    return target({ ...node, ...Object.fromEntries(pairs) });
}


module.exports.concrete = concrete;
module.exports.aliases = aliases;


const r = module.exports.upgrade(require("@babel/parser").parseExpression(function testConcurrent2()
{
    const result1 = wrt[a]() + wrt[b]();
    const result2 = wrt[f](result1);
    const result3 = a_function();;;;
    const result4 = result3 || wrt[d]();
    const result5 = result4 ? wrt[e]() : g();

;
;
;
;

    if (wrt[d](result4))
        return wrt[p]();

    if (wrt[d](result4) + 1)
        throw wrt[p]();

    if (wrt[e](result4) + 2)
    {
        const result7 = wrt[u]();

        return result7 + wrt[y]();
    }

    return if_ (result5, () => stuff, () => other_stuff);;

    function a_function()
    {
        return result2;
    }
}
+""));

const generate = node => require("@babel/generator").default(node).code

console.log(require("@babel/generator").default(r).code);


/*console.log(builders);

const b = builders;
const c = concrete;
const a = aliases;
const node = b.FunctionExpression(b.Identifier("name"), [], b.BlockStatement([]));

//c.FunctionExpression({ id: c.Identifier({ name: "name" }), params:List(a.Pattern)(), body:c.BlockStatement({ body: List(a.Statement)() }) });

console.log(c.FunctionExpression);
console.log(node);
console.log(require("@babel/generator").default(node).code);

console.log(b.ArrayExpression([]));*/
