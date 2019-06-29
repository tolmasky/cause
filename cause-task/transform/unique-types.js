const { is, data, string, fNamed } = require("@algebraic/type");
const t = require("@babel/types");
const generators = require("@babel/generator/lib/generators");


const Generated = data `Generated` (
    data => string,
    kind => string );

["word", "token"]
    .map(kind => Generated[kind] =
        data => Generated({ data, kind }));

const ASTNode = ([name]) => function (fAliases, fGenerate, ...fields)
{
    const aliases = fAliases();
    const generate = fGenerate();
    const children = [];//fields.slice(1).filter(x => )
    const type = Object.assign(
        data ([name]) (type => [string, name], ...fields),
        { aliases, children });

    aliases.map(alias => t.FLIPPED_ALIAS_KEYS[alias].push(name));

    generators[name] = fNamed(`${name}Generator`, function (node)
    {
        return [].concat(generate(node))
            .map(({ kind, data }) => this[kind](data));
    });
    
    return type;
}

const IdentifierExpression = ASTNode `IdentifierExpression` (
    aliases     => ["Expression"],
    generate    => ({ name }) => Generated.word(name),
    name        => [string] );

const IdentifierPattern = ASTNode `IdentifierPattern` (
    aliases     => ["Pattern", "LVal", "PatternLike"],
    generate    => ({ name }) => Generated.word(name),
    name        => [string] );

const expanded = { IdentifierExpression, IdentifierPattern };
const standard = Object.fromEntries(t.TYPES
    .map(name => [name, t[name]])
    .filter(([name, type]) => !!type && !t.DEPRECATED_KEYS[name]));
const unique = { ...standard, IdentifierExpression, IdentifierPattern };
const aliases = Object.fromEntries(
[
    ["Array", ["Array", "Any"]],
    ...Object.keys(unique)
        .map(name => [name,
            t.ALIAS_KEYS[name] || unique[name].aliases])
        .map(([name, keys]) => [name, [name, ...keys, "Node", "Any"]])
]);

module.exports.standard = standard;
module.exports.unique = unique;
module.exports.aliases = aliases;
module.exports.children =
{
    ...t.VISITOR_KEYS,
    ...Object.fromEntries(Object
        .entries(expanded)
        .map(([name, type]) => [name, type.children]))
}
for (const [name, type] of Object.entries(expanded))
    t.VISITOR_KEYS[name] = type.children;

/*
console.log("DOES " + (t.VISITOR_KEYS === require("@babel/types/lib/definitions").VISITOR_KEYS));
t.VISITOR_KEYS = module.exports.children;
require("@babel/types/lib/definitions").VISITOR_KEYS["IdentifierExpression"] = [];
require("@babel/types/lib/definitions").VISITOR_KEYS = module.exports.children;
console.log(require.resolve("@babel/types/lib/definitions"));*/

