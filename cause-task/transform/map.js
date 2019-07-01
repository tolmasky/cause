const CustomNode = require("./custom-node");


module.exports = function toMap(definitions)
{
    const as = (alias, node) =>
        findDefinition(definitions, alias, node)(map, node);
    const children = node => fallback(map, node);
    const fromFunctionCurried = f => fromFunction(map, f);
    const map = node => as(false, node);

    return Object.assign(map,
        { as, children, function: fromFunctionCurried });
}

function findDefinition(definitions, alias, node)
{
    if (node === void(0) || node === null)
        return (map, node) => node;

    const atLeast = alias === false ?
        0 : CustomNode.indexOfAlias(alias, node);
    const bestMatch = CustomNode.findAlias(
        (alias, index) =>
            index >= atLeast && definitions[alias],
        node);

    return bestMatch ? definitions[bestMatch] : fallback;
}

const fromFunction = (function ()
{
    const { fNamed } = require("@algebraic/type");
    const { parseExpression } = require("@babel/parser");

    return function mapFunction (map, f, options)
    {
        const fExpression = parseExpression(`(${f})`);
        const name = fExpression.id ? [fExpression.id.name] : [];
        const mapped = map(fExpression);

        if (!options || options.output !== "function")
            return mapped;

        // Need to defer calling this to not invalidate
        // @babel/generator/lib/generators.
        const generate = require("@babel/generator").default;
        const code = `return ${generate(mapped).code}`;

        return (new Function(code))();
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

    const fields = CustomNode.getTraversableFields(node);
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
