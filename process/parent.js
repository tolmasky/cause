const { Cause, event, field, IO } = require("@cause/cause");
const { serialize, deserialize } = require("@cause/cause/record");


const Parent = Cause("Process.Parent",
{
    [field `process`]: IO.start(start),
    [field `ready`]: false,

    [event.on (Cause.Ready)]: (parent, event) =>
        [parent.set("ready", true), [Cause.Ready()]],

    [event.in `Message`]: { event: -1 },
    [event.on `Message`]: (parent, { event }) => {
        console.log("ABOUT TO ATTEMPT TO SEND" + event);
        return (process.send({ serialized: serialize(event) }), parent);
},
    [event.in `ParentMessage`]: { event: -1 },
    [event.on `ParentMessage`]: (parent, { event }) =>
        [parent, [event]]
});

module.exports = Parent;

function start(push)
{
    process.on("message", ({ serialized }) =>
        push(Parent.ParentMessage({ event: deserialize(serialized) })));
    push(Cause.Ready());
}