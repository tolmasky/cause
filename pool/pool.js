const { Record, Iterable, List, Range, Set } = require("immutable");
const { Cause, event, field } = require("cause");


const Pool = Cause ("Pool",
{
    [field `backlog`]: List(),
    [field `free`]: List(),
    [field `occupied`]: Set(),

    init: ({ count }) => ({ free: Range(0, count).toList() }),

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
            .set("occupied", inPool.occupied.subtract(indexes)))
});

module.exports = Pool;

function allot(inPool)
{
    const { backlog, free, occupied } = inPool;

    if (backlog.size <= 0 || free.size <= 0)
        return inPool;

    const dequeued = backlog.take(free.size);
    const indexes = free.take(dequeued.size);
    const outPool = inPool
        .set("backlog", backlog.skip(dequeued.size))
        .set("free", free.skip(dequeued.size))
        .set("occupied", occupied.concat(indexes));
    const retains = dequeued.zipWith(
        (request, index) => Pool.Assigned({ request, index }),
        indexes);

    return [outPool, retains];
}
