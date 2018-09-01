const { field, event, Cause } = require("./cause");

const IO = Cause("Cause.IO",
{
    [field `UUID`]: "",
    [field `start`]: -1,
    [field `needsRegistration`]: true,

    [event.in `Emit`]: { event: -1 },
    [event.on `Emit`]: (io, { event }) => [io, [event]],

    [event.in `Register`]: { UUID: -1 },
    [event.on `Register`]: (io, { UUID }) => io
        .set("UUID", UUID)
        .set("needsRegistration", false)
});

module.exports = IO;

IO.fromAsync = f => 
    (start => IO.create({ start }))
    (push => void(f().then(event => push(event))));
IO.start = start => IO.create({ start })
IO.toPromise = require("./io/to-promise");
