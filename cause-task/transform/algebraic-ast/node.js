const { data, number, string, nullable, union, getTypename } = require("@algebraic/type");
const ESTreeBridge = require("./estree-bridge");

const Position = data `Position` (
    line    => number,
    column  => number );

const SourceLocation = data `SourceLocation` (
    start   => Position,
    end     => Position );

const CommentBlock = data `CommentBlock` (
    value   => string,
    start   => number,
    end     => number,
    loc     => SourceLocation );

const CommentLine = data `CommentLine` (
    value   => string,
    start   => number,
    end     => number,
    loc     => SourceLocation );

const Comment = union `Comment` (
    CommentBlock,
    CommentLine );

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
module.exports.Position = Position;
module.exports.SourceLocation = SourceLocation;
module.exports.CommentBlock = CommentBlock;
module.exports.CommentLine = CommentLine;
module.exports.Comment = Comment;

const t = require("@babel/types");
const undeprecated = t
    .TYPES
    .filter(name => t[name] && !t.DEPRECATED_KEYS[name]);

const IdentifierPattern = Node `IdentifierPattern{ESTree = Identifier}` (
    name => string );

const IdentifierExpression = Node `IdentifierExpression{ESTree = Identifier}` (
    name => string );

const fieldFromBabelDefinition = require("./field-from-babel-definition");
const types = Object.fromEntries(
[
    ...undeprecated.map(name => [name, Node([name])
        (...Object
            .entries(t.NODE_FIELDS[name])
            .map(([name, definition]) =>
                fieldFromBabelDefinition(Node, name, definition)))]),
    ...[IdentifierPattern, IdentifierExpression]
        .map(type => [getTypename(type), type]),
]);

const ESTreeAliasMembers = t.FLIPPED_ALIAS_KEYS;
const aliasMembers =
{
    ...ESTreeAliasMembers,
    LVal: [...ESTreeAliasMembers["LVal"], "IdentifierPattern"],
    Pattern: [...ESTreeAliasMembers["Pattern"], "IdentifierPattern"],
    PatternLike: [...ESTreeAliasMembers["PatternLike"], "IdentifierPattern"],
    Expression: [...ESTreeAliasMembers["Expression"], "IdentifierExpression"],
    Node: ["IdentifierPattern", "IdentifierExpression", ...undeprecated]
};
const aliases = Object.fromEntries(Object
    .entries(t.FLIPPED_ALIAS_KEYS)
    .map(([name, aliases]) =>
        [name, union ([name])
            (...aliases.map(name => types[name]))]));

Object.assign(Node, types, aliases);
