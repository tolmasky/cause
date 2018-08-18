const { Iterable, List, Map, Record } = require("immutable");
const { Cause, field, event } = require("cause");
const AsynchronousCause = require("./cause");
const update = require("cause/update");


const Conductor = Cause("Conductor",
{
    [field `nextAsynchronousCauseUUID`]: 0,
    [field `asynchronousCauses`]: Map(),
    [field `push`]: () => { },
    [field `root`]: -1,

    init({ root, push })
    {
        const asynchronousPush =
            (...args) => setImmediate(() => push(...args));

        return { root, push: asynchronousPush }
    },

    [event.on (Cause.Start)](bridge, { keyPath, event })
    {
        const [updated, events] = update.in(bridge, "root", Cause.Start());
console.log("oh");
        return [updateAsynchronousCauses(updated), events];
    },
    
    /*
    bridge =>
        [updateAsynchronousCauses(bridge), []],
*/
    [event.in `AsynchronousEvent`]: { keyPath: List(), event: -1 },

    [event.on `AsynchronousEvent`](bridge, { keyPath, event })
    {
        const [updated, events] = update.in(bridge, keyPath, event, source);

        return [updateAsynchronousCauses(updated), events]
    }
});

module.exports = Conductor;

function updateAsynchronousCauses(bridge)
{
    const registeredCauses = bridge.asynchronousCauses;
    const identifiedCauses = getAsynchronousCauses(bridge);

    const purgedCauses = registeredCauses.filter((cancel, UUID) =>
        identifiedCauses.has(UUID) || void(cancel && cancel()));

    const unregisteredCauses = identifiedCauses.get("unregistered", List());
    const asynchronousPush = bridge.asynchronousPush;

    const UUID = bridge.nextAsynchronousCauseUUID;
    const { AsynchronousEvent } = Conductor;

    const [updatedRoot, updatedCauses, nextUUID, events] = unregisteredCauses
        .reduce(function ([root, causes, UUID, events], entry)
        {
            const { start, keyPath } = entry;
            const push = event =>
                asynchronousPush(AsynchronousEvent({ keyPath, event }));

            const event = AsynchronousCause.Register({ UUID });
            const cancel = start(asynchronousPush);
            const updatedCauses = causes.set(UUID, cancel);

            const rootKeyPath = keyPath.pop();
            const source = root.getIn(rootKeyPath);
            const [updatedRoot, additionalEvents] =
                update.in(root, rootKeyPath, event, source);

            const updatedEvents = additionalEvents.length > 0 ?
                events ? additionalEvents : events.concat(additionalEvents) :
                events;
            const nextUUID = UUID + 1;
    
            return [updatedRoot, updatedCauses, nextUUID, updatedEvents];
        }, [bridge.root, purgedCauses, UUID, null]);

    return bridge
        .set("root", updatedRoot)
        .set("nextAsynchronousCauseUUID", nextUUID)
        .set("asynchronousCauses", updatedCauses);
}

function getAsynchronousCauses(record)
{
    if (!record)
        return Map();

    if (!record._asynchronousCauses)
        record._asynchronousCauses =
            getComputedAsynchronousCauses(record);

    return record._asynchronousCauses;
}
    
function getComputedAsynchronousCauses(record)
{
    if (record instanceof require("@cause/pool"))
    {console.log("HERE", record);
//        if (!record.awaitingRegistration)
//            return Map();

        const { UUID="UUID", start } = record;
        const entry = new Entry(start);
        const value = UUID === "unregistered" ? List.of(entry) : entry;

        return Map({ [UUID]: value });
    }

    if (record instanceof Iterable.Indexed ||
        record instanceof Record)
    {
        const pairs = record.keySeq()
            .map(key => [getAsynchronousCauses(record.get(key)), key])
            .map(([entries, key]) =>
                entries.keySeq()
                    .map(UUID => [UUID, entries.get(UUID)])
                    .map(([UUID, entry]) => UUID === "unregistered" ?
                        [UUID, entry.map(entry => entry.push(key))] :
                        [UUID, entry.push(key)]));
        console.log(pairs);
        console.log("-->" + pairs.join("---"));
        const groups = pairs.groupBy(pair =>
            pair[0] === "unregistered" ? "unregistered" : "rest");
        const union = Map(groups.get("rest").flatten());
        console.log(union);
        //console.log(groups);
        const unregistered = groups.get("unregistered", List())
            .map(pair => pair[1]);
        
        
//console.log(unregistered);
console.log(union.set("unregistered", unregistered));
        return union.set("unregistered", unregistered);
    }

    return Map();
}

function Entry(start, keyPath)
{
    this.start = start;
    this.keyPath = keyPath;
}

Entry.prototype.toString = function ()
{
    return `Entry { ${Array.from(this.keyPath).join(", ")} }`;
}

Entry.prototype.push = function (key)
{
    const keyPath = new KeyPath(key, this.keyPath);

    return new Entry(this.start, keyPath);
}

function KeyPath(key, next)
{
    this[Symbol.iterator] = function *()
    {
        yield key;
        next && (yield * next);
    }
}
