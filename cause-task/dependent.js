const { data, union, any, number, is, of } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const update = require("@cause/cause/update");
const Task = require("./task");

Error.stackTraceLimit = 1000;

const Dependency = data `Dependency` (
    index       => number,
    task        => Task );

const Dependent = union `Task.Dependent` (

    // Blocked simply mean our dependencies aren't ready yet.
    //
    // There is no such thing as a "Waiting" state for a Dependent (or pre-run)
    // state. The fact that we have created it necessarily represents that we
    // have entered it.
    data `Blocked` (
        name        => Task.Identifier,
        consequent  => Function,
        waiting     => List(Dependency),
        active      => List(Dependency),
        successes   => List(Dependency),
        failures    => List(Dependency) ),

    // `task` might be "active" or possibly waiting itself, so it's not really
    // appropriate to call this "Running". The only thing that is true at this
    // this point is that we are unblocked.
    //
    // We also don't want to consider this a kind of "Waiting", because if we've
    // gotten this far, it merits seeing it through, even if there is a peer
    // failure. If we were a form of waiting, a peer failure would allow this to
    // be canceled.
    data `Unblocked` (
        name        => Task.Identifier,
        task        => Task ) );

module.exports = Dependent;

Dependent.fromCall = function (consequent, args, name)
{
    const dependencies = List(Dependency)(args)
        .map((task, index) => Dependency({ task, index }));
    const dependencyIs = type => dependency => is (type, dependency.task);

    const waiting = dependencies.filter(dependencyIs(Task.Waiting));
    const active = dependencies.filter(dependencyIs(Task.Active));
    const successes = dependencies.filter(dependencyIs(Task.Success));
    const failures = dependencies.filter(dependencyIs(Task.Failure));

    return Dependent
        .from({ name, consequent, waiting, active, successes, failures });
}

Dependent.from = function(fields)
{
    // Our current strategy is that we do not cancel active tasks.
    if (fields.active.size > 0)
        return Dependent.Blocked(fields);

    const { name, consequent } = fields;

    if (fields.failures.size > 0)
        return tryCall(name, consequent, false, fields.failures);

    if (fields.waiting.size > 0)
        return Dependent.Blocked(fields);

    // At this point we know everything left is successes.
    return tryCall(name, consequent, true, fields.successes);
}

function tryCall(name, consequent, succeeded, dependencies)
{
    try
    {
        const completions = dependencies
            .sortBy(({ index }) => index)
            .map(dependency => dependency.task);
        const result = consequent(succeeded, completions);

        if (is (Task.Success, result))
            return Task.Success({ ...result, name });

        if (is (Task.Failure, result))
            return of(result)({ ...result, name });

        return Dependent.Unblocked({ name, task: result });
    }
    catch (value)
    {
        return Task.Failure.Direct({ name, value });
    }
}

Dependent.Blocked.update = update
    .on(Task.Active, (dependent, event, [_, index]) =>
        Dependent.Blocked(
        {
            ...dependent,
            active: dependent.active
                .push(dependent.waiting.get(index)),
            waiting: dependent.waiting.remove(index)
        }) )

    .on(Task.Completed, function (dependent, event, [previous, index])
    {
        const task = dependent[previous].get(index);
        const next = is (Task.Success) ? "successes" : "failures";
        const updated = Dependent.from(
        {
            ...dependent,
            [previous]: dependent[previous].remove(index),
            [next]: dependent.successes.push(task)
        });

        return is(Dependent.Blocked, updated) ? updated : andEvents(updated);
    });

Dependent.Unblocked.update = update
    .on(Task.Success, ({ name }, event) =>
        andEvents(Task.Success({ ...event, name }) ) )

    .on(Task.Failure, (unblocked, event) => andEvents(event) )

    // Ignore anything else from the internal task.
    .on(any, dependent => [dependent, []]);

function andEvents(value)
{
    return [value, [value]];
}
