const { Record, Iterable, List, Range, Set } = require("immutable");
const { Cause, event, field } = require("cause");
const Allotment = Record({ request:-1, key:-1 }, "Allotment");


const Pool = Cause ("Pool",
{
    [field `backlog`]: List(),
    [field `keys`]: List(),
    [field `free`]: List(),
    [field `occupied`]: Set(),

    init({ keys: iterable })
    {
        const keys = Iterable.Indexed(iterable);
        const free = Range(0, keys.size).toList();

        return { keys, free };
    },

    // Users `enqueue` requests for resources, and we fire an event when
    // said resources are `allotted`.
    [event.in `Enqueue`]: { requests: List() },
    [event.out `Allotted`]: { allotments: List() },

    // Simply note the requests, then see what can be satisfied.
    [event.on `Enqueue`]: (pool, { requests }) =>
        allot(pool.set("backlog", pool.backlog.concat(requests))),

    // Users `release` resources, and in turn we fire events for the 
    // releases as well as the newly allowed allotments.
    [event.in `Release`]: { keys: List() },
    [event.out `Released`]: { keys: List() },

    // Free up the resources, then see if we can allot any of them.
    [event.on `Release`](pool, { keys })
    {
        const { free, backlog, occupied } = pool;
        const released = pool
            .set("free", free.concat(keys))
            .set("occupied", occupied.subtract(keys));
        const [allotted, events] = allot(released);
//console.log("RELEASED!", allotted);
        return [allotted, [Pool.Released({ keys }), ...events]];
    }
});

module.exports = Pool;

function allot(pool)
{
    const { backlog, free, occupied, keys } = pool;

    if (backlog.size <= 0 || free.size <= 0)
        return [pool, []];

    const dequeued = backlog.take(free.size);
    const indexes = free.take(dequeued.size);
    const updated = pool
        .set("backlog", backlog.skip(dequeued.size))
        .set("free", free.skip(dequeued.size))
        .set("occupied", occupied.concat(indexes));

    const allotments = dequeued.zipWith((request, index) =>
        Allotment({ request, key: index }),
        indexes);

    return [updated, [Pool.Allotted({ allotments })]];
}
