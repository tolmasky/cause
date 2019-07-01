const { type, data, string, fNamed } = require("@algebraic/type");
const fail = require("@algebraic/type/fail");

const Metadata = Symbol("Metadata");
const getBuiltInType = node => Array.isArray(node) ? "Array" : node.type;
const getMetadata = node =>
    !node && fail.type(`Unrecognized node of ${node}`) ||
    type.of(node)[Metadata] || builtInMetadatas[getBuiltInType(node)] ||
    fail.type(`Unrecognized node of type ${node.type}:\n${node}`);
const toIndexMap = ordered => 
    Object.fromEntries(ordered.map((item, index) => [item, index]));
const toMetadata = (aliases, traversableFields) =>
    ({ aliases, aliasIndexes: toIndexMap(aliases), traversableFields});
const builtInMetadatas = (t => Object.fromEntries([
    ["Array", toMetadata(["Array", "Any"], [])],
    ...t.TYPES
        // Filter out "interfaces" and deprecated types.
        .filter(name => t[name] && !t.DEPRECATED_KEYS[name])
        .map(name => [name, toMetadata(
            [name, ...t.ALIAS_KEYS[name], "Node", "Any"],
            t.VISITOR_KEYS[name])]) ]))(require("@babel/types"));


const CustomNode = (function()
{
    const { FLIPPED_ALIAS_KEYS } = require("@babel/types");
    const generators = require("@babel/generator/lib/generators");

    return ([name]) => function (fAliases, fGenerate, ...fields)
    {
        const aliases = [name, ...fAliases(), "Node", "Any"];
        const type = data ([name]) (type => [string, name], ...fields);

        // Unfortunately we have to add this here or ___.
        aliases
            .map(alias => FLIPPED_ALIAS_KEYS[alias])
            .map(aliases => aliases && aliases.push(name));
    
        // This seems to be the only way to be able to reasonably generate code
        // for custom nodes.
        const generate = fGenerate();
        // This *has* to be a non-arrow function because we need acces to
        // "this".
        generators[name] = fNamed(`${name}Generator`, function (node)
        {
            return []
                .concat(generate(CodeEmission.emit, node))
                .map(({ kind, data }) => this[kind](data));
        });

        return Object.assign(type, { [Metadata]: toMetadata(aliases, []) });
    }
})();

CustomNode.getTraversableFields = node => getMetadata(node).traversableFields;

CustomNode.findAlias = function findAlias(f, node)
{
    const { aliases } = getMetadata(node);
    const index = aliases.findIndex(f);

    return index >= 0 ? aliases[index] : false;
}

CustomNode.indexOfAlias = (alias, node) =>
    getMetadata(node).aliasIndexes[alias];


const CodeEmission = data `CodeEmission` (
    data => string,
    kind => string );

CodeEmission.emit = Object.fromEntries(
    ["word", "token"].map(kind =>
        [kind, data => CodeEmission({ data, kind })]));

module.exports = CustomNode;
