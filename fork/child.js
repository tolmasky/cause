const { Cause, field, event, update } = require("cause");
const { Parent, Message } = require("@cause/process/parent");


const Child = Cause("Fork.Child",
{
    [field `root`]: -1,
    [field `parent`]: Parent.create(),

    [event.on (Cause.Ready)]: child =>
        Cause.Ready.are([child.parent, child.root]) ?
            update.in(child, "parent", Message({ event: Cause.Ready() })) :
            child,

    [event.on (Cause.Start)]: event.ignore,

    [event.from `root`]: (child, event) =>
        update.in(child, "parent", Message({ event })),

    [event.from `parent`]: (child, event) =>
        update.in(child, "root", event)
});

module.exports = Child;
