const Cause = require("./cause");
const update = require("./update");
const Manager = require("./manager");
const getType = object => Object.getPrototypeOf(object).constructor;

module.exports = function toPromise(T, root)
{
    const channel = { emit: () => { } };    
    const promise = new Promise(function (resolve, reject)
    {
        const deferredPush = event => setImmediate(function ()
        {
            const [updated, events] = update(mutableManager, event);
            const finished = events.reduce((finished, event) =>
                finished ||
                    void(channel.emit(event)) ||
                    event instanceof Cause.Finished && event,
                null);

            // THE ONLY MUTATION!
            mutableManager = updated;
console.log("MANAGER IS NOW: " + toString(0)(mutableManager.root));
            if (finished)
                (settle => settle(finished.value))
                    (finished.rejected ? reject : resolve);
        });
        const type = getType(root);
        let mutableManager = Manager(T)({ root, deferredPush });

        mutableManager.deferredPush(Cause.Start);
    });

    return Object.assign(promise, { channel });
}

function toString(indent)
{const { getUnscopedTypename } = require("@algebraic/type");
    return function (status)
    {
        const { image, dependencies } = status;
        const name = getUnscopedTypename(getType(status));
        const spaces = Array.from({ length: indent * 2 }, () => " ").join("");
        const children = dependencies.map(toString(indent + 1)).join("\n");
        var rest = children && `\n${children}`;

        if (status.buildProcess)
            rest+= `\n${spaces}  [${getUnscopedTypename(getType(status.buildProcess))}]`;

        return `${spaces}${name} (${image.tags.get(0)})${rest}`;
    }
}

