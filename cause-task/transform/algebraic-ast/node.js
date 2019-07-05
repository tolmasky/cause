const { data, nullable, union, or, getTypename } = require("@algebraic/type");
const { number, string, boolean } = require("@algebraic/type");
const { OrderedSet, Set } = require("@algebraic/collections");

const t = require("@babel/types");

const undeprecated = require("./babel/undeprecated-types");
const SourceLocation = require("./source-location");
const Comment = require("./comment");
const ESTreeBridge = require("./estree-bridge");
const adjustedFields = require("./adjusted-fields");
const fieldFromBabelDefinition = require("./field-from-babel-definition");


const Node = ([name]) =>
    (...fields) => ESTreeBridge ([name]) (
        ...fields,
        leadingComments     => [nullable(Array), null],
        innerComments       => [nullable(Array), null],
        trailingComments    => [nullable(Array), null],
        start               => [nullable(number), null],
        end                 => [nullable(number), null],
        loc                 => [nullable(SourceLocation), null] );

module.exports = Node;
module.exports.Node = Node;

const IdentifierPattern = Node `IdentifierPattern{ESTree = Identifier}` (
    name        => string,
    bindings    => Set(string));

const IdentifierExpression = Node `IdentifierExpression{ESTree = Identifier}` (
    name => string );

const ObjectPropertyPattern =
    Node `ObjectPropertyPattern {ESTree = ObjectProperty}` (
        key         => or (Node.Expression, Node.Identifier, Node.Literal),
        value       => or (Node.RootPattern, Node.AssignmentPattern),
        computed    => [boolean, false],
        shorthand   => [boolean, false],
        bindings    => Set(string) );

const types = Object.fromEntries(
[
    ...undeprecated.map(name => [name, Node([name])
        (...Object
            .entries(adjustedFields[name])
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
        .toArray(),
    RootPattern: [
        "IdentifierPattern",
        "ArrayPattern",
        "ObjectPattern" ]
}))(t.FLIPPED_ALIAS_KEYS);
const aliases = Object.fromEntries(Object
    .entries(ALIAS_MEMBERS)
    .map(([name, aliases]) =>
        [name, union ([name])
            (...aliases.map(name => types[name]))]));

Object.assign(Node, types, aliases);

// for (const type of Object.values(types))
// {
//     console.log(getTypename(type));
//     console.log(Object.fromEntries(data.fields(type)));
// }
