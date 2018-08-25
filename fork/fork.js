const { List } = require("immutable");
const { Cause, field, event, state, update } = require("cause");
const { Process, Message, node } = require("@cause/process");
const Child = require("./child");


module.exports = function (type)
{
    return Fork.create({ type });
}

const Fork = Cause("Fork",
{
    [field `state`]: "initial",
    [field `process`]: -1,
    [field `backlog`]: List(),

    init: ({ type }) =>
        ({ process: node({ path: __filename, args:[type.path] }) }),

    [state `initial`]:
    {
        [event.on (Cause.Start)]: fork =>
            update.in(
                fork,
                "process",
                Cause.Start()),

        [event.on (Process.Started)]: fork =>
            fork.set("state", "running"),

        [event.on `*`]: (fork, event) =>
            fork.set("backlog", fork.backlog.push(Message({ event })))
    },
    
    [state `running`]:
    {
        [event.on (Child.Ready)]: fork =>
            update.in.reduce(
                fork.set("backlog", -1),
                "process",
                fork.backlog),

        [event.from `process`]: (fork, event) => [fork, [event]],

        [event.on `*`]: (fork, event) =>
            update.in(fork, "process", Message({ event }))
    }
});

if (require.main === module)
{
    const filename = process.argv[2];
    const type = require(filename);
    const IO = require("cause/io");

    IO.toPromise(Child.create({ type }));
}
