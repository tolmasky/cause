const Cause = require("cause");
const update = require("cause/update");
const Conductor = require("./conductor");


module.exports = function run(root)
{
    const channel = { emit: () => { } };    
    const promise = new Promise(function (resolve, reject)
    {
        let conductor = Conductor.create({ root, push });

        push(Cause.Start());

        function push(event)
        {console.log(event);
            const [updated, events] = update(conductor, event);
            const finished = events.reduce((finished, event) =>
                finished ||
                    void(channel.emit(event)) ||
                    event instanceof Conductor.Finished && event,
                null);

            // THE ONLY MUTATION!
            conductor = updated;

            if (finished)
                (settle => settle(finished.value))
                    (finished.rejected ? reject : resolve);
        }
    });

    return Object.assign(promise, { channel });
}
