//const { field, state, event, StateMachine } = require("./cause/state-machine");
const { field, state, event, Cause: StateMachine } = require("cause");



module.exports = StateMachine("External",
{
    [field `UUID`]: "string",
    [field `data`]: { },
    [field `start`]: -1,
    [field `send`]: -1,
/*
    [state `initial`]:
    {
        [event.in `Start`]: { },

        [event.on `Start`]: external =>
            external.set("state", "awaiting-registration"),
    },

    [state `awaiting-registration`]:
    {
        [event.in `Register`]: { UUID: -1 },
        [event.out `Started`]: { },

        [event.on `Registered`]: (external, { data }) =>
        [
            external
                .set("state", "running")
                .set("UUID", `unique-${data.UUID}`),
            External.Started()
        ]
    }*/
});
