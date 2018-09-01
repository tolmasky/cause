function LNode(data, next)
{
    this.data = data;
    this.next = next;
}

LNode.prototype[Symbol.iterator] = function * ()
{
    let node = this;

    do
        yield node.data;
    while (node = node.next)
}

LNode.prototype.toString = function ()
{
    return `@[ ${Array.from(this, JSON.stringify).join(",") }]`;
}

module.exports = LNode;
