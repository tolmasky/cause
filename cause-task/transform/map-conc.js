const { is, type } = require("@algebraic/type");
const fail = require("@algebraic/type/fail");
const map = require("@algebraic/ast/map");
const fromBabel = require("@algebraic/ast/from-babel");
const partition = require("@climb/partition");
const Node = require("@algebraic/ast/node");

const vernacular = name =>
    name.replace(/(?!^)[A-Z](?![A-Z])/g, ch => ` ${ch.toLowerCase()}`);
const forbid = (...names) => Object.fromEntries(names
    .map(name => [name, () => fail.syntax(
        `${vernacular(name)}s are not allowed in concurrent functions.`)]));
const unexpected = node => fail.syntax(
    `${vernacular(node.type)}s are not allowed at this point in concurrent functions.`);


const template = require("./template");
const toComputedProperty = ({ computed, property }) =>
    !computed ?
        Node.StringLiteral({ ...property, value: property.name }) :
        property;
const tδ = ((call, apply) =>
    (callee, ds, args) =>
        is (Node.MemberExpression, callee) ?
            apply(callee.object, toComputedProperty(callee), ds, args) :
            call(callee, ds, args))
    (template((value, ds, args) => δ.call(value, ds, args)),
     template((object, property, ds, args) =>
        δ.apply(object, property, ds, args)))

const t_ds = (...args) => args
    .flatMap((value, index) => value ? [index] : []);
const tMaybeδ = (value, ds) => ds.length > 0 ? tδ(value, ds) : value;

const tδ_depend = template((lifted, ...args) => δ.depend(lifted, args));

const t_thunk = template(expression => () => expression);
const t_defer = expression =>
    t.isCallExpression(expression) &&
    expression.arguments.length === 0 ?
        expression.callee :
        t_thunk(expression);

const tδ_success = template(expression => δ.success(expression));
const tδ_operator = template(name => δ.operators[name]);
const tδ_ternary = tδ_operator("?:");

// at statement level?
module.exports = map(
{
    ...forbid(
        "AssignmentExpression",
        "BreakStatement",
        "ClassDeclaration",
        "ContinueStatement",
        "DoWhileStatement",
        "ForStatement",
        "ForInStatement",
        "ForOfStatement",
        "LabeledStatement",
        "WithStatement",
        "WhileStatement",
        "SwitchStatement"),

    /*

    FunctionExpression(fExpression)
    {
        const fReduced = map.as("Node", node);
        const dependencies = Dependencies.for(fReduced);

        if (dependencies.size <= 0)
            return fReduced;

        return { ...fReduced, body: fromBlockStatement(fReduced.body) };
    },*/

    CallExpression(expression)
    {
        const { callee, arguments: args } = expression;

        if (!isIdentifierExpression("parallel", callee) ||
            args.length !== 1)
            return expression;

        const firstArgument = args[0];

        if (!is (Node.ArrowFunctionExpression, firstArgument) &&
            !is (Node.FunctionExpression, firstArgument))
            return expression;

        if (expression.freeVariables.has("wrt"))
            console.log("YES! --");

        return fromFunction(firstArgument);
    }
});

const isIdentifierExpression = (name, node) =>
    is (Node.IdentifierExpression, node) && node.name === name;

/*
        const ds = expression
            .arguments
            .flatMap((argument, index) => isWRT(argument) ? [index] : []);
        const calleeIsWRT = isWRT(expression.callee);

        if (!calleeIsWRT && ds.length <= 0)
            return expression;

        const args = ds.length > 0 ?
            expression.arguments.map(argument =>
                isWRT(argument) ? argument.property : argument) :
            expression.arguments;
        const updated = ds.length > 0 ?
            tδ(expression.callee, ds, args) :
            expression;

        return updated;

        if (isWRT(callee) || ds.length > 0)
        {console.log("HERE FOR " + require("@babel/generator").default(updated).code);
            const r = ConvertedType.withDependencyNode(updated, convertedType);

            //console.log("I NEED ", ConvertedType.for(r).dependencies.size);

            return r;
        }

        return ConvertedType.with(updated, convertedType);
*/

function fromFunction(functionNode)
{
    const { body } = functionNode;

    if (is (Node.Expression, body))
        throw Error("NEED TO SUPPORT SINGLE EXPRESSION CASE");

    const NodeType = type.of(functionNode);
    const hoisted = hoistFunctionDeclarations(body);
    const compressed = removeEmptyStatements(hoisted);
    const separated = separateVariableDeclarations(compressed);

    return NodeType({ ...functionNode, body: separated });
}

function isWRT(expression)
{console.log(is (Node.ComputedMemberExpression, expression))
    return  is (Node.ComputedMemberExpression, expression) &&
            is (Node.IdentifierExpression, expression.object) &&
            expression.object.name === "wrt";
}
/*
function fromFunction(mapChildren)
{
    const dependencies = Dependencies.for(fReduced);

    if (dependencies.size <= 0)
        return fReduced;

    return { ...fReduced, body: fromBlockStatement(fReduced.body) };
}*/

