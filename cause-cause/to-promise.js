const Cause = require("./cause");
const update = require("./update");
const Manager = require("./manager");
const getType = object => Object.getPrototypeOf(object).constructor;

module.exports = function toPromise(root)
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
console.log("MANAGER IS NOW: " + mutableManager);
            if (finished)
                (settle => settle(finished.value))
                    (finished.rejected ? reject : resolve);
        });
        const type = getType(root);
        let mutableManager = Manager(type)({ root, deferredPush });

        mutableManager.deferredPush(Cause.Start);
    });

    return Object.assign(promise, { channel });
}
