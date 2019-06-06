const { data, union, any, boolean, number, is } = require("@algebraic/type");
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
        failure         => Task.Failure ),

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
{
    const dependencies = List(Argument)([callee, ...arguments].map(
        (dependency, index) => Argument({ index: index - 1, dependency })));
    const initial = dependencies.filter(({ dependency }) =>
        is(Dependency.Initial, dependency));
    const completed = dependencies.filter(({ dependency }) =>
        is(Dependency.Completed, dependency));

    return Dependent.Initial({ lifted, initial, completed });
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
console.log("HERE!!!" ,event);
        const successes = completed.filter(({ dependency }) =>
            is(Dependency.Success, dependency));

        if (successes.size !== completed.size)
        {
            const failures = completed.filter(({ dependency }) =>
                is(Dependency.Failure, dependency));

            return andEvents(Dependent.DependencyFailure({ failures }));
        }

        const [f, ...arguments] = successes
            .sortBy(({ index }) => index)
            .map(({ dependency }) => dependency.value);
        console.log("F IS " + f + " "+ typeof f);
        const value = f(...arguments);
        const task = dependent.lifted ? Dependent.Success({ value }) : value;
console.log("great");
        if (is(Dependency.Success, task))
            return andEvents(Dependent.Success({ ...task }));

        return andEvents(Dependent.Unblocked({ task }));
    });

Dependent.Unblocked.update = update
    .on(Dependency.Started, (unblocked, event) =>
        andEvents(Dependent.Running({ ...unblocked }) ) )

Dependent.Running.update = update
    .on(Dependency.Success, (running, event) =>
        andEvents(Dependent.Success({ ...event }) ) )

    .on(Dependency.Failure, (running, event) =>
        andEvents(Dependent.InternalFailure({ failure: event }) ) )
    
function andEvents(value)
{
    return [value, [value]];
}
