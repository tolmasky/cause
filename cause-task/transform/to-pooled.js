const t = require("@babel/types");
const toLambdaForm = require("./to-lambda-form");
const Scope = require("./scope");
const transformScope = require("./transform-scope");
const babelMapAccum = require("@climb/babel-map-accum");
const mapAccumArray = require("@climb/map-accum");

const { data, number, union, string, is } = require("@algebraic/type");
const { List, Map } = require("@algebraic/collections");
const Optional = require("@algebraic/type/optional");
const { default: generate } = require("@babel/generator");
const Asynchronous = require("@cause/asynchronous");
const wrap = require("@cause/task/wrap");
const has = (({ hasOwnProperty }) =>
    (key, object) => hasOwnProperty.call(object, key))
    (Object);


module.exports = function (symbolOrSymbols, f, free)
{
    const { parseExpression } = require("@babel/parser");
    const symbols = typeof symbolOrSymbols === "string" ?
        { [symbolOrSymbols]: true } :
        Object.fromEntries([...symbolOrSymbols].map(key => [key, true]));
    const [type, transformed] = fromAST(symbols, parseExpression(`(${f})`));

    const parameters = Object.keys(free || { });
    // const missing = scope.free.subtract(parameters);

//    if (missing.size > 0)
//        throw Error("Missing values for " + missing.join(", "));

    const code = `return ${generate(transformed).code}`;console.log(code);
    const args = parameters.map(parameter => free[parameter]);

    return (new Function("p", ...parameters, code))(wrap, ...args);
}

const Type = union `Type` (
    data `Value` (),
    data `State` (),
    data `Function` (
        input    => Type,
        output   => Type ) );

Type.returns = function (T)
{
    return is (Type.Function, T) ? T.output : T;
}

Type.fValueToValue = Type.Function({ input: Type.Value, output: Type.Value });
Type.fToState = Type.Function({ input: Type.Value, output: Type.State });

Type.identity = Type.Value;
Type.concat = (lhs, rhs) =>
    lhs === Type.Value ? rhs :
    rhs === Type.Value ? lhs :
    Type.State;


function prefix(operator)
{
    return { type: "prefix", operator: t.stringLiteral(operator) };
}

function fromAST(symbols, fAST)
{
    const template = require("@babel/template").expression;
    const pCall = template(`p(%%callee%%, %%arguments%%)`);
    const pSuccess = template(`p.success(%%argument%%)`);
    const pLift = template(`p.lift(%%callee%%, %%arguments%%)`);
    const pOperator = (template =>
        operator => template({ operator: t.stringLiteral(operator) }))
        (template(`p[%%operator%%]`));

    return babelMapAccum(Type, babelMapAccum.fromDefinitions(
    {
        BinaryExpression,
        CallExpression,
        LogicalExpression: BinaryExpression,

        ArrowFunctionExpression(mapAccum, expression)
        {
            const [paramsT, params] = mapAccum(expression.params);
            const [bodyT, body] = mapAccum(expression.body);
            const type = bodyT === Type.State ? Type.fToState : Type.ValueToValue;

            return [type, { ...expression, params, body }];
        },

        ArrayExpression(mapAccum, expression)
        {
            const callee = t.argumentPlaceholder();
            const arguments = expression.elements;
            const [returnT, asCallExpression] =
                CallExpression(mapAccum, { callee, arguments });

            if (returnT === Type.Value)
                return [Type.Value, expression];

            const [_, elements] = asCallExpression.arguments;
            const operator = pOperator("=([])");
            const pArguments = [operator, elements];

            return [returnT, { ...asCallExpression, arguments: pArguments }];
        },

        MemberExpression(mapAccum, expression)
        {
            const { object, property, computed } = expression;
            const left = object;
            const right = computed ? property : t.stringLiteral(property.name);
            const operator = ".";
            const [returnT, asBinaryExpression] =
                BinaryExpression(mapAccum, { operator, left, right });

            if (returnT !== Type.Value)
                return [returnT, asBinaryExpression];

            const updated = t.memberExpression(
                asBinaryExpression.left,
                computed ? asBinaryExpression.right : property,
                computed);

            return [returnT, updated];
        },

        Identifier(mapAccum, identifier)
        {
            return has(identifier.name, symbols) ?
                [Type.fToState, identifier] :
                [Type.Value, identifier];
        }

    }))(toLambdaForm.fromAST(fAST)[1]);

    function BinaryExpression(mapAccum, expression)
    {
        const callee = t.argumentPlaceholder();
        const arguments = [expression.left, expression.right];
        const [returnT, asCallExpression] =
            CallExpression(mapAccum, { callee, arguments });

        if (returnT === Type.Value)
            return [Type.Value, expression];

        const [_, left, right] = asCallExpression.arguments;
        const operator = pOperator(expression.operator);
        const pArguments = [operator, left, right];

        return [returnT, { ...asCallExpression, arguments: pArguments }];
    }

    function CallExpression(mapAccum, expression)
    {
        const [calleeT, callee] = mapAccum(expression.callee);
        const wrappedCallee = calleeT !== Type.State ?
            pSuccess({ argument: callee }) : callee;
        const argumentPairs = expression.arguments.map(mapAccum);
        const argumentsT = argumentPairs.reduce(
            (T, [argumentT]) => Type.concat(T, argumentT),
            Type.identity);
        const dependenciesT = Type.concat(calleeT, argumentsT);

        if (is (Type.State, dependenciesT))
        {
            const arguments = argumentPairs.map(
                ([argumentT, argument]) => is (Type.State, argumentT) ?
                    argument : pSuccess({ argument }));

            return calleeT === Type.fToState ?
                [Type.State, pCall({ callee: wrappedCallee, arguments })] :
                [Type.State, pLift({ callee: wrappedCallee, arguments })];
        }

        const arguments = argumentPairs.map(([, argument]) => argument);
        const updated = { ...expression, callee, arguments };

        return [Type.returns(calleeT), updated];
    }
}

