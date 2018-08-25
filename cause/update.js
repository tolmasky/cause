const { assign } = Object;
const { isArray } = Array;
const { Iterable: { isIndexed } } = require("immutable");
const KeyPath = require("./key-path");
const type = record => Object.getPrototypeOf(record).constructor;


module.exports = assign(update,
{
    reduce: updateReduce,
    in: assign(updateIn, { reduce: updateInReduce })
});

function update(inState, inEvent)
{
    if (inEvent === false)
        return [inState, []];
//console.log("FOR " + inState + " " + inEvent);
    return updateFromKeyPath(inState, inEvent);
}

function updateFromKeyPath(inState, inEvent, fromKeyPath)
{
console.log("UPDATING " + type(inState).name + " with " + type(inEvent).name);
    return type(inState).update(inState, inEvent, fromKeyPath);
}

function updateReduce(inState, inEvents)
{
    return reduce(update, inState, inEvents);
}

function updateIn(inState, keyPath, inChildEvent)
{console.log("UPDATING " + type(inState).name + " with " + KeyPath.from(keyPath) + " and " + inChildEvent);
    return updateInKeyPath(inState, KeyPath.from(keyPath), inChildEvent);
}

function updateInReduce(inState, keyPathOrPairs, inEventsOrUndefined)
{
    const isPairs = inEventsOrUndefined === void(0);
    const pairs = isPairs ?
        keyPathOrPairs :
        inEventsOrUndefined.map(inEvent => [keyPathOrPairs, inEvent]);

    return reduce(updatePair, inState, pairs);
}

function updatePair(inState, [keyPath, inEvent])
{
    return updateIn(inState, keyPath, inEvent)
}

function updateInKeyPath(inState, keyPath, inChildEvent)
{
    if (!keyPath)
        return update(inState, inChildEvent);

    const key = keyPath.data;
    const inChild = inState.get(key);
    const [outChild, midEvents, fromChildKeyPath] =
        updateInKeyPath(inChild, keyPath.next, inChildEvent);
    const midState = inState.set(key, outChild);
    const fromKeyPath = KeyPath(key, fromChildKeyPath);

    return isCause(midState) ?
        reduce(updateFromKeyPath, midState, midEvents, fromKeyPath) :
        [midState, midEvents, fromKeyPath];
}

function isCause(state)
{
    return  state && typeof state === "object" &&
            typeof type(state).update === "function";
}

function reduce(update, inState, items, fromKeyPath)
{
    return items.reduce(function ([inState, midEvents], item)
    {
        const [outState, outEvents] =
            update(inState, item, fromKeyPath);
        const concatedEvents = midEvents && outEvents ?
            [...midEvents, ...outEvents] :
            midEvents || outEvents;

        return [outState, concatedEvents];
    }, [inState, []]);
}
