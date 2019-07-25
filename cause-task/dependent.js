const { data, union, any, boolean, number, is, of } = require("@algebraic/type");
const { List, Map } = require("@algebraic/collections");
const update = require("@cause/cause/update");
const Task = require("./task");

Error.stackTraceLimit = 1000;
const Argument = data `Argument` (
    index       => number,
    dependency  => Dependency );

const Dependent  = union `Task.Dependent` (

    data `Blocked` (
        blocked         => [List(Argument), List(Argument)()],
        running         => [List(Argument), List(Argument)()],
        completed       => [List(Argument), List(Argument)()] ),

    // FIXME: we need this or because it gets changed from underneath us!
    data `Running` (
        task            => Dependency ),

    data `Success` (
        value           => any ),

    data `InternalFailure` (
        failure         => Dependency.Failure ),

    data `DependencyFailure` (
        failures        => List(Dependency.Failure) ) );

module.exports = Dependent;

Dependent.Dependent = Dependent;

Dependent.Progressed = union `Task.Dependent.Progressed` (
    Dependent.Running );

const Dependency = union `Task.Dependency` (
    Task,
    Dependent );

Dependent.Dependency = Dependency;

Dependency.Blocked = union `Task.Dependency.Blocked` (
    Dependent.Blocked,
    Task.Initial )

Dependency.Running = union `Task.Dependency.Running` (
    union `one` ( Task.Running ),
    union `two` ( Dependent.Running ) );

Dependency.Success = union `Task.Dependency.Success` (
    union `one` ( Task.Success ),
    union `two` ( Dependent.Success ) );

Dependency.Failure = union `Task.Dependency.Failure` (
    Task.Failure,
    Dependent.InternalFailure,
    Dependent.DependencyFailure );

Dependency.Completed = union `Task.Dependency.Completed` (
    Dependency.Success,
    Dependency.Failure );

Dependent.fromCall = function fromCall({ callee, arguments })
{
    const dependencies = List(Argument)([callee, ...arguments].map(
        (dependency, index) => Argument({ index: index - 1, dependency })));
    const blocked = dependencies.filter(({ dependency }) =>
        is(Dependency.Blocked, dependency));
    const running = dependencies.filter(({ dependency }) =>
        is(Dependency.Running, dependency));
    const completed = dependencies.filter(({ dependency }) =>
        is(Dependency.Completed, dependency));

    return Dependent.from({ blocked, running, completed });
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

Dependent.from = function({ blocked, running, completed })
{
    if (blocked.size > 0 || running.size > 0)
        return Dependent.Blocked({ blocked, running, completed });

    const successes = completed
        .filter(({ dependency }) =>
            is(Dependency.Success, dependency));

    if (successes.size !== completed.size)
    {
        const failures = completed
            .filter(({ dependency }) =>
                is(Dependency.Failure, dependency));

        return failures.size === 1 ?
            failures.get(0).dependency :
            Dependent.DependencyFailure({ failures });
    }

    const [f, ...args] = successes
        .sortBy(({ index }) => index)
        .map(({ dependency }) => dependency.value);
    const task = f(...args);

    return is(Dependency.Success, task) ?
        Dependent.Success({ ...task }) :
        Dependent.Running({ task });
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


function toPromiseThen(onResolve, onReject)
{
    return require("@cause/cause/to-promise")(Object, this).then(onResolve, onReject);
}

function toPromiseCatch(onReject)
{
    return require("@cause/cause/to-promise")(Object, this).catch(onReject);
}

for (const type of [...union.components(Task), ...union.components(Dependent)])
{
    type.prototype.then = toPromiseThen;
    type.prototype.catch = toPromiseCatch;
}



