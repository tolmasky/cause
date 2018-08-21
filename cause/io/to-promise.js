const Cause = require("../cause");
const update = require("../update");
const Manager = require("./manager");


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
                    event instanceof Manager.Finished && event,
                null);

            // THE ONLY MUTATION!
            mutableManager = updated;

            if (finished)
                (settle => settle(finished.value))
                    (finished.rejected ? reject : resolve);
        });
        let mutableManager = Manager.create({ root, deferredPush });

        mutableManager.deferredPush(Cause.Start());
    });

    return Object.assign(promise, { channel });
}
