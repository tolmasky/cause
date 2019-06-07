const { string } = require("@algebraic/type");
const { Set } = require("@algebraic/collections");

const t = require("@babel/types");
const Scope = require("./scope");


function fromDeclarations(declarations, returnExpression)
{
    const combinedScope = declarations.reduce((lhs, rhs) =>
        Scope.concat(lhs, rhs[0]), Scope.identity);
    const [dependent, independent] = partition(([scope]) =>
        scope.free.some(variable => combinedScope.bound.has(variable)),
        declarations);
    const nestedExpression = dependent.length === 0 ?
        returnExpression :
        fromDeclarations(dependent, returnExpression);

    if (independent.length === 0)
        return returnExpression;

    return t.CallExpression(
        t.ArrowFunctionExpression(
            independent.map(([, { id }]) => id),
            nestedExpression),
        independent.map(([, { init }]) => init));
}

function partition(f, list)
{
    const filtered = [];
    const rejected = [];
    
    for (const item of list)
        (f(item) ? filtered : rejected).push(item);

    return [filtered, rejected];
}

module.exports = function (f, free)
{
    const { parseExpression } = require("@babel/parser");
    const [scope, transformed] = fromAST(parseExpression(`(${f})`));

    const parameters = Object.keys(free || { });
    const missing = scope.free.subtract(parameters);

    if (missing.size > 0)
        throw Error("Missing values for " + missing.join(", "));

    const { default: generate } = require("@babel/generator");
    const code = `return ${generate(transformed).code}`;
    const args = parameters.map(parameter => free[parameter]);

    return (new Function(...parameters, code))(...args);
}

const fromAST = (function ()
{
    const transformScope = require("./transform-scope");
    const babelMapAccum = require("@climb/babel-map-accum");

    const toLambdaFormEach = babelMapAccum.fromDefinitions(
    {
        BlockStatement(mapAccumNode, node)
        {
            const [[returnPair], declarations] = partition(
                ([, node]) => node.type === "ReturnStatement",
                node.body
                    .flatMap(node => node.type === "VariableDeclaration" ?
                        node.declarations : node)
                    .map(mapAccumNode));
            const scope = declarations.reduce(
                (lhs, rhs) => Scope.concat(lhs, rhs[0]),
                returnPair[0]);
            const fCallExpression =
                fromDeclarations(declarations, returnPair[1].argument);
            const lambdaForm = t.blockStatement(
                [t.returnStatement(fCallExpression)]);
    
            return [scope, lambdaForm];
        }
    }, transformScope);

    return function fromAST(fAST)
    {
        return babelMapAccum(Scope, toLambdaFormEach)(fAST);
    }
})();

module.exports.fromAST = fromAST;


