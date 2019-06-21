const t = require("@babel/types");
const { parseExpression } = require("@babel/parser");
const toTemplate = require("@babel/template").expression;
const generate = 
    (generate => node => generate(node).code)
    (require("@babel/generator").default);
const valueToExpression = require("./value-to-expression");

const ArrayMonoid =
    { empty: [], union: (lhs, rhs) => lhs.concat(rhs), from: x => x };


module.exports = function template(f)
{
    const fExpression = parseExpression(f + "");
    const { params, body } = fExpression;
    const names = variableNamesFromPattern(ArrayMonoid, params);
    const hasRest = t.isRestElement(params[params.length - 1]);
    const templateString = names.reduce((string, name, index) =>
        string.replace(RegExp(name, "g"), `%%arg${index}%%`),
        generate(body));
    const indexedTemplate = toTemplate(templateString);

    return (...args) =>
        indexedTemplate(Object.fromEntries(
        [
            ...(hasRest ? args.slice(0, params.length - 1) : args)
                .map((value, index) =>
                    [`arg${index}`, valueToExpression(value)]),
            ...(!hasRest ?
                [] :
                [[`arg${params.length - 1}`,
                    args.slice(params.length - 1).map(valueToExpression)]])
        ]));
}

function variableNamesFromPattern(M, pattern)
{
    if (Array.isArray(pattern))
        return pattern.reduce((names, pattern) =>
            M.union(names, variableNamesFromPattern(M, pattern)), M.empty);

    const { empty, union, from } = M;
    const type = pattern.type;

    return  type === "Identifier" ?
                from([pattern.name]) :
            type === "ArrayPattern" ?
                pattern.elements
                    .filter(element => !!element)
                    .map(element => variableNamesFromPattern(M, element))
                    .reduce(union, empty) :
            type === "AssignmentPattern" ?
                variableNamesFromPattern(M, pattern.left) :
            type === "RestElement" ?
                variableNamesFromPattern(M, pattern.argument) :
            from(pattern.properties.map(property => property.value));
}