function fromBlockStatement(block)
{
    const hoisted = hoistFunctionDeclarations(block);
    const compressed = removeEmptyStatements(hoisted);

    return compressed;//fromCascadingIfStatements(compressed);
}

// Terminology: Result statements are either traditional JavaScript return
// statements or throw statements.
//
// Essentially, all JavaScript functions are implicitly Either<Return, Throw>,
// so we allow any block to end with one of these two statements.
const isResultStatement = statement =>
    t.isReturnStatement(statement) || t.isThrowStatement(statement);


function fromCascadingIfStatements(block)
{
    // We want to be in single result form:
    // [declaration-1, declaration-2, ..., declaration-N, result]
    //
    // However, we *allow* intermediate if-gaurded early results, but we
    // do so by transforming it into a single return by wrapping everything
    // after the if-gaurd in an if-function, and return the result of it.
    //
    // Code of the form:
    // [d1, d2, ..., dn, if (test) [s], s1, s2, ..., sN, result]
    //
    // Where:
    // 1. d1, d2, ..., dn are consecutive declarations
    // 2. if (test) [s] is an if statement that ends in a result.
    // 3. s1, s2, ..., sN are either declaration or more if-gaurded early
    //    returns.
    //
    // Becomes:
    // [d1, d2, ..., fIf (test, () => [s], () => [s1, s2, ..., sN, result])]

    // Start by finding the first if-gaurded early return.
    const statements = block.body;
    const firstIf = statements.findIndex(t.isIfStatement);

    // If we have no if statements, it's pretty easy, just handle the
    // declarations and final result.
    if (firstIf === -1)
        return fromDeclarationStatements(statements);

    // If not, then construct the if-function to replace the tail of the
    // statements with:
    const { test, consequent } = statements[firstIf];
    // The consequent is now the body of an arrow function, so it has to be
    // an expression or block statement. We expect to only have declarations
    // and return statements, so the special case of a single return
    // statement can folded into just it's argument.
    const consequentBlock = fromBlockStatement(
        t.isBlockStatement(consequent) ?
            consequent : r.BlockStatement([consequent]));
    const alternateBlock = fromBlockStatement(
        r.BlockStatement(statements.slice(firstIf + 1)));
    const returnIf = r.ReturnStatement(
        fromDeferredOperator(
            tδ_ternary,
            [false, test],
            [true, r.FunctionExpression(null, [], consequentBlock)],
            [true, r.FunctionExpression(null, [], alternateBlock)]));

    // Construct the revised statement list:
    const singleResultForm =
        fix([...statements.slice(0, firstIf), returnIf], true);

    // Apply the same declaration transforms we were already planning to.
    return fromDeclarationStatements(singleResultForm);
}

function fromDeclarationStatements(statements)
{
    // Record every binding introduced by these statements:
    const bindings = statements.flatMap( blah );
    const dependencies = [];
    const independent = unblocked.whatever;
/*    X -> [FLAT_DEPENDENCIES] // etc
    Y -> [FLAT_DEPENDENCIES] // etc
    record everything that is not dependent on blocked dependencies.

    // Start by dividing the statements into those that have concurrent
    // dependencies (blocked) and those that don't (unblocked). The
    // unblocked statements will be usable immediately.
    const [blocked, unblocked] = partition(
        statement => getDependencies(statement).size >= 0,
        statements);

    // Record all the bindings the unblocked statements introduce.


    // The current scope is defined by the bindings introduced by the
    // independent statements.
    const updatedScope = independent.reduce(Scope.concat, scope);

    // The dependencies that are immediately invocable are those that contain
    // only free variables and bindings already instantiated. If the dependency
    // contains an identifier that is not present in either updatedScope's
    // free or bound sets, it means it must still be waiting to be instantiated
    // in a different dependent statement, and must thus wait for it to resolve
    // before being invocable.
    const { free, bound } = updatedScope;
    const isUnblocked = dependency => Scope.for(dependency.node)
        .free.has(variable => !free.has(variable) && !bound.has(variable));
*/

//    const dependencies = Dependencies.for(statements);
    const args = t.Identifier("args");
    const toMember = index =>
        t.MemberExpression(args, t.numericLiteral(index), true);

    const replaced = dependencies
        // Set().reduce unfortunately just duplicates the item twice instead
        // of providing an index.
        .toList()
        .reduce((node, { keyPath }, index) =>
            KeyPath.replace(toMember(index), keyPath, node),
            statements);

    const fExpression = r.ArrowFunctionExpression(
        [t.RestElement(t.Identifier("args"))],
        t.BlockStatement(replaced));

    return r.BlockStatement(
        [t.ReturnStatement(
            tδ_depend(false,
                fExpression,
                ...dependencies.map(({ node }) => node)))]);
}

