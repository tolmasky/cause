const { data, union, number, parameterized, ftype, boolean } = require("@algebraic/type");

const Cause = parameterized (function (T)
{
    const CauseT = data `Cause<${T}>` (
        UUID                => [number, -1],
        start               => ftype,
        needsRegistration   => [boolean, true] );

    CauseT.Started = data `Cause<${T}>.Started` ();
    CauseT.Completed = union `Cause<${T}>.Completed` (
        data `Succeeded` (
            value => T ),
        data `Failed` (
            error => Object ) );

    CauseT.update = require("./update")
        .on(Cause.Register, (cause, { UUID }) =>
            CauseT({ ...cause, UUID, needsRegistration: false }))
        .on(Cause.Emit, (cause, { event }) =>
            [cause, [event]]);

    return CauseT;
});

Cause.Start = data `Cause.Start` ();
Cause.Register = data `Cause.Register` (
    UUID => number );

Cause.Emit = data `Cause.Emit` (
    event => Object );


module.exports = Cause;
module.exports.Cause = Cause;
