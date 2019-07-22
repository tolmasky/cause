const { data, number, union, string, is, type } = require("@algebraic/type");
const fail = require("@algebraic/type/fail");
const map = require("@algebraic/ast/map");
const fromBabel = require("@algebraic/ast/from-babel");
const partition = require("@climb/partition");
const Node = require("@algebraic/ast/node");
const { List, Map, Set } = require("@algebraic/collections");
const StringSet = Set(string);
const { KeyPath, KeyPathsByName } = require("@algebraic/ast/key-path");
const DenseIntSet = require("./dense-int-set");
const reachability = require("./dfs-reachability");

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

const ConcurrentSource = data `ConcurrentSource` (
    name                    => string,
    expression              => Node.Expression,
    ([blockBindingNames])   => [KeyPathsByName,
                                name => KeyPathsByName.just(name)],
    ([freeVariables])       => [KeyPathsByName,
                                expression => expression.freeVariables]);

const ConcurrentNode = union `ConcurrentNode` (
    Node.BlockVariableDeclaration,
    Node.ExpressionStatement,
    Node.ReturnStatement,
    Node.ThrowStatement,
    Node.TryStatement,
    ConcurrentSource );

const DependentNode = data  `DependentNode` (
    id              => number,
    node            => ConcurrentNode,
    dependencies    => Array );

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
        .flatMap(liftParallelExpression);
        
    const dependentNodes = toDependentNodes(liftedStatements);

    _(dependentNodes, DenseIntSet.Empty);

console.log(dependentNodes.map(({ dependencies }) => DenseIntSet.toArray(dependencies)));

    const trivialStatements = liftedStatements
        .map(statement =>
            is (ConcurrentSource, statement) ?
                toVariableDeclaration(statement) :
                statement);

    const updatedBody = Node.BlockStatement({ ...body, body: trivialStatements });
    const NodeType = type.of(functionNode);

    return NodeType({ ...functionNode, body: updatedBody });
}

//    const blockBindingNames =
//    const statements = fromStatements(functionNode.bindingNames, body.body);
//    console.log(statements);

function _(indexes, elements, available)
{
    const [unblocked, blocked] = partition(element =>
        DenseIntSet.isEmpty(
        DenseIntSet.subtract(element.dependencies, available)),
        elements);

    const [sources, nonSources] =
        partition(element => is(ConcurrentSource, element.element), unblocked);

//    return [...statements];

    console.log(sources.map(({ element }) => element));
}


function toDependentNodes(nodes)
{
    // Separate out the concurrent sources from the rest. Ultimately it is only
    // the concurrent source "dependencies" that will matter to us.
    const [sources, nonSources] = partition(is(ConcurrentSource), nodes);

    // We "sort" by just putting concurrent sources first. This is because we
    // want them to have contiguous IDs (indexes) so that they can fit in as few
    // slots of a DenseIntSet as possible once we remove all the non-source
    // elements. Otherwise, we could have a bunch of empty slots for no reason.
    const sorted = [...sources, ...nonSources];

    // Create a mapping from each element to it's associated sorted index.
    const indexes = Map(ConcurrentNode, number)
        (sorted.map((node, index) => [node, index]));

    // We create a mapping from the binding names exposed by an element to that
    // element. So, a statement like:
    //
    // "const {a,b} = x;"
    //
    // will generate two entries:
    //
    // ["a", "const {a,b} = x;"] and ["b", "const {a,b} = x;"].
    //
    // We can have many binding names pointing to the same element, but we
    // assume the opposite isn't possible since it is a syntax error to redclare
    // a const, and we treat function declarations as consts in concurrent
    // contexts.
    const declarations = Map(string, ConcurrentNode)(sorted
        .map(node =>
            [node, node.blockBindingNames.keySeq()])
        .flatMap(([node, names]) =>
            names.map(name => [name, node]).toArray()));

    // We create a "map" (since the keys are contiguous indexes we just use an
    // array) of all the direct dependencies. This is otherwise known as an
    // adjacency list: a list of all the nodes this node is connected to.
    // 
    // We compute this for each statement by finding the originating declaration
    // for each free variable in the statement. If the free variable has no free
    // originating declaration, then it is a "true free variable" in the sense
    // that that it is defined outside this block, and so we just ignore it
    // since we can essentially treat it as a constant as it won't affect any of
    // our other calculations at all.
    const directDependencies = sorted
        .map(statement => statement
            .freeVariables.keySeq()
            .map(name => declarations.get(name))
            .filter(declaration => !!declaration)
            .map(declaration => indexes.get(declaration)))
        .map(DenseIntSet.from);

    // Now we can calculate *all* the dependencies (including the indirect
    // dependencies) by doing a Depth-First Reachability Search.
    const allDependencies = reachability(directDependencies);

    // This list actually has more information than we are interested in
    // however. We only really care about the reachability to concurrent
    // statements. Otherwise mutually valid recursive declarations would break
    // as they would endlessly wait for eachother. So we'll go ahead and remove
    // all the non-concurrent indexes from our reachability (dependencies)
    // lists.
    const nonSourcesSet = DenseIntSet
        .from(Array.from(nonSources,
            (_, index) => index + sources.length));

    // Additionally, this list also always lists a statement as reachable from
    // itself. Instead of having to remember this later, we'll also go ahead and
    // remove it now.
    const concurrentDependencies = allDependencies
        .map((set, index) => DenseIntSet.subtract(
            DenseIntSet.subtract(set, nonSourcesSet),
            DenseIntSet.just(index)));

    return nodes
        .map(node => [node, indexes.get(node)])
        .map(([node, id]) => [node, id, concurrentDependencies[id]])
        .map(([node, id, dependencies]) =>
            DependentNode({ id, node, dependencies }));
}


//[statements] Map(Statement, Dependencies)
/*
a = b,c;
b = a,d;
c = e;


[b,c].map(..., )*/
/*
function (knownDependencies, statement, declaringStatements, independentVariables)
{

    function getDependencies(knownDependencies, statement)
    {
        if (knownDependencies.has(statement))
            return [knownDependencies, knownDependencies.get(statement)];

        const directDependencies = 
        knownDependencies.set(statement,
            statement
                .freeVariables.keySeq().toSet()
                .subtract(independentVariables)
                .reduce((knownDependencies, name) =>
                    getDependencies(knownDependencies,
                        declaringStatements.get(name)),
                    knownDependencies);
    }
    




    const directDependencies.reduce((knownDependencies, name) =>
        getDependencies(
            knownDependencies,
            declaringStatements,
            declaringStatements.get(name),
            
            independentVariables),
             , knownDependencies);

    const directDependencies = directDependencies.get(statement);
    const 
    dependencies.get(statement).concat(
}
*/

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
            return [ConcurrentSource({ name: id.name, expression })];
    }

    const trueCallee = parent.callee.property;
    const trueCallExpression =
        Node.CallExpression({ ...parent, callee: trueCallee });

    const name = "MADE_UP_" + (global_num++);
    const argument =
        ConcurrentSource({ name, expression: trueCallExpression });
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
