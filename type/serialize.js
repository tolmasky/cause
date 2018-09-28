const Queue = (function ()
{
    const transfer = (head, tail) => tail ?
        transfer(new QNode(tail.item, head), tail.next) :
        [head, tail];
    const enqueue = (item, [head, tail]) =>
        [head, new QNode(item, tail)];
    const dequeue = ([head, tail]) => head ?
        [[head.next, tail], head.item] :
        dequeue(transfer(head, tail));
    const create = () => [null, null];
    const empty = ([head, tail]) => !(head || tail);

    return { enqueue, dequeue, create, empty };

    function QNode(item, next)
    {
        this.item = item;
        this.next = next;
    }
})();
const State = Record({ queue: Queue.create(), UIDs:Map() }, "State");
const Person = T `Person` ({ age: T.number(8), name: T.string });
const Something = T `Something` ({ person: Person });

function serialize (type, value)
{
    const storage = [];
    var [state] = reference(State(), type, value);

    while (!Queue.empty(state.queue))
    {
        const [dequeued, [UID, [type, value]]] =
            Queue.dequeue(state.queue);
        const { serialize } = T.description(type);

        [state, storage[UID]] = serialize(
            state.set("queue", dequeued), reference, type, value);
    }

    return storage;
}

const something = Something({ person: Person({ age: 10, name: "Francisco" }) });

serialize(Something, something)