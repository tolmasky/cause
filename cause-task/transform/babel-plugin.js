const { fromAST } = require("./to-delta-form");
const insertDeclaration = Symbol("insertDeclaration");


module.exports = function plugin({ types: t })
{
    const { parseExpression } = require("@babel/parser");
    const scope =
        (({ left: id, right: init }) => ({ id, init }))
        (parseExpression(`δ = require("@cause/task/δ")`));

    const Program = path => void(path.hub.file[insertDeclaration] = () =>
        (path.scope.push(scope), delete path.hub.file[insertDeclaration]));

    return  {
                name: "@cause/task/transform",
                visitor: { Program, Function }
            };
}

function Function(path, { file })
{
    const visited =
        path.node.visited ||
        path.findParent(({ node }) => node.visited);

    if (visited)
        return;

    let hasDelta = false;

    path.traverse(
    {
        Function: path => path.skip(),
        Identifier({ node }) { hasDelta = hasDelta || node.name === "δ" }
    });

    if (!hasDelta)
        return;

    if (file[insertDeclaration])
        file[insertDeclaration]();

    const replacement = fromAST([], path.node)[1];

    path.replaceWith({ ...replacement, visited: true });
};
