const { data, string, is, type } = require("@algebraic/type");
const fail = require("@algebraic/type/fail");
const map = require("@algebraic/ast/map");
const fromBabel = require("@algebraic/ast/from-babel");
const partition = require("@climb/partition");
const Node = require("@algebraic/ast/node");
const { List, Set } = require("@algebraic/collections");
const StringSet = Set(string);
const KeyPath = require("@algebraic/ast/key-path");

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
//const tδ_operator = template(name => δ.operators[name]);
//const tδ_ternary = tδ_operator("?:");

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

function getFreeVariableNames(statement)
{
    return StringSet(statement.freeVariables.keys());
}

const BlockingArgument = data `BlockingArgument` (
    name                    => string,
    expression              => Node.Expression );

const toVariableDeclaration = ({ name, expression: init }) =>
    Node.BlockVariableDeclaration(
    {
        kind: "const",
        declarators: [Node.VariableDeclarator
            ({ id: Node.IdentifierPattern({ name }), init })]
    });

const pipe = (...fs) => value => fs.reduce((value, f) => f(value), value);

function fromFunction(functionNode)
{
    const { body } = functionNode;

    if (is (Node.Expression, body))
        throw Error("NEED TO SUPPORT SINGLE EXPRESSION CASE");

    const normalizedStatements = pipe(
        hoistFunctionDeclarations,
        removeEmptyStatements,
        separateVariableDeclarations)(body.body);
    const liftedStatements = normalizedStatements
        .flatMap(liftParallelExpression)
        .map(statement =>
            is (BlockingArgument, statement) ?
                toVariableDeclaration(statement) :
                statement);

    const updatedBody = Node.BlockStatement({ ...body, body: liftedStatements });
    const NodeType = type.of(functionNode);

    return NodeType({ ...functionNode, body: updatedBody });
}

//    const blockBindingNames =
//    const statements = fromStatements(functionNode.bindingNames, body.body);
//    console.log(statements);



var global_num = 0;
function liftParallelExpression(statement)
{
    const keyPaths = statement.freeVariables.get("wrt", List(KeyPath)());

    if (keyPaths.size <= 0)
        return [statement];

    const keyPath = keyPaths.reduce((longest, keyPath) =>
        longest.length > keyPath.length ? longest : keyPath, KeyPath.Root);
    const [parent, trueCalleeKeyPath] = KeyPath.getJust(-2, keyPath, statement);

    if (!is (Node.CallExpression, parent)  ||
        trueCalleeKeyPath.length !== 2 ||
        trueCalleeKeyPath.key !== "callee" ||
        trueCalleeKeyPath.child.key !== "object")
        return fail("wrt[] can only appear in function calls.");

    if (!is (Node.ComputedMemberExpression, parent.callee))
        return fail("wrt[] expressions must be of the form wrt[expression]");

    if (is (Node.BlockVariableDeclaration, statement))
    {
        const [declarator] = statement.declarators;
        const { id, init: expression } = declarator;

        if (is (Node.IdentifierPattern, id) && expression === parent)
            return [BlockingArgument({ name: id.name, expression })];
    }

    const trueCallee = parent.callee.property;
    const trueCallExpression =
        Node.CallExpression({ ...parent, callee: trueCallee });

    const name = "MADE_UP_" + (global_num++);
    const argument =
        BlockingArgument({ name, expression: trueCallExpression });
    const variable = Node.IdentifierExpression({ name });
    const replaced = KeyPath.setJust(-2, keyPath, variable, statement);

    return [argument, ...liftParallelExpression(replaced)];
}

function removeEmptyStatements(statements)
{
    const updated = statements.filter(node => !is(Node.EmptyStatement, node));

    return  updated.length !== statements.length ?
            updated :
            statements;
}

function separateVariableDeclarations(statements)
{
    const updated = statements
        .flatMap(statement =>
            !is (Node.BlockVariableDeclaration, statement) ||
            statement.declarators.length <= 1 ?
                statement :
                statement.declarators
                    .map(declarator =>
                        Node.BlockVariableDeclaration
                            ({ ...statement, declarators: [declarator] })));

    return  updated.length !== statements.length ?
            updated :
            statements;
}

function hoistFunctionDeclarations(statements)
{
    // The first step is to hoist all the function declarations to the top.
    // Change them to const declarations to make our lives easier later.
    const [functionDeclarations, rest] =
        partition(is(Node.FunctionDeclaration), statements);

    if (functionDeclarations.length === 0)
        return statements;

    const asVariableDeclarations = functionDeclarations
        .map(functionDeclaration =>
            [functionDeclaration.id,
                Node.FunctionExpression(functionDeclaration)])
        .map(([id, init]) => [Node.VariableDeclarator({ id, init })])
        .map(declarators =>
            Node.BlockVariableDeclaration({ kind: "const", declarators }));

    return [...asVariableDeclarations, ...rest];
}
