const { data, number, string, nullable, union } = require("@algebraic/type");
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
        leadingComments => nullable(Array),
        innerComments   => nullable(Array),
        trailingComment => nullable(Array),
        start           => nullable(number),
        end             => nullable(number),
        loc             => nullable(SourceLocation) );

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

const fieldFromBabelDefinition = require("./field-from-babel-definition");
const types = Object.fromEntries(
    undeprecated.map(name => [name, Node([name])
        (...Object
            .entries(t.NODE_FIELDS[name])
            .map(([name, definition]) =>
                fieldFromBabelDefinition(Node, name, definition)))]));

const aliases = Object.fromEntries(Object
    .entries(t.FLIPPED_ALIAS_KEYS)
    .map(([name, aliases]) =>
        [name, union ([name])
            (...aliases.map(name => types[name]))]));

Object.assign(Node, types, aliases);
