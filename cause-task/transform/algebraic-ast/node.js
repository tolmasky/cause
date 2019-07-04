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











