const { data, union, is, any } = require("@algebraic/type");
const Cause = require("@cause/cause");
const update = require("@cause/cause/update");
const inspect = Symbol.for("nodejs.util.inspect.custom");


const Task = union `Task` (
    data `Initial` (
        cause => Cause(any) ),
    data `Running` (
        cause => Cause(any) ),
    data `Success` (
        value => any ),
    data `Failure` (
        error => any ) );

const Started = data `Task.Started` ( );

Task.Completed = union `Task.Completed` (
    Task.Success,
    Task.Failure );

Task.Initial.update = update
    .on(Started, (initial, event) =>
    [
        Task.Running({ ...initial }),
        [Task.Running({ ...initial })]
    ]);

Task.Running.update = update
    .on(Task.Success, (initial, event) =>
        [event, [event]])
    .on(Task.Failure, (waiting, event) =>
        [event, [event]]);

Task.fromAsync = function (fAsync)
{
    return (...args) => Task.fromAsyncCall(fAsync, ...args);
}

Task.fromAsyncCall = function (fAsync, ...args)
{
    const start = function start (push)
    {
        fAsync(...args)
            .then(value => push(Task.Success({ value })))
            .catch(error => push(Task.Failure({ error })));

        push(Started);
    };
    start.toString = function () { return (fAsync+"").substr(0,100); }
    start[inspect] = function () { return (fAsync+"").substr(0,100); }
    const cause = Cause(any)({ start });

    return Task.Initial({ cause });
}

module.exports = Task;
module.exports.Task = Task;
