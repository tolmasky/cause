const Cause = require("./cause");

module.exports = (T, fAsync) =>
    Cause(T)({ start: start(T, fAsync) });


function start(T, fAsync)
{
    const CauseT = Cause(T);

    return function (push)
    {
        fAsync()
            .then(value => push(CauseT.Completed.Succeeded({ value })))
            .catch(error => push(CauseT.Completed.Failed({ error })));

        push(CauseT.Started);
    }
}