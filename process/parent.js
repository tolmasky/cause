const { Cause, event, field, IO } = require("cause");

const Parent = Cause("Process.Parent",
{
    [field `process`]: IO.start(start),
    [field `fromMessageToEvent`]: () => { },

    [event.in `Ready`]: { },
    [event.on `Ready`]: (parent, event) =>
        [parent, [event]],

    [event.in `Message`]: { data: -1 },
    [event.on `Message`]: (parent, { data }) =>
        (process.send(data), parent),

    [event.in `ParentMessage`]: { data: -1 },
    [event.on `ParentMessage`]: (parent, message) =>
        [parent, [].concat(parent.fromMessageToEvent(message))]
});

module.exports = Parent;

function start(push)
{
    process.on("message", data => { console.log("CHEESE!"); push(Parent.ParentMessage({ data })) });
    push(Parent.Ready());
}