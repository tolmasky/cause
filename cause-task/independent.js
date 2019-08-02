const { data, union, is, any } = require("@algebraic/type");
const Cause = require("@cause/cause");
const update = require("@cause/cause/update");
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
        Task.Running({ ...initial }),
        [Task.Running({ ...initial })]
    ])

Independent.Running.update = update
    .on(Task.Success, (initial, event) =>
        [event, [event]])
    .on(Independent.Failure, (waiting, event) =>
        [event, [event]]);

module.exports = Independent;
