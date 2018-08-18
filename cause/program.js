
module.exports = function program(state, update, pull)
{
    return function push(event)
    {
        state = update(state, event);

        if (pull)
            pull(state);

        return state;
    };
};
