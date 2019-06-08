const { data, union, any, boolean, number, is, of } = require("@algebraic/type");
const { List, Map } = require("@algebraic/collections");
const update = require("@cause/cause/update");
const Task = require("./task");

Error.stackTraceLimit = 1000;
const Argument = data `Argument` (
    index       => number,
    dependency  => Dependency );

const Dependent  = union `Task.Dependent` (
    data `Initial` (
        lifted          => boolean,
        initial         => [List(Argument), List(Argument)()],
        completed       => [List(Argument), List(Argument)()] ),

    data `Unblocking` (
        lifted          => boolean,
        initial         => [List(Argument), List(Argument)()],
        started         => [List(Argument), List(Argument)()],
        completed       => [List(Argument), List(Argument)()] ),

    // FIXME: we need this or because it gets changed from underneath us!
    data `Unblocked` (
        task            => union `or` ( Dependency ) ),

    data `Running` (
        task            => union `or2` ( Dependency ) ),

    data `Success` (
        value           => any ),

    data `InternalFailure` (
        failure         => Dependency.Failure ),

    data `DependencyFailure` (
        failures        => List(Dependency.Failure) ) );

module.exports = Dependent;

Dependent.Dependent = Dependent;

Dependent.Progressed = union `Task.Dependent.Progressed` (
    Dependent.Unblocked,
    Dependent.Running );

const Dependency = union `Task.Dependency` (
    Task,
    Dependent );

Dependent.Dependency = Dependency;

Dependency.Started = union `Task.Dependency.Started` (
    Dependent.Unblocking,
    Task.Running )

Dependency.Initial = union `Task.Dependency.Initial` (
    union `one` ( Task.Initial ),
    union `two` ( Dependent.Initial ) );

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

Dependent.Initial.from = function from({ lifted, callee, arguments })
{throw Error("NO ONE SHOULD USE ME");
    const dependencies = List(Argument)([callee, ...arguments].map(
        (dependency, index) => Argument({ index: index - 1, dependency })));
    const initial = dependencies.filter(({ dependency }) =>
        is(Dependency.Initial, dependency));
    const completed = dependencies.filter(({ dependency }) =>
        is(Dependency.Completed, dependency));

    return Dependent.Initial({ lifted, initial, completed });
}

Dependent.from = function from({ lifted, callee, arguments, shout })
{
    const dependencies = List(Argument)([callee, ...arguments].map(
        (dependency, index) => Argument({ index: index - 1, dependency })));
    const initial = dependencies.filter(({ dependency }) =>
        is(Dependency.Initial, dependency));
    const completed = dependencies.filter(({ dependency }) =>
        is(Dependency.Completed, dependency));
//if (shout) { console.log("ARGUMENT COUNT IS " + dependencies.size + " " + completed.size + " " + initial.size + " " + lifted) }
    return initial.size === 0 ?
        Dependent.Running.from({ lifted, completed }) :
        Dependent.Initial({ lifted, initial, completed });
}

Dependent.Initial.update = update
    .on(Dependency.Started, (dependent, event, [_, index]) =>
        andEvents(Dependent.Unblocking(
        {
            ...dependent,
            initial: dependent.initial.remove(index),
            started: List(Dependency.Started)
                ([dependent.initial.get(index)]),
            completed: dependent.completed
        }) ) );

Dependent.Unblocking.update = update
    .on(Dependency.Started, (dependent, event, [_, index]) =>
        Dependent.Unblocking(
        {
            ...dependent,
            started: dependent.started
                .push(dependent.initial.get(index)),
            initial: dependent.initial.remove(index)
        }) )

    // We don't care about this kind of progress.
    .on(Dependent.Progressed, (dependent, event) => [dependent, []])

    .on(Dependency.Completed, function (dependent, event, [_, index])
    {
        const initial = dependent.initial;
        const started = dependent.started.remove(index);
        const completed = dependent.completed
            .push(dependent.started.get(index));

        if (started.size > 0 || initial.size > 0)
            return Dependent.Unblocking(
                { ...dependent, initial, started, completed });

        const { lifted } = dependent;
        const unblocked = Dependent.Running.from({ lifted, completed });

        return andEvents(unblocked);
    });

Dependent.Running.from = function ({ lifted, completed })
{
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

    const [f, ...arguments] = successes
        .sortBy(({ index }) => index)
        .map(({ dependency }) => dependency.value);
    const value = f(...arguments);
//console.log(f+" -> " + lifted + " " + value);
//console.log("CHILD: " + of(value));
    return  lifted ? Dependent.Success({ value }) :
            is(Dependency.Success, value) ? Dependent.Success({ ...value }) :
            Dependent.Running({ task: value });
}

Dependent.Unblocked.update = update
    .on(Dependency.Started, (unblocked, event) =>
        andEvents(Dependent.Running({ ...unblocked }) ) )

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

