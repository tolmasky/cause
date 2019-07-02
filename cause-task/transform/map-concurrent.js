const { is, data, union, boolean } = require("@algebraic/type");
const fail = require("@algebraic/type/fail");
const t = require("@babel/types");
const { getTraversableFields } = require("./custom-node");
const map = require("./map");
const Scope = require("./scope");


const vernacular = name =>
    name.replace(/(?!^)[A-Z](?![A-Z])/g, ch => ` ${ch.toLowerCase()}`);
const forbid = (...names) => Object.fromEntries(names
    .map(name => [name, () => fail.syntax(
        `${vernacular(name)}s are not allowed in concurrent functions.`)]));


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
            .map(([field, child]) => ConvertedType.adopt(field + "", ConvertedType.for(child)))
            .reduce((lhs, rhs) =>
                ConvertedType({ dependencies:
                    lhs.dependencies.concat(rhs.dependencies) }),
                ConvertedType.Default);
//        console.log(convertedType.dependencies);
//console.log(scope);
        return ConvertedType.with(withUpdatedChildren, convertedType);
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
        {
            const r = ConvertedType.withDependencyNode(updated, convertedType);

            //console.log("I NEED ", ConvertedType.for(r).dependencies.size);

            return r;
        }

        return ConvertedType.with(updated, convertedType);
    },

    MemberExpression(map, expression)
    {
        const withUpdatedChildren = map.children(expression);
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
