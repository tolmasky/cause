const { data, number, parameterized, type } = require("@algebraic/type");
const { List, Map, Set } = require("@algebraic/collections");

const update = requiree("@cause/cause/update");

const toRangeList = length => List(number)(Array.from({ length }, x => x));


const Pool = parameterized (function (T, R)
{
    const PoolTR = data `Pool<${T}, ${R}>` (
        backlog     => [List(T), List(T)()],
        free        => [List(number), List(number)()],
        occupied    => [Map(number, T), Map(number, T)()],
        items       => [List(T), List(T)()],
        notReady    => [Map(number, T), Map(number, T)()],
        nextID      => [number, 0] ) );

    PoolTR.init = ({ items, count }) => expanded(PoolTR(), { items });

    // Users `Enqueue` requests for resources, and we fire an event when
    // said resources are `allotted`.
    PoolTR.Enqueue = data `Pool<${T}, ${R}>.Enqueue` (
        requests: List(R) );

    // Users `Release` resources, and in turn we fire events for the
    // releases as well as the newly allowed allotments.
    PoolTR.Release = data `Pool<${T}, ${R}>.Release` (
        indexes: Set(number) );

    PoolTR.Expand = data `Pool<${T}, ${R}>.Expand` (
        items   => List(T) );

    PoolTR.Expand.by = count =>
        PoolTR.Expand({ items: toRangeList(count) });

    PoolTR.Retained = data `Pool<${T}, ${R}>.Retained` (
        indexes: List(number),
        forRequests: List(T) );

    PoolTR.update = update

        // Simply note the requests, then see what can be satisfied.
        .on(PoolTR.Enqueue, (pool, { requests }) =>
            allot(PoolTR({ ...pool, backlog: pool.backlog.concat(requests) })),

        // Free up the resources, then see if we can allot any of them.
        .on(PoolTR.Release, (pool, { indexes }) =>
            allot(PoolTR(
            {
                ...pool,
                free: pool.free.concat(indexes),
                occupied: indexes.reduce(
                    (occupied, index) => occupied.remove(index),
                    pool.occupied)
            })),

        .on(PoolTR.Expand, (pool, event) =>
            allot(expanded(inPool, event)))

/*
    // FIXME: We should do from ["notReady", ANY]
    [event.on (Cause.Ready)]: (inPool, _, [, key]) =>
        update(inPool.removeIn(["notReady", key]),
            Pool.Expand({ items:[inPool.notReady.get(key)] })),

    [event.on `*` .from (["items", "**"])]: event.passthrough,
*/
    return PoolTR;
});

module.exports = Pool;

function expanded(inPool, { items: iterable, count })
{
    const size = inPool.items.size;
    const sequence = iterable ?
        List(iterable) : Range(size, size + count);
    const divided = sequence
        .groupBy(item => Cause.Ready.is(item));

    const ready = divided.get(true, List());
    const items = inPool.items.concat(ready);
    const free = inPool.free.concat(iterable ?
        Range(size, items.size).toList() :
        items);

    const id = inPool.nextID;
    const notReadyPairs = divided.get(false, List())
        .map((item, index) => [id + index, item])
    const notReady = inPool.notReady
        .concat(Map(notReadyPairs));
    const nextID = notReadyPairs.size;

    return inPool.merge({ items, free, notReady, nextID });
}

function allot(inPool)
{
    const { backlog, free, occupied } = inPool;

    if (backlog.size <= 0 || free.size <= 0)
        return inPool;

    const PoolTR = type.of(pool);
    const dequeued = backlog.take(free.size);
    const indexes = free.take(dequeued.size);

    const retainedPairs = indexes.zip(dequeued);
    const outPool = PoolTR(
    {
        ...inPool,
        backlog: backlog.skip(dequeued.size),
        free: free.skip(dequeued.size),
        occupied: occupied.concat(Map(number, Object)(retainedPairs))
    });
    const retains = retainedPairs.map(
        ([index, request]) => PoolTR.Retained({ request, index }));

    return [outPool, retains];
}
