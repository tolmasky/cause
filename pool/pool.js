const { Record, Iterable, List, Map, Range, Set } = require("immutable");
const { Cause, event, field, update } = require("cause");


const Pool = Cause ("Pool",
{
    [field `backlog`]: List(),
    [field `free`]: List(),
    [field `occupied`]: Map(),
    [field `items`]: List(),
    [field `notReady`]: Map({ id: 0 }),

    init: ({ items, count }) =>
        expanded(Pool(), { items, count }),

    // Whenever resources either get retained or released, an Alloted event
    // will be returned.
    [event.out `Retained`]: { index:-1, request:-1 },

    // Users `enqueue` requests for resources, and we fire an event when
    // said resources are `allotted`.
    [event.in `Enqueue`]: { requests: List() },
    // Simply note the requests, then see what can be satisfied.
    [event.on `Enqueue`]: (inPool, { requests }) =>
        allot(inPool.set("backlog", inPool.backlog.concat(requests))),

    // Users `release` resources, and in turn we fire events for the 
    // releases as well as the newly allowed allotments.
    [event.in `Release`]: { indexes: Set() },
    // Free up the resources, then see if we can allot any of them.
    [event.on `Release`]: (inPool, { indexes }) =>
        allot(inPool
            .set("free", inPool.free.concat(indexes))
            .set("occupied", indexes.reduce(
                (occupied, index) => occupied.remove(index),
                inPool.occupied))),

    [event.in `Expand`]: { items: void 0, count: -1 },
    [event.on `Expand`]: (inPool, event) =>
        allot(expanded(inPool, event)),

    // FIXME: We should do from ["notReady", ANY]
    [event.on (Cause.Ready)]: (inPool, { fromKeyPath: [, key] }) =>
        update(inPool.removeIn(["notReady", key]),
            Pool.Expand({ items:[inPool.notReady.get(key)] })),

    [event.on `*` .from (["items", "**"])]: event.passthrough,
});

module.exports = Pool;

function expanded(inPool, { items: iterable, count })
{
    const size = inPool.free.size;
    const sequence = iterable ?
        List(iterable) : Range(size, size + count);
    const divided = sequence
        .groupBy(item => Cause.Ready.is(item));

    const items = inPool.items
        .concat(divided.get(true, List()));
    const free = inPool.free.concat(iterable ?
        Range(size, size + items.size).toList() :
        items);

    const id = inPool.notReady.get("id");
    const notReadyPairs = divided.get(false, List())
        .map((item, index) => [id + index, item])
    const notReady = inPool.notReady
        .concat(Map(notReadyPairs)
            .set("id", notReadyPairs.size));

    return inPool.merge({ items, free, notReady });
}

function allot(inPool)
{
    const { backlog, free, occupied } = inPool;

    if (backlog.size <= 0 || free.size <= 0)
        return inPool;

    const dequeued = backlog.take(free.size);
    const indexes = free.take(dequeued.size);
    const retainedPairs = indexes.zip(dequeued);
    const outPool = inPool
        .set("backlog", backlog.skip(dequeued.size))
        .set("free", free.skip(dequeued.size))
        .set("occupied", occupied.concat(Map(retainedPairs)));
    const retains = retainedPairs.map(
        ([index, request]) => Pool.Retained({ request, index }));

    return [outPool, retains];
}
