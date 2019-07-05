const { data, number, string, union } = require("@algebraic/type");
const SourceLocation = require("./source-location");
const ESTreeBridge = require("./estree-bridge");


module.exports = union `Comment` (
    ESTreeBridge `Block {ESTree = CommentBlock}` (
        value   => string,
        start   => number,
        end     => number,
        loc     => SourceLocation ),

    ESTreeBridge `Line {ESTree = CommentLine}` (
        value   => string,
        start   => number,
        end     => number,
        loc     => SourceLocation ) );
