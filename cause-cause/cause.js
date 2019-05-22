const { data, union, number, parameterized, ftype, boolean } = require("@algebraic/type");

const Cause = parameterized (function (T)
{
    const CauseT = data `Cause<${T}>` (
        UUID                => [number, -1],
        start               => ftype,
        needsRegistration   => [boolean, true] );

    CauseT.Started = data `Cause<${T}>.Started` ();
    CauseT.Completed = union `Cause.Completed<${T}>` (
        data `Succeeded<${T}>` (
            value => T ),
        data `Failed<${T}>` (
            error => Object ) );

    CauseT.update = require("./update")
        .on(Cause.Register, (cause, { UUID }) => CauseT({ ...cause, UUID }));

    return CauseT;
});

Cause.Start = data `Cause.Start` ();
Cause.Register = data `Cause.Register` (
    UUID => number );


module.exports = Cause;
module.exports.Cause = Cause;
