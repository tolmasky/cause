const { is, string } = require("@algebraic/type");
const { OrderedSet } = require("@algebraic/collections");

const Node = require("@algebraic/ast/node");
const parse = require("@algebraic/ast/parse");
const fromBabel = require("@algebraic/ast/from-babel");

const toTemplate = require("@babel/template").expression;
const generate = 
    (generate => node => generate(node).code)
    (require("@babel/generator").default);
const valueToExpression = require("@algebraic/ast/value-to-expression");


module.exports = function template(f)
{
    const fExpression = parse.expression(f + "");
    const { params, body } = fExpression;
    const names = params.reduce((names, param) =>
        names.union(param.bindingNames), OrderedSet(string)())
        .toArray();

    const hasRest = is (Node.RestElement, params[params.length - 1]);
    const templateString = names.reduce((string, name, index) =>
        string.replace(RegExp(name, "g"), `%%arg${index}%%`),
        generate(body));
    const indexedTemplate = toTemplate(templateString);

    return (...args) =>
        fromBabel(indexedTemplate(Object.fromEntries(
        [
            ...(hasRest ? args.slice(0, params.length - 1) : args)
                .map((value, index) =>
                    [`arg${index}`, valueToExpression(value)]),
            ...(!hasRest ?
                [] :
                [[`arg${params.length - 1}`,
                    args.slice(params.length - 1).map(valueToExpression)]])
        ])));
}
