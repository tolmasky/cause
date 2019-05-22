const { data, union, string, number } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Cause = require("@cause/cause");
const fromAsync = require("@cause/cause/from-async");

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

Process.start = (command, arguments, cwd) =>
    Process.Waiting(
    {
        invocation: Invocation(
        {
            command,
            arguments: List(string)(arguments),
            cwd
        }),
        spawnCause: fromAsync(number, async () => { console.log("DO IT"); return 0; })
    });

module.exports = Process;
