const Cause = require("./cause");

module.exports = (T, fAsync) =>
    Cause(T)({ start: push =>
        void(fAsync()
            .then(value => push(Cause(T).Completed.Succeeded({ value })))
            .catch(error => push(Cause(T).Completed.Failed({ error })))) });
