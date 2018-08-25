const { List, Map, Record, Range, Set } = require("immutable");
const { Cause, field, event } = require("../cause");
const update = require("../update");
const IO = require("../io");
const LNode = require("../lnode");
const NoDescendentIOs = [List(), Set()];

Error.stackTraceLimit = 1000;
const Manager = Cause("Cause.IO.Manager",
{
    [field `root`]: -1,
    [field `nextUUID`]: 0,
    [field `registeredIOs`]: Map(),
    [field `deferredPush`]: () => { },

    [event.from `root`]: event.ignore,

    [event.on (Cause.Start)]: manager =>
        updateRegisteredIOs(update.in(manager, "root", Cause.Start())),

    [event.in `Route`]: { keyPath:-1, event:-1 },
    [event.on `Route`]: (manager, { keyPath, event }) =>
        updateRegisteredIOs(update.in(manager, keyPath, IO.Emit({ event })))
});

module.exports = Manager;

const Route = Manager.Route;

function updateRegisteredIOs([manager])
{
    const { registeredIOs, deferredPush } = manager;
    const [unregisteredIOs, presentIOs] = getDescendentIOs(manager);
    const purgedIOs = registeredIOs.filter((cancel, UUID) =>
        !presentIOs.has(UUID) || void(cancel && cancel()));
    const [updatedRoot, updatedIOs, nextUUID] =
        unregisteredIOs.reduce(function ([root, IOs, UUID], entry)
        {
            const { start, keyPath } = entry;
            const push = event =>
                deferredPush(Manager.Route({ keyPath, event }));
            const event = IO.Register({ UUID });
            const [updatedRoot] = update.in(root, keyPath.next, event);
            const updatedIOs = IOs.set(UUID, start(push));

            return [updatedRoot, updatedIOs, UUID + 1];
        }, [manager.root, purgedIOs, manager.nextUUID]);

    return manager
        .set("root", updatedRoot)
        .set("nextUUID", nextUUID)
        .set("registeredIOs", updatedIOs);
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
    return node instanceof IO ?
        node.needsRegistration ?
            [List.of(new Entry(node.start)), Set()] : NoDescendentIOs :
        node.keySeq().reduce(function (accumulated, key)
        {
            const descendents = getDescendentIOs(node.get(key));
            const unregistered = accumulated[0]
                .concat(descendents[0].map(entry => entry.push(key)));
            const registered = accumulated[1].concat(descendents[1]);

            return [unregistered, registered];
        }, NoDescendentIOs);
}

function canContainIOs(node)
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
    return new Entry(this.start, new LNode(key, this.keyPath));
}

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
