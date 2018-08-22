const { spawn } = require("child_process");
const { promisify } = require("util");
const pstree = promisify(require("ps-tree"));
const Process = require("./process");


module.exports = function fork(push, { path, args })
{
    const process = spawn(path, args, { stdio: [0, 1, 2] });
    const { pid } = process;
    const success = pid !== void 0;
    const cancel = success && (() => kill(0, pid));

    process.on("error", error => push(Process.ChildError({ error })));

    // If we don't have a pid, we haven't actually started,
    // we'll get an error about it.
    if (success)
    {
        process.on("exit", exitCode => push(Process.ChildExited({ exitCode })));
        process.on("message", data => Process.MessageOut({ data }));

        push(Process.ChildStarted({ pid, send: data => process.send(data) }));
    }

    return cancel;
}

module.exports.kill = kill;

function kill(push, pid)
{console.log("KILLING " + pid);
    return pstree(pid)
        .then(children => children.map(({ PID }) => PID))
        .then(children => ["-s", "SIGINT", pid, ...children])
        .then(args => spawn("kill", args, { stdio:[0,1,2] }))
        .then(() => console.log("TOTALLY KILLED!"))
        .catch(console.log);
}
