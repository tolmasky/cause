const LNode = require("./lnode");
const isAny = keyPath => keyPath && keyPath.data === "*";
const isRestAny = keyPath => keyPath && keyPath.data === "**";


function KeyPath(key, next)
{
    return new LNode(key, next);
}

module.exports = KeyPath;

KeyPath.from = function keyPathFrom(keyPath)
{
    if (keyPath instanceof LNode)
        return keyPath;

    if (typeof keyPath === "string")
        return new LNode(keyPath);

    return keyPath.reduceRight((next, data) => new LNode(data, next), undefined);
}

KeyPath.concat = function (lhs, rhs)
{
    return Array.from(lhs).reduceRight((next, data) => new LNode(data, next), rhs);
}

KeyPath.equal = function keyPathsEqual(lhs, rhs)
{
    if (lhs === rhs)
        return true;

    if (!lhs && !rhs)
        return true;

    if (isRestAny(lhs) || isRestAny(rhs))
        return true;

    if (!isAny(lhs) && !isAny(rhs) &&
        (!lhs !== !rhs || lhs.data !== rhs.data))
        return false;

    return keyPathsEqual(lhs.next, rhs.next);
}