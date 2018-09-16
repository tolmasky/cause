const { Cause, field, state, event, IO } = require("cause");


const Process = Cause("Process",
{
    [field `pid`]: -1,
    [field `killOnStart`]: false,

    [field `send`]: null,
    [field `child`]: null,
    [field `kill`]: null,

    [field `state`]: "initial",

    [field `path`]: -1,
    [field `args`]: [],

    [event.out `Started`]: { pid: -1 },

    [event.in `Kill`]: { },
    [event.out `Finished`]: { exitCode: -1 },

    [event.in `Message`]: { event: null },

    [event.in `ChildStarted`]: { pid:-1, send:-1 },
    [event.in `ChildMessage`]: { event: -1 },
    [event.in `ChildExited`]: { pid: -1 },

    [state `initial`]:
    {
        [event.on (Cause.Start)]: process => process
            .set("child", IO.start(push => spawn(push, process)))
            .set("state", "starting")
    },

    [state `starting`]:
    {
        [event.on `Kill`]: process => process
            .set("killOnStart", true),

        [event.on `ChildStarted`]: function (process, { send, pid })
        {
            const updated = process
                .set("state", "running")

                // FIXME: This should be IO!
                .set("send", (...args) => send(...args))
                .set("pid", pid);
            const started = Process.Started({ pid });

            return updated.killOnStart ?
                [update(updated, Process.Kill), [started]] :
                [updated, [started]];
        }
    },

    [state `running`]:
    {
        [event.on `ChildMessage`]: onChildMessage,
        [event.on `ChildExited`]: onChildExited,

        [event.on `Kill`]: process => { console.log("here..."); return process
            .set("state", "killing")
            .set("kill", IO.start(push => spawn.kill(push, process.pid))) },

        [event.on `Message`]: (process, { event }) =>
            (process.send(event), process),
    },

    [state `killing`]:
    {
        [event.on `ChildMessage`]: onChildMessage,
        [event.on `ChildExited`]: onChildExited,

        [event.on `Kill`]: event.ignore
    },

    [state `finished`]: { }
});

function onChildMessage(state, { event })
{console.log("ON CHILD MESSAGE", event);
    return [state, [event]];
}

function onChildExited(state, { exitCode })
{console.log("ON CHILD EXITED", exitCode);
    return [state.set("state", "finished"), Process.Finished({ exitCode })];
}

Process.isRunning = process =>
    process.state === "running";

Process.node = ({ path, args = [] }) =>
    Process.create({ path: "node", args: [path, ...args] });

module.exports = Process;

const spawn = require("./spawn");
