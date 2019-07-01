const { data, boolean } = require("@algebraic/type");
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


const ConvertedTypeSymbol = Symbol("ConvertedType");
const ConvertedType = data `ConvertedType` (
    wrt => [boolean, false]
);
ConvertedType.Default = ConvertedType({ });

ConvertedType.for = node =>
    node[ConvertedTypeSymbol] || ConvertedType.Default;
ConvertedType.with = (node, fields) =>
    (node[ConvertedTypeSymbol] = ConvertedType(fields), node);


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

        return ConvertedType.with(updated, convertedType);
    },

    MemberExpression(map, expression)
    {
        const withUpdatedChildren = map.as("Expression", expression);
        const { computed, object, property } = withUpdatedChildren;
        const isWRT = computed &&
            object.type === "IdentifierExpression" &&
            object.name === "wrt";

        return isWRT ?
            ConvertedType.with(property, { wrt: true }) :
            withUpdatedChildren;
    }
});
