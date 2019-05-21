const { data, union, parameterized, ftype } = require("@algebraic/type");

const Cause = parameterized (function (T)
{
    const Cause = data `Cause<${T}>` (
        start => ftype );

    Cause.Started = data `Cause<${T}>.Started` (); 
    Cause.Completed = union `Cause.Completed<${T}>` (
        data `Succeeded<${T}>` (
            value => T ),
        data `Failed<${T}>` (
            error => Object ) );

    return Cause;
});

Cause.Start = data `Cause.Start` ();


module.exports = Cause;
module.exports.Cause = Cause;
