const { is, data, union, boolean } = require("@algebraic/type");
const fail = require("@algebraic/type/fail");
const t = require("@babel/types");
const { getTraversableFields } = require("./custom-node");
const map = require("./map");
const Scope = require("./scope");
const mapAccum = require("@climb/map-accum");
const { IdentifierExpression, IdentifierPattern } = require("./disambiguate-identifiers");
const partition = require("@climb/partition");


const vernacular = name =>
    name.replace(/(?!^)[A-Z](?![A-Z])/g, ch => ` ${ch.toLowerCase()}`);
const forbid = (...names) => Object.fromEntries(names
    .map(name => [name, () => fail.syntax(
        `${vernacular(name)}s are not allowed in concurrent functions.`)]));
const unexpected = node => fail.syntax(
    `${vernacular(node.type)}s are not allowed at this point in concurrent functions.`);


const template = require("./template");
const toComputedProperty = expression => !expression.computed ?
    t.stringLiteral(expression.property.name) : expression.property;
const tδ = ((call, apply) =>
    (callee, ds, args) =>
        t.isMemberExpression(callee) ?
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


const { string } = require("@algebraic/type");
const { Set } = require("@algebraic/collections");
const ConvertedTypeSymbol = Symbol("ConvertedType");
const ConvertedType = data `ConvertedType` (
    wrt             => [boolean, false],
    dependencies    => [Set(Dependency), Set(Dependency)()],
);

ConvertedType.withDependencyNode = node =>
    ConvertedType.with(node,
        { dependencies: Set(Dependency)([Dependency({ node })]) });

const KeyPath = union `KeyPath` (
    data `Root` (),
    data `Parent` (
        key     => string,
        child   => [KeyPath, KeyPath.Root] ) );

const Dependencies =
{
    with: statement => ConvertedType.for(statement).dependencies,
    for: (statement, dependencies) => ConvertedType.with(statement, { dependencies })
};

KeyPath.Root.prototype[Symbol.iterator] =
KeyPath.Parent.prototype[Symbol.iterator] = function * ()
{
    var iterator = this;

    while (!is(KeyPath.Root, iterator))
    {
        yield JSON.stringify(iterator.key);
        iterator = iterator.child;
    }
}

KeyPath.Root.prototype.toString =
KeyPath.Parent.prototype.toString = function ()
{
    return `[${Array.from(this).join(", ")}]`;
}

KeyPath.replace = function (replacement, keyPath, node)
{
    return is(KeyPath.Root, keyPath) ?
        replacement :
        Object.assign(Array.isArray(node) ?
            [...node] : { ...node },
            { [keyPath.key]: KeyPath.replace(
                replacement, keyPath.child, node[keyPath.key]) });
}

const Dependency = data `Dependency` (
    node    => Object,
    keyPath => [KeyPath, KeyPath.Root] );

Dependency.adopt = key =>
    ({ node, keyPath: child }) =>
        Dependency({ node, keyPath: KeyPath.Parent({ key, child }) });

ConvertedType.adopt = (key, { wrt, dependencies }) => {
//console.log(dependencies);
    return ConvertedType({ wrt, dependencies:
        dependencies.map(Dependency.adopt(key)) });
}
ConvertedType.Default = ConvertedType({ });

ConvertedType.for = node =>
    node && node[ConvertedTypeSymbol] || ConvertedType.Default;
ConvertedType.with = (node, fields) =>
    (node[ConvertedTypeSymbol] = ConvertedType(fields), node);



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

    Any(map, node)
    {
        const withUpdatedChildren = map.children(node);
        const children = Array.isArray(node) ?
            withUpdatedChildren
                .map((child, index) => [index, child]) :
            getTraversableFields(node)
                .map(field => [field, withUpdatedChildren[field]]);
//console.log(children);
        const convertedType = children
            .map(([field, child]) =>
                ConvertedType.adopt(field + "", ConvertedType.for(child)))
            .reduce((lhs, rhs) =>
                ConvertedType({ dependencies:
                    lhs.dependencies.concat(rhs.dependencies) }),
                ConvertedType.Default);
//        console.log(convertedType.dependencies);
//console.log(scope);
        return ConvertedType.with(withUpdatedChildren, convertedType);
    },

    BlockStatement(map, statement)
    {
        const up = fromCascadingIfStatements(removeEmptyStatements(hoistFunctionDeclarations(map.as("Node", statement))));
        const { dependencies } = ConvertedType.for(up);

        if (dependencies.size <= 0)
            return up;

        const args = t.Identifier("args");
        const toMember = index =>
            t.MemberExpression(args, t.numericLiteral(index), true);

        const replaced = dependencies
            // Set().reduce unfortunately just duplicates the item twice instead
            // of providing an index.
            .toList()
            .reduce((node, { keyPath }, index) =>
                KeyPath.replace(toMember(index), keyPath, node),
                up);

        const fExpression = t.ArrowFunctionExpression(
            [t.RestElement(t.Identifier("args"))],
            replaced);

        return t.BlockStatement(
            [t.ReturnStatement(
                tδ_depend(false,
                    fExpression,
                    ...dependencies.map(({ node }) => node)))]);
    },

    CallExpression(map, expression)
    {
        const withUpdatedChildren = map.as("Any", expression);
        const { callee, arguments: args } = withUpdatedChildren;
        const ds = args
            .flatMap((argument, index) =>
                ConvertedType.for(argument).wrt ? [index] : []);
        const updated = ds.length > 0 ?
            tδ(callee, ds, args) :
            t.CallExpression(callee, args);
        const convertedType = ConvertedType.for(withUpdatedChildren);

        if (ConvertedType.for(callee).wrt || ds.length > 0)
        {console.log("HERE FOR " + require("@babel/generator").default(updated).code);
            const r = ConvertedType.withDependencyNode(updated, convertedType);

            //console.log("I NEED ", ConvertedType.for(r).dependencies.size);

            return r;
        }

        return ConvertedType.with(updated, convertedType);
    },

    MemberExpression(map, expression)
    {
        const withUpdatedChildren = map.as("Node", expression);
        const { computed, object, property } = withUpdatedChildren;
        const isWRT = computed &&
            object.type === "IdentifierExpression" &&
            object.name === "wrt";

        return isWRT ?
            ConvertedType.with(property, { wrt: true }) :
            withUpdatedChildren;
    }
});

