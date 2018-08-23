const { Record, Iterable, List, Range, Set } = require("immutable");
const { Cause, event, field } = require("cause");
const Allotment = Record({ request:-1, index:-1 }, "Allotment");


const Pool = Cause ("Pool",
{
    [field `backlog`]: List(),
    [field `free`]: List(),
    [field `occupied`]: Set(),

    init: ({ count }) =>
        ({ free: Range(0, count).toList() }),

    // Users `enqueue` requests for resources, and we fire an event when
    // said resources are `allotted`.
    [event.in `Enqueue`]: { requests: List() },
    [event.out `Allotted`]: { allotments: List() },

    // Simply note the requests, then see what can be satisfied.
    [event.on `Enqueue`]: (pool, { requests }) =>
        allot(pool.set("backlog", pool.backlog.concat(requests))),

    // Users `release` resources, and in turn we fire events for the 
    // releases as well as the newly allowed allotments.
    [event.in `Release`]: { indexes: Set() },
    [event.out `Released`]: { indexes: Set() },

    // Free up the resources, then see if we can allot any of them.
    [event.on `Release`](pool, { indexes })
    {
        const { free, backlog, occupied } = pool;
        const released = pool
            .set("free", free.concat(indexes))
            .set("occupied", occupied.subtract(indexes));
        const [allotted, events] = allot(released);
//console.log("RELEASED!", allotted);
        return [allotted, [Pool.Released({ indexes }), ...events]];
    }
});

module.exports = Pool;

function allot(pool)
{
    const { backlog, free, occupied } = pool;

    if (backlog.size <= 0 || free.size <= 0)
        return [pool, []];

    const dequeued = backlog.take(free.size);
    const indexes = free.take(dequeued.size);
    const updated = pool
        .set("backlog", backlog.skip(dequeued.size))
        .set("free", free.skip(dequeued.size))
        .set("occupied", occupied.concat(indexes));

    const allotments = dequeued.zipWith((request, index) =>
        Allotment({ request, index }),
        indexes);

    return [updated, [Pool.Allotted({ allotments })]];
}
