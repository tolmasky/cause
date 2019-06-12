const {  promises: fs } = require("fs");
const { fromAsyncCall } = require("./task");
const andReturnPath = f =>
    (...args) =>
        fromAsyncCall((path, ...args) =>
            f(path, ...args).then(() => path), ...args);

const mkdir = andReturnPath(fs.mkdir);

module.exports.mkdir = mkdir
module.exports.mkdirp = (path, options) =>
    mkdir(path, { ...options, recursive: true });

module.exports.write = andReturnPath(fs.writeFile);

module.exports.join = (({ join, normalize }) =>
    (...paths) => normalize(join(...paths)))
    (require("path"));
