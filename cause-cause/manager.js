const { data, parameterized, number, ftype, is, getKind } = require("@algebraic/type");
const { List, Map } = require("@algebraic/collections");
const Cause = require("@cause/cause");

const KeyPath = require("./key-path");
const update = require("./update");
const getType = record => Object.getPrototypeOf(record).constructor;
const NoDescendentIOs = [List(Entry)(), Map(number, Function)()];

const Route = data `Route` (
    UUID    => number,
    event   => Object );

const Manager = parameterized (function (T)
{
    const Manager = data `Cause.Manager<${T}>` (
        root                => T,
        nextUUID            => [number, 0],
        registeredCauses    => [Map(number, Cause), Map(number, Cause)()],
        deferredPush        => [ftype, () => { }] );

    Manager.update = update
//        .on(Cause.Finished, "root",
//            (mananger, event) => [Manager({ root: null }), [event]])

        .on(Object, "root",
            (manager, event) => [manager, [event]])

        .on(Cause.Start, manager =>
            updateRegisteredIOs([manager, []]))//update.in(manager, "root", Cause.Start)))

        .on(Route, (manager, { UUID, event }) =>
        {
            const keyPath = getDescendentIOs(manager)[1].get(UUID);

            // This handles the case where the receiver was removed from the tree.
            if (!keyPath)
                return manager;

    //        LOG_EVENT(event, keyPath);

            return updateRegisteredIOs(update.in(manager, keyPath, Cause.Emit({ event })));
        });


    return Manager;
} );

module.exports = Manager;

/*const { List, Map, Record, Range, Set } = require("immutable");
const { Cause, field, event } = require("../cause");
const update = require("../update");
const IO = require("../io");
const KeyPath = require("../key-path");
const NoDescendentIOs = [List(), Map()];
*/

/*
//Error.stackTraceLimit = 1000;
const Manager = Cause("Cause.IO.Manager",
{
    [field `root`]: -1,
    [field `nextUUID`]: 0,
    [field `registeredIOs`]: Map(),
    [field `deferredPush`]: () => { },

    [event.on (Cause.Finished) .from `root`]: (manager, event) =>
        [manager.set("root", null), [event]],

    [event.from `root`]: (manager, event) => [manager, [event]],

    [event.on (Cause.Start)]: manager =>
        updateRegisteredIOs(update.in(manager, "root", Cause.Start())),

    [event.in `Route`]: { UUID:-1, event:-1 },
    [event.on `Route`](manager, { UUID, event })
    {
        const keyPath = getDescendentIOs(manager)[1].get(UUID);

        // This handles the case where the receiver was removed from the tree.
        if (!keyPath)
            return manager;

//        LOG_EVENT(event, keyPath);

        return updateRegisteredIOs(update.in(manager, keyPath, IO.Emit({ event })));
    }
});

module.exports = Manager;

const Route = Manager.Route;
*/
function updateRegisteredIOs([manager, events])
{
    const { registeredCauses, deferredPush } = manager;
    const [unregisteredIOs, presentIOs] = getDescendentIOs(manager.root);
    const purgedIOs = registeredCauses.filter((cancel, UUID) =>
        presentIOs.has(UUID) || void(cancel && cancel()));
    const [updatedRoot, updatedIOs, nextUUID] =
        unregisteredIOs.reduce(function ([root, IOs, UUID], entry)
        {
            const { start, keyPath } = entry;
            const push = event =>
                deferredPush(Route({ UUID, event }));
            const event = Cause.Register({ UUID });
            const [updatedRoot] = update.in(root, keyPath, event);
            const updatedIOs = IOs.set(UUID, start(push));

            return [updatedRoot, updatedIOs, UUID + 1];
        }, [manager.root, purgedIOs, manager.nextUUID]);
    const updated = getType(manager)
    ({
        ...manager,
        root: updatedRoot,
        nextUUID,
        registeredCauses: updatedIOs
    });

    return updated.root !== manager.root ?
        updateRegisteredIOs([updated, events]) :
        [updated, events];
}

function getDescendentIOs(node)
{
    return canContainIOs(node) ?
        node._descendentIOs ||
        (node._descendentIOs = getComputedDescendentIOs(node)) :
        NoDescendentIOs;
}

function getComputedDescendentIOs(node)
{
    const type = getType(node);

    return parameterized.is(Cause, type) ?
        node.needsRegistration ?
            [List(Entry)([new Entry(node.start)]), Map(number, Function)()] :
            [List(Entry)(), Map(number, Function)([[node.UUID, undefined]])] :
        !(getKind(type) === data)/*
        parameterized.is(List, type) ||
        parameterized.is(Map, type)*/ ?
            node.keySeq()
                .reduce(accumulate(
                    key => key,
                    (key, collection) => collection.get(key)),
                    NoDescendentIOs) :
            data.fields(type)
                .reduce(accumulate(
                    ([key]) => key,
                    (key, object) => object[key]),
                    NoDescendentIOs);

    function accumulate(toKey, getter)
    {
       return function accumulate(accumulated, item)
       {
            const key = toKey(item);
            const descendents = getDescendentIOs(getter(key, node));
            const unregistered = accumulated[0]
                .concat(descendents[0].map(entry => entry.push(key)));
            const registered = accumulated[1]
                .concat(descendents[1].map(keyPath => KeyPath(key, keyPath)));

            return [unregistered, registered];
       }
    }
}

function canContainIOs(node)
{
    if (!node || typeof node !== "object")
        return false;

    const type = getType(node);
    const kind = getKind(type);

    return  kind === data ||
            // Hack until we use real types to determine this.
            ((node["@@__IMMUTABLE_KEYED__@@"] ||
            node["@@__IMMUTABLE_INDEXED__@@"]));
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
    return new Entry(this.start, KeyPath(key, this.keyPath));
}

const LOG_EVENT = (function ()
{
    const { CAUSE_EVENTS } = process.env;

    if (!CAUSE_EVENTS)
        return () => { };

    const types = CAUSE_EVENTS === "true" ?
        true : Set(CAUSE_EVENTS.split(","));
    const passes = types === true ?
        () => true : event => types.contains(name(event));
    const name = event => Object.getPrototypeOf(event).constructor.name;

    return (event, keyPath) =>
        passes(event) && console.log(`ROUTING ${name(event)} to ${keyPath}`);
})();

/*



function getUnregisteredIOs(node)
{
    return canContainIOs(node) ?
        node._unregisteredIOs ||
        (node._unregisteredIOs = getComputedUnregisteredIOs(node)) :
        List()
}

function getComputedUnregisteredIOs(node)
{
    return node instanceof IO ?
        node.needsRegistration ?
            List.of(new Entry(node.start)) : List() :
        node.keySeq()
            .flatMap(key => getUnregisteredIOs(node.get(key))
                .map(entry => entry.push(key)));
}


function getComputedPresentIOs(node)
{
    if (node instanceof IO)
        return !node.awaitingRegistration ?
            (entry => UUID === "unregistered" ?
                [List.of(entry)] : [[], Map({ [UUID]: entry })])
                (node.UUID, new Entry(node.start)) :
            NoPresentIOs;

    return node.keySeq()
        .map(key => [getPresentIOs(node.get(key)), key])
        .map(([[unregistered, registered], key]) =>
        [
            unregistered.map(entry => entry.push(key)),
            registered.map(entry => entry.push(key)),
        ])
        .reduce((accum, [unregistered, registered]) =>
        [
            accum[0].concat(unregistered),
            accum[1].merge(registered)
        ], NoPresentIOs);
}*/
