const { data, union, any, is } = require("@algebraic/type");
const Task = require("./task");
const update = require("@cause/cause/update");


const Guard  = union `Task.Guard` (
    data `Blocked` (
        bind            => any,
        recover         => Function,
        guarded         => Task ),

    data `Running` (
        recovery        => Task ),

    data `Success` (
        value           => any ),

    union `Failure` (
        data `Branched` (
            failure => Task.Failure ),

        data `Synchronous` (
            error => any ) ) );

module.exports = Guard;

function recover(failure, guard)
{
    try
    {
        const { bind, recover } = guard;
        const task = guard.call(bind, failure);

        return is (Task.Failure, task) ?
            Guard.Failure.Branched({ failure: task }) :
            is(Task.Success, task) ?
                Guard.Success({ ...task }) :
                Guard.Running({ recovery: task });
    }
    catch (error)
    {
        return Guard.Failure.Synchronous({ error });
    }
}

Guard.Blocked.update = update
    .on(Task.Running, (blocked) =>
        andEvents(Guard.Running({ ...blocked }) ) )

    .on(Task.Success, (blocked, event) =>
        andEvents(Guard.Success({ ...event }) ) )

    .on(Task.Failure, (blocked, event) =>
        andEvents(recover(blocked, event)) )

Guard.Running.update = update
    .on(Task.Success, (running, event) =>
        andEvents(Guard.Success({ ...event }) ) )

    .on(Task.Failure, (running, event) =>
        andEvents(recover(blocked, event)) )

    // Ignore anything else from the internal task.
    // Do we need this?
    .on(any, dependent => [dependent, []]);
    
    
    
    