//const { field, state, event, StateMachine } = require("./cause/state-machine");
const { field, state, event, Cause } = require("cause");



const AsynchronousCause = Cause("AsynchronousCause",
{
    [field `UUID`]: "unregistered",
    [field `start`]: -1,
    [field `awaitingRegistration`]: false,

    [event.on (Cause.Start)]: cause =>
        cause.set("awaitingRegistration", true),

    [event.in `Register`]: { UUID: -1 },
    [event.out `Started`]: { },

    [event.on `Register`]: (cause, { UUID }) =>
    [
        cause.set("UUID", `unique-${UUID}`),
//            .set("state", "running")
        AsynchronousCause.Started()
    ]
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

module.exports = AsynchronousCause;
