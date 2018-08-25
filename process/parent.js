const { Cause, event, field, IO } = require("cause");
const { serialize, deserialize } = require("cause/record");


const Parent = Cause("Process.Parent",
{
    [field `process`]: IO.start(start),

    [event.in `Ready`]: { },
    [event.on `Ready`]: (parent, event) =>
        [parent, [event]],

    [event.in `Message`]: { event: -1 },
    [event.on `Message`]: (parent, { event }) =>
        (process.send({ serialized: serialize(event) }), parent),

    [event.in `ParentMessage`]: { event: -1 },
    [event.on `ParentMessage`]: (parent, { event }) =>
        [parent, [event]]
});

module.exports = Parent;

function start(push)
{
    process.on("message", ({ serialized }) =>
        push(Parent.ParentMessage({ event: deserialize(serialized) })));
    push(Parent.Ready());
}