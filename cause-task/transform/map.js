module.exports = map_;

function map_(f, ...rest)
{
    const map = (...args) => f(map, ...args);

    return map(...rest);
}

const t = require("@babel/types");
const aliasesForTypes = Object.fromEntries(
    ["Array", ...Object.keys(t)]
        .filter(key => key.match(/^[A-Z].*[a-z]$/))
        .map(key => [key, [key, ...(t.ALIAS_KEYS[key] || [])]]));
const fail = node =>
    { throw Error(`Ran out of fallback handlers for ${node.type}`); };

module.exports.babel = function babel(definitions, node)
{
    return map_(function forNode(map, after, node)
    {
        if (node === void(0) || node === null)
            return node;

        const type = Array.isArray(node) ? "Array" : node.type;
        const aliases = aliasesForTypes[type];
        const index = aliases
            .findIndex((key, index) =>
                index > after && definitions[key]);

        return index >= 0 ?
            definitions[aliases[index]](next =>
                map(node === next ? index : -1, next),
                node) :
            fallback(next =>
                node === next ? fail(next) : map(-1, next), node);
    }, -1, node);
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

    return newNode;
}

const toVisitorKeys = (function ()
{
    const fields = t.VISITOR_KEYS;
    const withold = target => field => field !== target;
    const fieldsWitholdingComputed = 
    {
        MemberExpression: fields.MemberExpression.filter(withold("property")),
        ObjectProperty: fields.ObjectProperty.filter(withold("key"))
    };

    return function toVisitorKeys({ type, computed })
    {
        return  type !== "MemberExpression" &&
                type !== "ObjectProperty" ||
                computed === true ?
                fields[type] :
                fieldsWitholdingComputed[type];
    }
})();
