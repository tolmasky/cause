const LNode = require("./lnode");
const isAny = ({ data }) => data === "*";


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

KeyPath.equal = function keyPathsEqual(lhs, rhs)
{
    return  lhs === rhs ||
            !!lhs === !!rhs &&
            !!lhs && (lhs.data === rhs.data || isAny(lhs) || isAny(rhs)) &&
            keyPathsEqual(lhs.next, rhs.next);
}