const { Cause, field, event, update } = require("cause");
const { Parent, Message } = require("@cause/process/parent");


const Child = Cause("Fork.Child",
{
    [field `root`]: -1,
    [field `type`]: -1,
    [field `parent`]: Parent.create(),

    [event.out `Ready`]: { },
    [event.on (Parent.Ready)]: child =>
        update.in(child, "parent", Message({ event: Child.Ready() })),

    [event.from `root`]: (child, event) =>
        update.in(child, "parent", Message({ event })),

    [event.from `parent`]: (child, event) =>
        update.in(child, "root", event),

    [event.on (Cause.Start)]: child =>
        child.set("root", child.type.create())
});

module.exports = Child;