module.exports.getConvertedType = ConvertedType.for;

// Terminology: Result statements are either traditional JavaScript return
// statements or throw statements.
//
// Essentially, all JavaScript functions are implicitly Either<Return, Throw>,
// so we allow any block to end with one of these two statements.
const isResultStatement = statement =>
    t.isReturnStatement(statement) || t.isThrowStatement(statement);
const tReturnIf =
    (tReturnIf => (...args) => t.ReturnStatement(tReturnIf(...args)))
    (template((test, consequent, alternate) =>
        test ? (() => consequent)() : (() => alternate)()));

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
    const { test, consequent: consequentStatement } = statements[firstIf];
    // The consequent is now the body of an arrow function, so it has to be
    // an expression or block statement. We expect to only have declarations
    // and return statements, so the special case of a single return
    // statement can folded into just it's argument.
    const consequent =
        t.isReturnStatement(consequentStatement) ?
            consequentStatement.argument :
        t.isBlockStatement(consequentStatement) ||
        t.isThrowStatement(consequentStatement) ?
            consequentStatement :
            unexpected(consequentStatement);

    const alternate = t.BlockStatement(statements.slice(firstIf + 1));
    const returnIf = tReturnIf(test, consequent, alternate);

    // Construct the revised statement list:
    const singleResultForm = [...statements.slice(0, firstIf), returnIf];

    // Apply the same declaration transforms we were already planning to.
    return fromDeclarationStatements(singleResultForm);
}

function fromDeclarationStatements(statements)
{
    return t.BlockStatement(statements);
}

function removeEmptyStatements(block)
{
    return t.BlockStatement(block
        .body.filter(statement => !t.isEmptyStatement(statement)));
}

function hoistFunctionDeclarations(block)
{
    // The first step is to hoist all the function declarations to the top.
    // Change them to const declarations to make our lives easier later.
    const statements = block.body;
    const [functionDeclarations, rest] =
        partition(t.isFunctionDeclaration, statements);
    const asVariableDeclarations = functionDeclarations
        .map(functionDeclaration =>
            [functionDeclaration.id.name, functionDeclaration])
        .map(([name, functionDeclaration]) =>
        [
            Scope.with(IdentifierPattern({ name }), Scope.fromBound(name)),
            toFunctionExpression(functionDeclaration)
        ])
        .map(([id, functionDeclaration]) =>
            t.VariableDeclaration("const",
                [t.VariableDeclarator(id, functionDeclaration)]));
    const hoisted = Scope.with(
        [...asVariableDeclarations, ...rest], Scope.for(statements));

    return Scope.with(t.BlockStatement(hoisted), Scope.for(block));
}

// We have to do this tricky id business to avoid FunctionExpression getting
// angry that we are passing an IdentifierPattern instead of an
// IdentifierExpression as id.
function toFunctionExpression({ id, params, body, generator, async })
{
    return Object.assign(
        t.FunctionExpression(null, params, body, generator, async),
        { id });
}

