const { Cause, event, field, IO } = require("@cause/cause");
const { getUUID, serialize } = require("@algebraic/type");
const legacy = require("@cause/cause/record");
const { inferredDeserialize } = require("./spawn");


const Parent = Cause("Process.Parent",
{
    [field `process`]: IO.start(start),
    [field `ready`]: false,

    [event.on (Cause.Ready)]: (parent, event) =>
        [parent.set("ready", true), [Cause.Ready()]],

    [event.in `Message`]: { event: -1 },
    [event.on `Message`]: (parent, { event }) =>
        (process.send(inferredSerialize(event)), parent),

    [event.in `ParentMessage`]: { event: -1 },
    [event.on `ParentMessage`]: (parent, { event }) =>
        [parent, [event]]
});

module.exports = Parent;

function start(push)
{
    process.on("message", message =>
        push(Parent.ParentMessage({ event: inferredDeserialize(message) })));

    push(Cause.Ready());
}

function inferredSerialize(event)
{
    const type = Object.getPrototypeOf(event).constructor;
    const UUID = getUUID(type);

    if (typeof UUID !== "string")
        return { isLegacy: true, serialized: legacy.serialize(event) };

    return { UUID, serialized: serialize(type, event) };
}
