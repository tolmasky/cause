const { data, number, string } = require("@algebraic/type");
const Task = require("./task");
const { spawn: spawnAsync } = require("child_process");
const { Readable } = require("stream");
const { hasOwnProperty } = Object;


const Result = data `Task.Spawn.Result` (
    stdout      => string,
    exitCode    => number );

const ExitedWithError = data `Task.Spawn.ExitedWithError` (
    exitCode    => number,
    stderr      => string );

module.exports.stdout = parallel function (...args)
{
    return (branch spawn(...args)).stdout;
}

module.exports.lastline = output => output.match(/([^\n]*)\n$/)[1];

const spawn = Task.taskReturning(function spawn(command, args = [], options = { })
{
    return Task.fromAsyncCall(null, function ()
    {
        return new Promise(function (resolve, reject)
        {
            const stdio = options.stdio || [];
            const hasReadableStdInStream = stdio[0] instanceof Readable;
            const modifiedOptions = hasReadableStdInStream ?
                { ...options, stdio: ["pipe", ...stdio.slice(1)] } :
                options;
            const rejectOnError = hasOwnProperty.call(options, "rejectOnError") ?
                !!options.rejectOnError : true;

            const process = spawnAsync(command, args, modifiedOptions);

            if (hasReadableStdInStream)
                stdio[0].pipe(process.stdin);

            const output = { stdout: "", stderr: "" };

            const { pid } = process;
            const success = pid !== void 0;
            const cancel = success && (() => kill(0, pid));

            process.on("error", error => reject(error));
            process.on("exit", exitCode =>
                exitCode !== 0 && rejectOnError ?
                    reject(ExitedWithError({ ...output, exitCode })) :
                    resolve(Result({ ...output, exitCode })));

            process.stdout.on("data", data => output.stdout += data);
            process.stderr.on("data", data => output.stderr += data);
        });
    });
});

module.exports = spawn;
