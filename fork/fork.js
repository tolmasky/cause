const { List } = require("immutable");
const { Cause, field, event, state, update } = require("@cause/cause");
const { Process, Message, node } = require("@cause/process");
const Child = require("./child");
const type = object => Object.getPrototypeOf(object).constructor;


const Fork = Cause("Fork",
{
    [field `ready`]: false,
    [field `state`]: "initial",
    [field `process`]: -1,
    [field `backlog`]: List(),

    // Eventually we should be able to just pass a template and serialize it.
    init: ({ type, fields }) =>
    {
        const args = [type.path, JSON.stringify(fields)];
        const process = node({ path: __filename, args });

        return { process: update(process, Cause.Start())[0] };
    },

    [state `initial`]:
    {
        [event.on (Process.Started)]: fork =>
            fork.set("state", "running"),

        [event.on `*`]: (fork, event) =>
            fork.set("backlog", fork.backlog.push(Message({ event })))
    },
    
    [state `running`]:
    {
        [event.on (Cause.Ready) .from `process`](fork)
        {
            const [outFork, events] = update.in.reduce(
                fork.set("ready", true)
                    .set("backlog", -1),
                "process",
                fork.backlog);

            return [outFork, [...events, Cause.Ready()]];
        },

        [event.from `process`]: (fork, event) => [fork, [event]],

        [event.on `*`]: (fork, event) =>
            update.in(fork, "process", Message({ event }))
    }
});

module.exports = Fork;

if (require.main === module)
{
    const filename = process.argv[2];
    const fields = JSON.parse(process.argv[3]);
    const type = require(filename);
    const IO = require("@cause/cause/io");

    IO.toPromise(Child.create({ root: type.create(fields) }));
}
