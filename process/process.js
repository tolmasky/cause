const { Cause, field, state, event, IO } = require("cause");


const Process = Cause("Process",
{
    [field `pid`]: -1,
    [field `killOnStart`]: false,

    [field `send`]: null,
    [field `child`]: null,
    [field `kill`]: null,

    [field `state`]: "initial",
    [field `fromMessageOutDataToEvents`]: () => { },
    
    [field `path`]: -1,
    [field `args`]: -1,

    [event.out `Started`]: { pid: -1 },

    [event.in `Kill`]: { },
    [event.out `Finished`]: { exitCode: -1 },

    [event.in `Message`]: { data: null },

    [event.in `ChildStarted`]: { pid: -1 },
    [event.in `ChildMessage`]: { data: -1 },
    [event.in `ChildExited`]: { pid: -1 },

    [state `initial`]:
    {
        [event.on (Cause.Start)]: process => process
            .set("child", IO.start(push => fork(push, process)))
            .set("state", "starting")
    },

    [state `starting`]:
    {
        [event.on `Kill`]: process => process
            .set("killOnStart", true),

        [event.on `ChildStarted`]: function (process, { send, pid })
        {console.log(process.killOnStart);
            const updated = process
                .set("state", "running")
                .set("send", send)
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
            .set("kill", IO.start(push => fork.kill(push, process.pid))) },

        [event.on `Message`]: (process, { data }) =>
            (process.child.send(data), process),
    },

    [state `killing`]:
    {
        [event.on `ChildMessage`]: onChildMessage,
        [event.on `ChildExited`]: onChildExited,

        [event.on `Kill`]: event.ignore
    },

    [state `finished`]: { }
});

function onChildMessage(state, { data })
{
    return [process, fromMessageOutDataToEvents(data) || []];
}

function onChildExited(state, { exitCode })
{
    return [state.set("state", "finished"), Process.Finished({ exitCode })];
}

module.exports = Process;

const fork = require("./fork");
