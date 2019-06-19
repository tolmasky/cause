const { string } = require("@algebraic/type");
const { Set } = require("@algebraic/collections");

const t = require("@babel/types");
const Scope = require("./scope");
const fail = error => { throw SyntaxError(error); };


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

const fromIfStatements = (function ()
{
    const template = require("@babel/template").default;
    const toReturnIf = template(
        `return (%%test%% ? ` +
        `(() => %%consequent%%)() : ` +
        `(() => %%alternate%%)())`);

//        `return ((t, c, a) => t ? c() : a())` +
//        `(%%test%%, () => %%consequent%%, () => %%alternate%%)`);

    return function fromIfStatements(mapAccum, statements)
    {
        // We want to be in single return form:
        // [declaration-1, declaration-2, ..., declaration-n, return]
        //
        // However, we *allow* intermediate if-gaurded early returns, but we
        // do so by transforming it into a single return by wrapping everything
        // after the if-gaurd in an if-function, and return the result of it.
        //
        // Code of the form:
        // [d1, d2, ..., dn, if (test) [s], s1, s2, ..., sn, return]
        //
        // Where:
        // 1. d1, d2, ..., dn are consecutive declarations
        // 2. if (test) [s] is an if statement that ends in a return.
        // 3. s1, s2, ..., sn are either declaration or more if-gaurded early
        //    returns.
        //
        // Becomes:
        // [d1, d2, ..., fIf (test, () => [s], () => [s1, s2, ..., sn, return])]

        // Start by finding the first if-gaurded early return.
        const firstIf = statements.findIndex(t.isIfStatement);

        // If we have no if statements, it's pretty easy, just handle the
        // declarations and final return.
        if (firstIf === -1)
            return fromDeclarationStatements(mapAccum, statements);

        // If not, then construct the if-function to replace the tail of the
        // statements with:
        const { test, consequent: consequentStatement } = statements[firstIf];
        // The consequent is now the body of an arrow function, so it has to be
        // an expression or block statement. We expect to only have declarations
        // and return statements, so the special case of a single return
        // statement can folded into just it's argument.
        const consequent =
            t.isReturnStatement(consequentStatement) ?
                consequentStatement.argument :
            t.isBlockStatement(consequentStatement) ?
                consequentStatement :
                fail("Only const declarations and return statements allowed.");

        const alternate = t.blockStatement(statements.slice(firstIf + 1));
        const returnIf = toReturnIf({ test, consequent, alternate });

        // Construct the revised statement list:
        const singleReturnForm = [...statements.slice(0, firstIf), returnIf];

        // Apply the same declaration transforms we were already planning to.
        return fromDeclarationStatements(mapAccum, singleReturnForm);
    }
})();

function fromDeclarationStatements(mapAccum, statements)
{
    // Now we only need to handle the declarations.
    const [[returnPair], declarations] = partition(
        ([, node]) => node.type === "ReturnStatement",
        statements
            .flatMap(node => node.type === "VariableDeclaration" ?
                node.declarations : node)
            .map(mapAccum));
    const scope = declarations.reduce(
        (lhs, rhs) => Scope.concat(lhs, rhs[0]),
        returnPair[0]);
    const fCallExpression =
        fromDeclarations(declarations, returnPair[1].argument);

    return [scope, [t.returnStatement(fCallExpression)]];
}

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

const fromAST = (function ()
{
    const transformScope = require("./transform-scope");
    const babelMapAccum = require("@climb/babel-map-accum");

    const toLambdaFormEach = babelMapAccum.fromDefinitions(
    {
        BlockStatement(mapAccum, node)
        {
            const [scope, statements] =
                fromIfStatements(mapAccum, node.body);

            return [scope, t.BlockStatement(statements)];
        }
    }, transformScope);

    return function fromAST(fAST)
    {
        return babelMapAccum(Scope, toLambdaFormEach)(fAST);
    }
})();

module.exports.fromAST = fromAST;
