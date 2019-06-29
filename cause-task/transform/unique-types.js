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
        data (name) (type => [string, name], ...fields),
        { aliases, children });

    generators[name] = fNamed(`${name}Generator`, function (node)
    {
        return [].concat(generate(node))
            .map(({ kind, data }) => this[kind](data));
    });
    
    return type;
}

const IdentifierPattern = ASTNode `IdentifierPattern` (
    aliases     => ["Pattern", "LVal", "PatternLike"],
    generate    => ({ name }) => Generated.word(name),
    name        => [string] );


const standard = Object.fromEntries(t.TYPES
    .map(name => [name, t[name]])
    .filter(([name, type]) => !!type && !t.DEPRECATED_KEYS[name]));
const unique = { ...standard, IdentifierPattern };
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



