const { Record } = require("immutable");
const type = state => Object.getPrototypeOf(state).constructor;


module.exports = Object.assign(update, { in: updateIn, in_: updateIn_ });

function update(state, event, source)
{
    const update = type(state).update;

    if (!update)
        return [state, [event]];

    return update(state, event, source);
}


function updateIn_(path, events, state, source)
{
    return [].concat(events).reduce(function ([state, coallesced], event)
    {
        if (!event)
            return [state, coallesced];

        const [updated, events] =
            updateInWithIndex(state, path, 0, event, source);

        return [updated, [...coallesced, ...events]];
    }, [state, []]);
}

function updateIn(state, path, event, source)
{
    const pathArray = typeof path === "string" ? [path] : Array.from(path);

    if (Array.isArray(event))
        return event.reduce(function ([state, coallesced], event)
        {
            const [updated, events] =
                updateInWithIndex(state, pathArray, 0, event, source);

            return [updated, [...coallesced, ...events]];
        }, [state, []]);

    return updateInWithIndex(state, pathArray, 0, event, source);
}

function updateInWithIndex(state, path, index, event, source)
{
    if (index >= path.length)
        return update(state, event, source);

    const component = path[index];
    const child = state.get(component);
    const [updatedChild, events] =
        updateInWithIndex(child, path, index + 1, event, source);
    const updated = state.set(component, updatedChild);

    return events.reduce(function ([state, coallesced], event)
    {
        const [updated, events] = update(state, event, source);

        return [updated, [...coallesced, ...events]];
    }, [updated, []]);
}

/*

const isNonStringIterable = object =>
    object &&
    typeof object !== "string" &&
    typeof object[Symbol.iterator] === "function";
const ofString = iterable =>
    (seq => seq.has(0) && typeof seq.get(0) === "string")
    (Seq(iterable));

update.in.all
update.start.all

function updateAll(paths, events, state, source)
{

}

function updateStart(path, state, source)
{
    const start = Cause.Start();

    return [].concat(events).reduce(
        function ([state, coallesced], [path, event])
        {
            const [updated, events] =
                updateInWithIndex(state, path, 0, start, source);

            return [updated, [...coallesced, ...events]];
        });
}

*/
