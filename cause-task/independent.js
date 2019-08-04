const { data, union, is, any } = require("@algebraic/type");
const Cause = require("@cause/cause");
const update = require("@cause/cause/update");
const inspect = Symbol.for("nodejs.util.inspect.custom");
const Task = require("./task");


const Independent = union `Task.Independent` (
    data `Waiting` (
        cause => Cause(any) ),
    data `Running` (
        cause => Cause(any) ) );

const Started = data `Task.Started` ( );

Independent.Waiting.update = update
    .on(Started, (initial, event) =>
    [
        Independent.Running({ ...initial }),
        [Independent.Running({ ...initial })]
    ])
    .on(Task.Failure, (waiting, event) =>
        [event, [event]]);

Independent.Running.update = update
    .on(Task.Success, (initial, event) =>
        [event, [event]])
    .on(Task.Failure, (waiting, event) =>
        [event, [event]]);

Independent.fromResolvedCall = function (self, fUnknown, args = [])
{
    if (typeof fUnknown !== "function")
        return Task.Failure.Direct({ value:
            Error("Passed non-function to fromResolvedCall") });

    const name = fUnknown.name;
    const start = function start (push)
    {
        // Even if f was known to be a Promise-returning function, it can still
        // throw during the initial calling phase and thus not be handled by
        // .catch.
        (async function ()
        {
            push(Started);

            if (process.env.TASK_DEBUG)
                console.log("IN HERE FOR " + fUnknown);

            const value = await fUnknown.apply(self, args);
            const result = Task.Success({ name, value });

            push(result);
        })().catch(value => push(Task.Failure.Direct({ name, value })));
    };

    start.toString = function () { return (fUnknown+"").substr(0,100); }
    start[inspect] = function () { return (fUnknown+"").substr(0,100); }
    const cause = Cause(any)({ start });

    return Independent.Waiting({ cause });
}

module.exports = Independent;
