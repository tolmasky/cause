const { floor, log2 } = Math;
const Base = 32;
const inSlot = number => 1 << (number % Base);
const toSlot = (number, f) => f(floor(number / Base));
const ordered = (lhs, rhs, f) =>
    lhs.length < rhs.length ? f(lhs, rhs) : f(rhs, lhs);

const push = (item, array) => (array.push(item), array);
const unfold = (f, v, into = []) =>
    (result => result === false ? into : push(result[0], unfold(f, result[1], into)))
    (f(v));
const split = (start, number, leftmost = floor(log2(number))) =>
    [start + leftmost, number - (1 << leftmost)];

const DenseIntSet =
{
    Empty: [],

    has: (number, set) => toSlot(number, slot =>
        slot < set.length && !!(set[slot] & inSlot(number))),

    just: number => toSlot(number, slot =>
        Array.from({ length: slot + 1 },
            (_, index) => index === slot ? inSlot(number) : 0)),

    union: (lhs, rhs) => ordered(lhs, rhs,
        (shorter, longer) => longer.map((value, index) =>
            index < shorter.length ?
            value | shorter[index] : value)),

    intersection: (lhs, rhs) => ordered(lhs, rhs, function (shorter, longer)
    {
        const uncompressed = shorter.map((value, index) => value & longer[index]);
        const shift = uncompressed.length - 1;
        const index = shift - uncompressed
            .findIndex((_, index) => uncompressed[shift - index] !== 0);

        return  index === uncompressed.length ? uncompressed :
                index < uncompressed.length ? uncompressed.slice(0, index + 1) : [];
    }),

    from: iterable => iterable.reduce((set, number) =>
        DenseIntSet.union(set, DenseIntSet.just(number)),
        DenseIntSet.Empty),

    toArray: set => set.reduce((flattened, value, index) =>
        unfold(number =>
            number !== 0 && split(index * Base, number),
            value,
            flattened),
        [])
};

module.exports = DenseIntSet;
