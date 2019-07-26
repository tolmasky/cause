const {  promises: fs, existsSync } = require("fs");
const { fromAsync, fromAsyncCall } = require("./task");
const andReturnPath = (f, index = 0) =>
    (...args) =>
        fromAsyncCall(null, (...args) =>
            f(...args).then(() => args[index]), args);

const mkdir = andReturnPath(fs.mkdir);

module.exports.exists = fromAsync(async path => existsSync(path) && path);

module.exports.mkdir = mkdir
module.exports.mkdirp = (path, options) =>
    mkdir(path, { ...options, recursive: true });

module.exports.copy = andReturnPath(fs.copyFile, 1);
module.exports.write = andReturnPath(fs.writeFile);
module.exports.read = fromAsync(fs.readFile);

module.exports.join = (({ join, normalize }) =>
    (...paths) => normalize(join(...paths)))
    (require("path"));
