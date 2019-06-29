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
    const { IdentifierPattern } = require("./unique-types").unique;
    const toPattern = node => t.isIdentifier(node) ?
        IdentifierPattern({ name: node.name }) : node;
    const toPatternProperty = property => property.computed ?
        property : { ...property, value: toPattern(property.value) };
    const toPatternKeys = keys => (map, node) => map.as("Node",
        ({ ...node, ...Object.fromEntries(keys
            .map(key => [key, node[key]])
            .map(([key, value]) =>
                [key, Array.isArray(value) ?
                    value.map(toPattern) : toPattern(value)])) }));

    return function toUniquelyTyped(map, node)
    {
        return map(
        {
            CatchClause: toPatternKeys(["param"]),
            Function: toPatternKeys(["id", "params"]),
            VariableDeclarator: toPatternKeys(["id"]),

            ArrayPattern: toPatternKeys(["elements"]),
            ObjectPattern: (map, { properties, ...rest }) => map.as("Node",
                ({ ...rest, properties: properties.map(toPatternProperty) }))
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

    const fields = toVisitorKeys(node);
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

const toVisitorKeys = (function ()
{
    const fields = t.VISITOR_KEYS;
    const withold = target => field => field !== target;
    const fieldsWitholdingNonReferenceIdentifiers =
    {
        MemberExpression: fields.MemberExpression.filter(withold("property")),
        ObjectProperty: fields.ObjectProperty.filter(withold("key")),
        VariableDeclarator: fields.VariableDeclarator.filter(withold("id"))
    };

    return function toVisitorKeys(node)
    {
        const hasNonReferenceIdentifier =
            t.isVariableDeclarator(node) && t.isIdentifier(node.id) ||
            t.isMemberExpression(node) && !node.computed ||
            t.isObjectProperty(node) && !node.computed;

        return  hasNonReferenceIdentifier ?
                fieldsWitholdingNonReferenceIdentifiers[node.type] :
                fields[node.type] || [];
    }
})();

module.exports.toVisitorKeys = toVisitorKeys;
