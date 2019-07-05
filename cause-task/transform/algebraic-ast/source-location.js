const { data, number } = require("@algebraic/type");


const Position = data `Position` (
    line    => number,
    column  => number );

const SourceLocation = data `SourceLocation` (
    start   => Position,
    end     => Position );
    
module.exports = SourceLocation;
module.exports.SourceLocation = SourceLocation;
module.exports.Position = Position;
