const Cause = require("@cause/cause");
const { spawn, fork } = require("child_process");
const { promisify } = require("util");
const pstree = promisify(require("ps-tree"));
const Process = require("./process");
const legacy = require("@cause/cause/record");
const { getTypeWithUUID, deserialize } = require("@algebraic/type");



module.exports = function fork_(push, { path, args })
{
    const process = path === "node" ?
        fork(args[0], args.slice(1)) :
        spawn(path, args, { stdio: [0, 1, 2] });
    const { pid } = process;
    const success = pid !== void 0;
    const cancel = success && (() => kill(0, pid));

    process.on("error", error => push(Process.ChildError({ error })));

    // If we don't have a pid, we haven't actually started,
    // we'll get an error about it.
    if (success)
    {
        process.on("exit", exitCode => push(Process.ChildExited({ exitCode })));
        process.on("message", message =>
            push(Process.ChildMessage({ event: inferredDeserialize(message) })));

        const send = event => process.send(
            { isLegacy: true, serialized: legacy.serialize(event) });
        push(Process.ChildStarted({ pid, send }));
    }

    return cancel;
}

function inferredDeserialize({ isLegacy, UUID, serialized })
{
    if (isLegacy)
        return legacy.deserialize(serialized).set("fromKeyPath", undefined);

    return deserialize(getTypeWithUUID(UUID), serialized);
}

module.exports.inferredDeserialize = inferredDeserialize;

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
