const Scope = require("./scope");

const ifChanged = (node, changes) =>
    Object.keys(changes).some(field => node[field] !== changes[field]) ?
        { ...node, ...changes } : node;


module.exports = require("@climb/babel-map-accum").fromDefinitions(
{
    Identifier(mapAccumNode, node)
    {
        return [Scope.fromFree(node.name), node];
    },

    VariableDeclarator(mapAccumNode, node)
    {
        const [initScope, init] = mapAccumNode(node.init);
        const [idScope, id] = fromPattern(mapAccumNode, node.id);
        const mapped = ifChanged(node, { init, id });
        const scope = Scope.concat(idScope, initScope);

        return [scope, mapped];
    },

    FunctionDeclaration: fromFunction(false),
    FunctionExpression: fromFunction(true),
    ArrowFunctionExpression: fromFunction(true),
 
    BlockStatement(mapAccumNode, node)
    {
        const [bodyScope, body] = mapAccumNode(node.body);
        const mapped = ifChanged(node, { body });
        const scope = Scope({ free: bodyScope.free });

        return [scope, mapped];
    }
});

function fromFunction(isExpression)
{
    return function (mapAccumNode, node)
    {
        const [bodyScope, body] = mapAccumNode(node.body);
        const [idScope, id] = fromPattern(mapAccumNode, node.id);
        const [parametersScope, nodeWithModifiedParameters] =
            fromArrayFieldPattern(mapAccumNode, node, "params");
        const { free } = [bodyScope, idScope, parametersScope]
            .reduce(Scope.concat, Scope.identity);

        // Function expresses don't expose any bound variables, since even if
        // they have an id, its only visible internally.
        const bound = isExpression ? idScope.bound : Scope.identity.bound;
        const scope = Scope({ bound, free });
        const mapped = ifChanged(nodeWithModifiedParameters, { body, id });

        return [scope, mapped];
    }
}
    
function fromPattern(mapAccumNode, pattern)
{
    if (!pattern)
        return [Scope.identity, pattern];

    const type = pattern.type;

    if (type === "AssignmentPattern")
    {
        const [leftScope, left] = fromPattern(mapAccumNode, pattern);
        const [rightScope, right] = mapAccumNode(pattern);
        const scope = Scope.concat(leftScope, rightScope);
        const mapped = ifChanged(pattern, { left, right });

        return [scope, mapped];
    }

    if (type === "ArrayPattern")
        return fromArrayFieldPattern(mapAccumNode, pattern, "elements");

    if (type === "ObjectPattern")
        return fromArrayFieldPattern(mapAccumNode, pattern, "properties");

    if (type === "ObjectProperty")
    {
        const [keyScope, key] = fromPattern(mapAccumNode, pattern.key);
        const [valueScope, value] = mapAccumNode(pattern.value);
        const mapped = ifChanged(pattern, { key, value });

        return [Scope.concat(keyScope, valueScope), mapped];
    }

    if (type === "RestElement")
    {
        const [scope, argument] = fromPattern(mapAccumNode, pattern.argument);

        return [scope, ifChanged(pattern, { argument })];
    }

    if (type === "Identifier")
        return [Scope.fromBound(pattern.name), pattern];

    throw Error("Unreachable");
}

function fromArrayFieldPattern(mapAccumNode, node, field)
{
    const pairs = node[field].map(child => fromPattern(mapAccumNode, child));
    const scope = pairs.reduce((scope, [childScope]) =>
        Scope.concat(scope, childScope),
        Scope.identity);
    const children = pairs.map(([, child]) => child);
    const modified = node[field]
        .some((original, index) => original !== children[index]);
    const mapped = modified ? { ...node, [field]: children } : node;

    return [scope, mapped];
}
