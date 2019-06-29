const { data, string, fNamed } = require("@algebraic/type");
const fail = require("@algebraic/type/fail");

const Metadata = Symbol("Metadata");
const getMetadata = node =>
    (node && node[Metadata] || knownMetadataForType[name]) ||
    fail.type(`Unrecognized node of type ${node.type}:\n${node}`);
const toIndexMap = ordered => 
    Object.fromEntries(ordered.map((item, index) => [index, item]));
const toMetadata = (aliases, traversableFields) =>
    ({ aliases, aliasIndexes: toIndexMap(aliases), traversableFields});
const knownMetadataForType = (t => Object.fromEntries([
    ["Array", toMetadata(["Array", "Any"], [])],
    ...t.TYPES
        // Filter out "interfaces" and deprecated types.
        .filter(name => t[name] && !t.DEPRECATED_KEYS[name])
        .map(name => [name, toMetadata(
            [name, ...((console.log(name), t.ALIAS_KEYS[name])), "Node", "Any"],
            t.VISITOR_KEYS)]) ]))(require("@babel/types"));


const CustomNode = (function()
{
    const { FLIPPED_ALIAS_KEYS } = require("@babel/types");
    const generators = require("@babel/generator/lib/generators");

    return ([name]) => function (fAliases, fGenerate, ...fields)
    {
        const aliases = [fAliases(), "Node", "Any"];
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

CustomNode.traversableFields = node => getMetadata(node).traversableFields;

CustomNode.findAlias = function findAlias(f, node)
{
    const name = Array.isArray(node) ? "Array" : node.type;
    const { aliases, aliasIndexes } = traversableFields(node);
    const asName = as === OwnConcreteName ? name : as;
    const atLeast = aliasIndexes[asName];
    const index = aliases.findIndex(f);

    return index >= 0 ? aliases[index] : false;
}

const CodeEmission = data `CodeEmission` (
    data => string,
    kind => string );

CodeEmission.emit = Object.fromEntries(
    ["word", "token"].map(kind =>
        [kind, data => CodeEmission({ data, kind })]));

module.exports = CustomNode;
