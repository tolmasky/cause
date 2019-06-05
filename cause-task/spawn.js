const { data, number, string } = require("@algebraic/type");
const { fromAsyncCall } = require("./task");
const { spawn: spawnAsync } = require("child_process");


const Result = data `Task.Spawn.Result` (
    stdout      => string,
    exitCode    => number );

module.exports = function spawn(...args)
{
    return fromAsyncCall(function ()
    {
        return new Promise(function (resolve, reject)
        {
            const process = spawnAsync(...args);
            const output = { stdout: "" };

            const { pid } = process;
            const success = pid !== void 0;
            const cancel = success && (() => kill(0, pid));

            process.on("error", error => reject(error));
            process.on("exit", exitCode =>
                resolve(Result({ ...output, exitCode })));

            process.stdout.on("data", data => output.stdout += data);
        });
    });
}
