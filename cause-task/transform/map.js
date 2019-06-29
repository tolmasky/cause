const t = require("@babel/types");
const types = require("./unique-types");
const aliasesForTypes = types.aliases
const aliasIndexesForTypes = Object.fromEntries(Object
    .entries(types.aliases)
    .map(([name, aliases]) =>
        [name, Object.fromEntries(
            aliases.map((alias, index) => [alias, index]))]));

const fail = node =>
    { throw Error(`Ran out of fallback handlers for ${node.type}`); };

module.exports = function treeMap(definitions, node, toUnique = true)
{
    const as = function (as, node)
    {
        if (node === void(0) || node === null)
            return node;

        const type = Array.isArray(node) ? "Array" : node.type;
        const aliases = aliasesForTypes[type];
        const after = aliasIndexesForTypes[type][as || type];
        const index = aliases
            .findIndex((key, index) =>
                index >= after && definitions[key]);

        return index >= 0 ?
            definitions[aliases[index]](map, node) :
            fallback(map, node);
    };
    const children = node => fallback(map, node);
    const map = Object.assign(node => as(void(0), node), { as, children });
    const unique = toUnique ? toUniquelyTyped(treeMap, node) : node;

    return map(unique);
}

const toUniquelyTyped = (function ()
{
    const { IdentifierExpression, IdentifierPattern } =
        require("./unique-types").unique;
    const toPattern = node => t.isIdentifier(node) ?
        IdentifierPattern({ name: node.name }) : node;
    const toPatternKeys = keys => (map, node) =>
        ({ ...node, ...Object.fromEntries(keys
            .map(key => [key, node[key]])
            .map(([key, value]) =>
                [key, Array.isArray(value) ?
                    value.map(toPattern) : toPattern(value)])) });
    const then = (type, f) => (map, node) => map.as(type, f(map, node))

    return function toUniquelyTyped(map, node)
    {
        return map(
        {
            Identifier: (map, { name }) => IdentifierExpression({ name }),
            MemberExpression: (map, expression) => (updated =>
                updated.computed ?
                    updated :
                    { ...updated, property: expression.property })
            (map.as("Node", expression)),
            RestElement: (map, restElement) =>
                ({ ...restElement, argument: toPattern(restElement.argument) }),

            CatchClause: then("Node", toPatternKeys(["param"])),
            Function: then("Node", toPatternKeys(["id", "params"])),
            VariableDeclarator: then("Node", toPatternKeys(["id"])),

            ArrayPattern: then("Node", toPatternKeys(["elements"])),
            ObjectPattern: (map, pattern) => ({ ...pattern,
                properties: pattern.properties
                    .map(property =>
                        ({ ...property, value: toPattern(property.value) }))
                    .map(property => [property.key, map(property)])
                    .map(([key, property]) =>
                        property.computed ? property : { ...property, key }) })
        }, node, false);
    }
})();


function fallback(map, node)
{
    if (Array.isArray(node))
    {
        const updated = node.map(map);
        const changed = updated.some((current, index) => node !== node[index]);

        return changed ? updated : node;
    }

    const fields = types.children[node.type];
    const modified = fields
        .map(field => [field, node[field]])
        .map(([field, node]) => [field, node, node && map(node)])
        .flatMap(([field, previous, updated], index) =>
            previous !== updated ? [[field, updated]] : []);
    const newNode = modified.length === 0 ?
        node :
        modified.reduce((accum, [field, updated]) =>
            (accum[field] = updated, accum), { ...node });
//console.log("OWN SYMBOLS: " + Object.getOwnPropertySymbols(node));
    return newNode;
}
