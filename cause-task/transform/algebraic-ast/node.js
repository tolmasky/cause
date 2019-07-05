const { data, number, string, nullable, union, getTypename } = require("@algebraic/type");
const { OrderedSet } = require("@algebraic/collections");

const SourceLocation = require("./source-location");
const Comment = require("./comment");
const ESTreeBridge = require("./estree-bridge");


const Node = ([name]) =>
    (...fields) => ESTreeBridge ([name]) (
        ...fields,
        leadingComments => [nullable(Array), null],
        innerComments   => [nullable(Array), null],
        trailingComment => [nullable(Array), null],
        start           => [nullable(number), null],
        end             => [nullable(number), null],
        loc             => [nullable(SourceLocation), null] );

module.exports = Node;
module.exports.Node = Node;

const t = require("@babel/types");
const undeprecated = t
    .TYPES
    .filter(name => t[name] && !t.DEPRECATED_KEYS[name]);

const IdentifierPattern = Node `IdentifierPattern{ESTree = Identifier}` (
    name => string );

const IdentifierExpression = Node `IdentifierExpression{ESTree = Identifier}` (
    name => string );
/*
const or = require("@algebraic/type").parameterized((...Ts) =>
    Ts.length === 1 ?
        Ts[0] :
        union `or <${Ts.map(getTypename)}>` (...Ts));*/
const ObjectPropertyPattern =
    Node `ObjectPropertyPattern {ESTree = ObjectProperty}` (
        key         => Node.Expression,
        value       => Node.Pattern,
        computed    => [boolean, false],
        shorthand   => [boolean, false]
    );

const fieldFromBabelDefinition = require("./field-from-babel-definition");
const types = Object.fromEntries(
[
    ...undeprecated.map(name => [name, Node([name])
        (...Object
            .entries(t.NODE_FIELDS[name])
            .map(([name, definition]) =>
                fieldFromBabelDefinition(Node, name, definition)))]),
    ...[IdentifierPattern, ObjectPropertyPattern, IdentifierExpression]
        .map(type => [getTypename(type), type]),
]);

const ALIAS_MEMBERS = (({ PatternLike, LVal, Expression, Pattern, ...rest }) =>
({
    ...rest,

    Node: [
        "IdentifierPattern",
        "IdentifierExpression",
        "ObjectPropertyPattern",
        ...undeprecated],

    Expression: OrderedSet(string)(Expression)
        .remove("Identifier")
        .concat(["IdentifierExpression"])
        .toArray(),
    LVal: OrderedSet(string)(LVal)
        .remove("Identifier")
        .concat(["IdentifierPattern", "IdentifierExpression"])
        .toArray(),
    Pattern: OrderedSet(string)(Pattern)
        .concat([
            "IdentifierPattern",
            "ObjectPropertyPattern",
            "RestElement"])
        .toArray()
}))(t.FLIPPED_ALIAS_KEYS);
const aliases = Object.fromEntries(Object
    .entries(ALIAS_MEMBERS)
    .map(([name, aliases]) =>
        [name, union ([name])
            (...aliases.map(name => types[name]))]));

Object.assign(Node, types, aliases);
