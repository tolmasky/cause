const { spawn } = require("child_process");

const { data, union, string, number } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Cause = require("@cause/cause");

const Invocation = data `Process.Invocation` (
    command     => string,
    arguments   => List(string),
    cwd         => string );

const SpawnCause = Cause(number);

const Process = union `Process` (
    data `Waiting` (
        invocation  => Invocation,
        spawnCause  => SpawnCause ),
    data `Started` (
        invocation  => Invocation,
        spawnCause  => SpawnCause ),
    data `Running` (
        invocation  => Invocation,
        spawnCause  => SpawnCause ),
    data `Exited` (
        invocation  => Invocation ) );

Process.start = function (command, arguments, cwd)
{
    const argumentList = List(string)(arguments);
    const invocation = Invocation({ command, arguments: argumentList, cwd });

    return Process.Waiting(
    {
        invocation,
        spawnCause: Cause(number)({ start: toSpawnCause(invocation) })
    });
}

function toSpawnCause(invocation)
{
    return function (push)
    {
        const process = spawn(
            invocation.command,
            invocation.arguments.toArray(),
            { cwd: invocation.cwd, stdio: [0, 1, 2] });

        const { pid } = process;console.log(pid);
        const success = pid !== void 0;
        const cancel = success && (() => kill(0, pid));

        process.on("error", error =>
            push(Cause(number).Completed.Failed({ error })));

        // If we don't have a pid, we haven't actually started,
        // we'll get an error about it.
        if (success)
        {
            process.on("exit", exitCode =>
                push(Cause(number).Completed.Succeeded({ value: exitCode })));
            //process.on("message", message =>
            //    push(Process.ChildMessage({ event: inferredDeserialize(message) })));

//            const send = event => process.send(inferredSerialize(event));
//            push(Process.ChildStarted({ pid, send }));
        }
    }
}

module.exports = Process;
