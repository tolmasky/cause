const { string } = require("@algebraic/type");
const CustomNode = require("./custom-node");
const t = require("@babel/types");
const map = require("./map");

const toPattern = node => t.isIdentifier(node) ?
    IdentifierPattern({ name: node.name }) : node;
const toPatternKeys = keys => (map, node) =>
    ({ ...node, ...Object.fromEntries(keys
        .map(key => [key, node[key]])
        .map(([key, value]) =>
            [key, Array.isArray(value) ?
                value.map(toPattern) : toPattern(value)])) });
const then = (type, f) => (map, node) => map.as(type, f(map, node));

module.exports = map(
{
    Identifier: (map, { name }) => IdentifierExpression({ name }),
    MemberExpression: (map, expression) => (updated =>
        updated.computed ?
            updated :
            { ...updated, property: expression.property })
    (map.as("Node", expression)),
    RestElement: (map, restElement) =>
        ({ ...restElement, argument: toPattern(restElement.argument) }),

    CatchClause: then("Node", toPatternKeys(["param"])),
    Function: then("Node", toPatternKeys(["id", "params"])),
    VariableDeclarator: then("Node", toPatternKeys(["id"])),

    AssignmentPattern: then("Node", toPatternKeys(["left"])),
    ArrayPattern: then("Node", toPatternKeys(["elements"])),
    ObjectPattern: (map, pattern) => ({ ...pattern,
        properties: pattern.properties
            .map(property =>
                ({ ...property, value: toPattern(property.value) }))
            .map(property => [property.key, map(property)])
            .map(([key, property]) =>
                property.computed ? property : { ...property, key }) })
});


const IdentifierExpression = CustomNode `IdentifierExpression` (
    aliases     => ["Expression"],
    generate    => (emit, { name }) => emit.word(name),
    name        => [string] );

const IdentifierPattern = CustomNode `IdentifierPattern` (
    aliases     => ["Pattern", "LVal", "PatternLike"],
    generate    => (emit, { name }) => emit.word(name),
    name        => [string] );

module.exports.IdentifierExpression = IdentifierExpression;
module.exports.IdentifierPattern = IdentifierPattern;
