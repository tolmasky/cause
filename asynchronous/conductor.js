const { Collection, List, Map, Record, Range, Set } = require("immutable");
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
//console.log("oh");
//console.log("+++", getAsynchronousCauses(updated));
console.log(getAsynchronousCauses(updated.root.active));
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

            const rootKeyPath = keyPath.parent;
            const source = root.getIn(rootKeyPath);
            const [updatedRoot, additionalEvents] =
                update.in(root, rootKeyPath, event, source);
console.log("THiS FR");
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

function getAsynchronousCauses(node)
{
    if (!canContainAsynchronousCauses(node)) { console.log("NO FOR " + (node && node.__proto__.constructor.name));
        return Map();
}
    if (!node._asynchronousCauses)
        node._asynchronousCauses =
            getComputedAsynchronousCauses(node);

    return node._asynchronousCauses;
}
    
function getComputedAsynchronousCauses(record)
{
    console.log("OK", record.__proto__.constructor.name);
//if (record) console.log("COMPUTING " + record.__proto__.constructor.name, record, isKeyed(record));
    if (record instanceof AsynchronousCause)
    {console.log("HERE", record);
        if (!record.awaitingRegistration)
            return Map();

        const { UUID="UUID", start } = record;
        const entry = new Entry(start);
        const value = UUID === "unregistered" ? List.of(entry) : entry;

        return Map({ [UUID]: value });
    }

    const causes = record.keySeq()
        .map(key => [getAsynchronousCauses(record.get(key)), key])
        .map(([entries, key]) =>
            entries.keySeq()
                .map(UUID => [UUID, entries.get(UUID)])
                .map(([UUID, entry]) => UUID === "unregistered" ?
                    [UUID, entry.map(entry => entry.push(key))] :
                    [UUID, entry.push(key)]))
        .map(pairs => Map(pairs))
        .reduce((union, entries) => union
            .merge(entries)
            .set("unregistered", union
                .get("unregistered", List())
                .concat(entries.get("unregistered", List()))),
            Map());
console.log(causes);
    //console.log(union);
    //console.log(groups);
    if (record.__proto__.constructor.name === "Map")
    {
        console.log(record);
        console.log(record.__proto__.constructor.name, causes);
    }

    return causes;
}

function canContainAsynchronousCauses(node)
{
    if (!node || typeof node !== "object")
        return false;

    return  node instanceof Record ||
            node["@@__IMMUTABLE_KEYED__@@"] ||
            node["@@__IMMUTABLE_INDEXED__@@"];
}

function Entry(start, keyPath)
{
    this.start = start;
    this.keyPath = keyPath;
}

Entry.prototype.toString = function ()
{
    return `Entry { ${this.keyPath} }`;
}

Entry.prototype.push = function (key)
{
    const keyPath = new KeyPath(key, this.keyPath);

    return new Entry(this.start, keyPath);
}

function KeyPath(key, next)
{
    this.parent = next;
    this[Symbol.iterator] = function *()
    {
        yield key;
        next && (yield * next);
    }
}

KeyPath.prototype.toString = function ()
{
    return Array.from(this).join(", ");
}
