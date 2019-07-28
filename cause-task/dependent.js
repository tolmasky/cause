const { data, union, any, boolean, number, is, of } = require("@algebraic/type");
const { List, Map } = require("@algebraic/collections");

const update = require("@cause/cause/update");

const Argument = data `Argument` (
    index       => number,
    dependency  => Dependency );

const Dependent  = union `Task.Dependent` (
    data `Blocked` (
        bind            => any,
        then            => Function,
        blocked         => [List(Argument), List(Argument)()],
        running         => [List(Argument), List(Argument)()],
        failures        => [List(Argument), List(Argument)()],
        successes       => [List(Argument), List(Argument)()] ),

    data `Running` (
        consequent      => Task ),

    data `Task.Dependent.Success` (
        value           => any ),

    union `Failure` (
        data `Dependencies` (
            failure     =>  Task.Failure ),

        data `Branched` (
            failured    =>  Task.Failure ),

        data `Synchronous` (
            error       =>  any ) ) );

module.exports = Dependent;

Dependent.Dependent = Dependent;

Dependent.fromCall = function fromCall({ bind, then, args })
{
    const dependencies = List(Argument)([callee, ...args].map(
        (dependency, index) => Argument({ index: index - 1, dependency })));
    const blocked = dependencies.filter(({ dependency }) =>
        is(Dependency.Blocked, dependency));
    const running = dependencies.filter(({ dependency }) =>
        is(Dependency.Running, dependency));
    const completed = dependencies.filter(({ dependency }) =>
        is(Dependency.Completed, dependency));

    return Dependent.from({ bind, propagate, blocked, running, completed });
}

Dependent.Blocked.update = update
    .on(Dependency.Running, (dependent, event, [_, index]) =>
        Dependent.Blocked(
        {
            ...dependent,
            running: dependent.running
                .push(dependent.blocked.get(index)),
            blocked: dependent.blocked.remove(index)
        }) )

    .on(Dependency.Completed, function (dependent, event, [previous, index])
    {
        const updated = Dependent.from(
        {
            ...dependent,
            [previous]: dependent[previous].remove(index),
            completed: dependent.completed
                .push(dependent[previous].get(index))
        });

        return is(Dependent.Blocked, updated) ? updated : andEvents(updated);
    });

Dependent.from = function(fields)
{
    if (fields.running.size > 0)
        return Dependent.Blocked(fields);

    if (fields.failures.size > 0)
    {
        const failures = fields.failures
            .map(argument => argument.dependency);

        return Dependent.Failure.Dependencies({ failures });
    }

    if (fields.blocked.size > 0)
        return Dependent.Blocked(fields);

    const { bind, then } = fields;
    const args = successes
        .sortBy(({ index }) => index)
        .map(({ dependency }) => dependency.value);

    try
    {
        const task = then.apply(bind, args);

        return is (Task.Failure, task) ?
            Dependent.Failure.Branched({ failure: task }) :
            is(Task.Success, task) ?
                Dependent.Success({ ...task }) :
                Dependent.Running({ consequent: task });
    }
    catch (error)
    {
        return Dependent.Failure.Synchronous({ failure: task });
    }
}

Dependent.Running.update = update
    .on(Dependency.Success, (running, event) =>
        andEvents(Dependent.Success({ ...event }) ) )

    .on(Dependency.Failure, (running, event) =>
        andEvents(event) )//Dependent.InternalFailure({ failure: event }) ) )

    // Ignore anything else from the internal task.
    .on(any, dependent => [dependent, []]);

function andEvents(value)
{
    return [value, [value]];
}


const Task = require("./task");



