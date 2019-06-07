const { data, number, string } = require("@algebraic/type");
const { fromAsyncCall } = require("./task");
const { spawn: spawnAsync } = require("child_process");
const { Readable } = require("stream");
const toPooled = require("./transform/to-pooled");


const Result = data `Task.Spawn.Result` (
    stdout      => string,
    exitCode    => number );

const ExitedWithError = data `Task.Spawn.ExitedWithError` (
    exitCode    => number,
    stderr      => string );

module.exports = spawn;

module.exports.stdout = toPooled("spawn", function (...args)
{
    return spawn(...args).stdout;
}, { spawn });

function spawn(command, args = [], options = { })
{
    return fromAsyncCall(function ()
    {
        return new Promise(function (resolve, reject)
        {
            const stdio = options.stdio || [];
            const hasReadableStdInStream = stdio[0] instanceof Readable;
            const modifiedOptions = hasReadableStdInStream ?
                { ...options, stdio: ["pipe", ...stdio.slice(1)] } :
                options;

            const process = spawnAsync(command, args, modifiedOptions);

            if (hasReadableStdInStream)
                stdio[0].pipe(process.stdin);

            const output = { stdout: "", stderr: "" };

            const { pid } = process;console.log(pid);
            const success = pid !== void 0;
            const cancel = success && (() => kill(0, pid));

            process.on("error", error => reject(error));
            process.on("exit", exitCode =>
                exitCode !== 0 ?
                    reject(ExitedWithError({ ...output, exitCode })) :
                    resolve(Result({ ...output, exitCode })));

            process.stdout.on("data", data => output.stdout += data);
            process.stderr.on("data", data => output.stderr += data);
        });
    });
}
