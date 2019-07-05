const { data, number, string, union } = require("@algebraic/type");
const SourceLocation = require("./source-location");


module.exports = union `Comment` (
    data `Block` (
        value   => string,
        start   => number,
        end     => number,
        loc     => SourceLocation ),

    data `Line` (
        value   => string,
        start   => number,
        end     => number,
        loc     => SourceLocation ) );
