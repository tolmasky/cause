const { is } = require("@algebraic/type");
const { assign } = Object;
const { isArray } = Array;
const { Iterable: { isIndexed } } = require("immutable");
const KeyPath = require("./key-path");
const type = record => Object.getPrototypeOf(record).constructor;


module.exports = assign(update,
{
    reduce: updateReduce,
    in: assign(updateIn, { reduce: updateInReduce }),
    on: (function toUpdate(cases)
    {
        const update = function update(inState, inEvent, fromKeyPath)
        {
            const match = cases.find(([type, from]) =>
                (!from || KeyPath.equal(fromKeyPath, from)) &&
                is(type, inEvent));
    
            if (!match)
            {
                const rname = getTypename(type(inState));
                const ename = getTypename(type(inState));
                const fromMessage = fromKeyPath ? ` from ${fromKeyPath}` : "";
    
                throw Error(
                    `${rname} does not respond to ${ename}${fromMessage}`);
            }
    
            const [,, handler] = match;
            const result = handler(inState, inEvent, fromKeyPath);
    
            return Array.isArray(result) ? result : [result, []];
        }
        const on = function (type, ...rest)
        {
            const [from, handler] =
                rest.length === 1 ? [false, rest[0]] :
                rest.length === 2 ? rest :
                (() => { throw Error("Wrong number of arguments") })();
    
            return toUpdate([...cases, [type, from, handler]]);
        }
        
        return Object.assign(update, { on });
    })([]).on
});

function update(inState, inEvent, fromKeyPath)
{
    if (inEvent === false)
        return [inState, []];

//console.log("FOR " + inState + " " + inEvent);
console.log(type(inState));
    return type(inState).update(inState, inEvent, fromKeyPath);
}

function updateReduce(inState, inEvents)
{
    return reduce(update, inState, inEvents);
}

function updateIn(inState, keyPath, inChildEvent)
{//console.log("UPDATING " + type(inState).name + " with " + KeyPath.from(keyPath) + " and " + inChildEvent);
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
    const inChild = inState[key];
    const [outChild, outEventsFromChild, fromChildKeyPath] =
        updateInKeyPath(inChild, keyPath.next, inChildEvent);
    const midState = inChild !== outChild ?
        type(inState)({ ...inState, [key]: outChild }) :
        inState;
    const fromKeyPath = KeyPath(key, fromChildKeyPath);

    return isCause(midState) ?
        reduce(update, midState, outEventsFromChild, fromKeyPath) :
        [midState, outEventsFromChild, fromKeyPath];
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
        const [outState, outEvents] = update(inState, item, fromKeyPath);

        const concatedEvents = midEvents && outEvents ?
            [...midEvents, ...outEvents] :
            midEvents || outEvents;

        return [outState, concatedEvents];
    }, [inState, []]);
}