function removeEmptyStatements(block)
{
    const body = block.body.filter(node => !is(Node.EmptyStatement, node));

    return  body.length !== block.body.length ?
            Node.BlockStatement({ ...block, body }) :
            block;
}

function separateVariableDeclarations(block)
{
    const body = block.body
        .flatMap(statement =>
            !is (Node.BlockVariableDeclaration, statement) ||
            statement.declarators.length <= 1 ?
                statement :(console.log("OK!", statement.declarators.length),
                statement.declarators
                    .map(declarator =>
                        Node.BlockVariableDeclaration
                            ({ ...statement, declarators: [declarator] }))));
    console.log("here...");
    return  body.length !== block.body.length ?
            Node.BlockStatement({ ...block, body }) :
            block;
}

function hoistFunctionDeclarations(block)
{
    // The first step is to hoist all the function declarations to the top.
    // Change them to const declarations to make our lives easier later.
    const statements = block.body;
    const [functionDeclarations, rest] =
        partition(is(Node.FunctionDeclaration), statements);

    if (functionDeclarations.length === 0)
        return block;

    const asVariableDeclarations = functionDeclarations
        .map(functionDeclaration =>
            [functionDeclaration.id,
                Node.FunctionExpression(functionDeclaration)])
        .map(([id, init]) => [Node.VariableDeclarator({ id, init })])
        .map(declarators =>
            Node.BlockVariableDeclaration({ kind: "const", declarators }));
    const body = [...asVariableDeclarations, ...rest];

    return Node.BlockStatement({ ...block, body });
}

function fromDeferredOperator(operator, ...pairs)
{
    const args = pairs.map(([, argument]) => argument);
    const ds = pairs.flatMap(([thunk, argument], index) =>
        thunk && hasDependencies(argument) ? [index] : []);

    return ds.length <= 0 ?
        r.CallExpression(operetor, args) :
        fix(tδ(tδ_ternary, ds, args));
}

function fix(node)
{
    return reduce([Scope, ConvertedType], node);
}

function reduce(M, node)
{
    if (Array.isArray(M))
        return M.reduce((node, M) =>
            reduce(M, node), node);

    if (!node || M.has(node))
        return node;

    const children = Array.isArray(node) ?
        node.map((child, index) => [index, child]) :
        getTraversableFields(node)
            .map(field => [field, node[field]]);

    return M.with(node, children
            .map(([field, child]) =>
                [field, M.for(reduce(M, child))])
            .reduce((accum, [field, child]) =>
                M.concat(accum, child, field),
                M.identity));
}
/*
function fromDeferredOperator(operator, pairs)
{
    const hasDependencies = expression =>
        Dependencies.for(expression).size > 0;

    return function (expression)
    {
        const values = pairs.map(([field, isDeferred], index) =>
            [expression[field], isDeferred, index]);
        const [ds, args] = mapAccum((ds, [value, isDeferred, index]) =>
            isDeferred ?
                [hasDependencies(value) > 0 ?
                    ds.concat(index) : ds, t_thunk(value)] :
                [ds, value]);

        // If none do, then we are in the clear and can just return the
        // expression unchanged.
        if (ds.length <= 0)
            return expression;

        return tδ(tδ_ternary, ds, args);
    }
}

function toThunk(expression

    tδ(tδ_ternary, ds, args);

    if (ds.length <= 0)
    const [ds, args] = mapAccum((ds, [value, isDeferred, index]) =>
        [hasDependencies(value) > 0 ? ds.concat(index) : ds, value]);
    


    const [ds, args] = mapAccum((ds, [value, isDeferred, index]) =>
        [hasDependencies(value) > 0 ? ds.concat(index) : ds, value]);

    return function (expression)
    {
        const values = pairs.map(([field, isDeferred], index) =>
            [expression[field], isDeferred, index]);
        const [ds, args] = mapAccum((ds, [value, isDeferred, index]) =>
            [hasDependencies(value) > 0 ? ds.concat(index) : ds, value]);

        // If none do, then we are in the clear and can just return the
        // expression unchanged.
        if (ds.length <= 0)
            return expression;

        return tδ(tδ_ternary, ds, args);
    }

        const values = pairs
            .map(([field, isDeferred]) => [expression[field], isDeferred])
            .map(([value, isDeferred]) =>
                [isDeferred ? t_thunk(value) : value, isDeferred])
            .map(([value, isDeferred]) =>
                [isDeferred && hasDependencies ? 

        pairs
    
        // Determine which, if any, of the deferred fields actually contains
        // concurrent operations.
        const ds = pairs
            .filter(pair => pair[1])
            .map(([field]) => [field, expression[field]])
            .flatMap(([field, expression], index) => 
                Dependencies.for(argument).size > 0 ? [index] : []);
*/