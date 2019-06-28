module.exports = map_;

function map_(f, ...rest)
{
    const map = (...args) => f(map, ...args);

    return map(...rest);
}

const t = require("@babel/types");
const aliasesForTypes = Object.fromEntries(
    [["Array", ["Array", "Any"]], ...Object.keys(t)
        .filter(key => key.match(/^[A-Z].*[a-z]$/))
        .map(key => [key, t.ALIAS_KEYS[key] || []])
        .map(([key, keys]) => [key, [key, ...keys, "Node", "Any"]])]);
const aliasIndexesForTypes = Object.fromEntries(Object
    .entries(aliasesForTypes)
    .map(([type, aliases]) => [type,
        Object.fromEntries(aliases.map((alias, index) => [alias, index]))]));

const fail = node =>
    { throw Error(`Ran out of fallback handlers for ${node.type}`); };

module.exports.babel = function babel(definitions, node)
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
//console.log(type + " AS " + as + " " + index + " " + aliases[index]);
        return index >= 0 ?
            definitions[aliases[index]](map, node) :
            fallback(map, node);
    };
    const children = node => fallback(map, node);
    const map = Object.assign(node => as(void(0), node), { as, children });

    return map(node);
}

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
                fields[node.type];
    }
})();

module.exports.toVisitorKeys = toVisitorKeys;
