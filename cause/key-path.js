const LNode = require("./lnode");


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

    return keyPath.reduceRight((next, data) => new LNode(data, next), null);
}

KeyPath.equal = function keyPathsEqual(lhs, rhs)
{
    return  lhs === rhs ||
            !!lhs === !!rhs &&
            !!lhs && lhs.data === rhs.data &&
            equals(lhs.next, rhs.next);
}