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
const wrap = require("@cause/task/wrap");
const has = (({ hasOwnProperty }) =>
    (key, object) => hasOwnProperty.call(object, key))
    (Object);

const δ = require("@cause/task/δ");


module.exports = function (...args)
{
    const [symbols, f, free] = args.length < 3 ? [[], ...args] : args;
    const { parseExpression } = require("@babel/parser");
    const fExpression = parseExpression(`(${f})`);
    const name = fExpression.id ? [fExpression.id.name] : [];

    const explicitSymbols = is(string, symbols) ? [symbols] : [...symbols];
    const implicitSymbols = fExpression.id ? [fExpression.id.name] : [];
    const symbolEntries =
        [...explicitSymbols, ...implicitSymbols].map(key => [key, true]);
    const symbolSet = Object.fromEntries(symbolEntries);

    const [type, transformed] = fromAST(symbolSet, fExpression);

    const parameters = Object.keys(free || { });
    // const missing = scope.free.subtract(parameters);

//    if (missing.size > 0)
//        throw Error("Missing values for " + missing.join(", "));

    const code = `return ${generate(transformed).code}`;
    const values = parameters.map(parameter => free[parameter]);

    return (new Function("p", ...parameters, "δ", code))(wrap, ...values, δ);
}

module.exports.fromAST = fromAST;

const Type = union `Type` (
    data `Value` (),
    data `State` (),
    data `Function` (
        input    => Type,
        output   => Type ) );

Type.NonFunction = union `Type.NonFunction` (
    Type.Value,
    Type.State );

Type.returns = function (T)
{
    return is (Type.Function, T) ? T.output : T;
}

Type.fValueToValue = Type.Function({ input: Type.Value, output: Type.Value });
Type.fToState = Type.Function({ input: Type.Value, output: Type.State });

Type.identity = Type.Value;
Type.concat = (lhs, rhs) =>
    lhs === Type.State ? Type.State :
    rhs === Type.State ? Type.State :
    Type.Value;/*
    lhs === Type.Value ? rhs :
    rhs === Type.Value ? lhs :
    Type.State;*/


function prefix(operator)
{
    return { type: "prefix", operator: t.stringLiteral(operator) };
}

function fromAST(symbols, fAST)
{
    const { parseExpression } = require("@babel/parser");
    const template = require("./template");
    const template2 = require("@babel/template").expression;

    const tδ = template((value, ...ds) => δ(value, ds));
    const t_ds = (...args) => args
        .flatMap((value, index) => value ? [index] : []);
    const tMaybeδ = (value, ds) => ds.length > 0 ? tδ(value, ...ds) : value;

    const tδ_depend = template((lifted, ...args) => δ.depend(lifted, args));

    const t_thunk = template(expression => () => expression);
    const t_defer = expression =>
        t.isCallExpression(expression) &&
        t.isIdentifier(expression.callee) &&
        expression.arguments.length === 0 ?
            expression.callee :
            t_thunk(expression);

    const tδ_success = template(expression => δ.success(expression));
    const tδ_operator = template(name => δ.operators[name]);
    const tδ_ternary = tδ_operator("?:");

    const pWrap = template2(`δ(%%argument%%)`);
    const pSuccess = template2(`δ.success(%%argument%%)`);
    const pDepend = template2(`δ.depend(%%lifted%%, %%callee%%, %%arguments%%)`);
    const pOperator = (template =>
        operator => template2({ operator: t.stringLiteral(operator) }))
        (template2(`δ.operators[%%operator%%]`));
    const pIf = template2(`δ.depend(false, δ.operators["if"], %%test%%, ` +
        `δ.success([%%liftConsequent%%, () => %%consequent%%]), ` +
        `δ.success([%%liftAlternate%%, () => %%alternate%%]))`);

    return babelMapAccum(Type, babelMapAccum.fromDefinitions(
    {
        BinaryExpression,
        CallExpression,
        LogicalExpression: BinaryExpression,

        FunctionExpression,
        ArrowFunctionExpression: FunctionExpression,

        ConditionalExpression(mapAccum, expression)
        {
            const [consequentT, consequent] = mapAccum(expression.consequent);
            const [alternateT, alternate] = mapAccum(expression.alternate);
            const mismatch = consequentT !== alternateT;

            // FIXME: *Is* this too hard to figure out?
            if (mismatch &&
                (is(Type.Function, consequentT) ||
                 is(Type.Function, alternateT)))
                throw Error(
                    `The following expression is too hard to figure out. ` +
                    `The consequent returns ${consequentT} but the ` +
                    `alternate returns ${alternateT}. I can currently ` +
                    `only handle non-function mismatches.`);

            // The result of this operation must match, so if either option is a
            // State, the other must be lifted.
            const nestedReturnT = Type.concat(consequentT, alternateT);

            // The "consequent" and "alternate" themselves should never be waited
            // on though, as they only get evaluated depending on the result of
            // test. As such, if test is not a State, we can still use an inline
            // conditional expression:
            const [testT, test] = mapAccum(expression.test);

            // The result of this operation must match, so if either option is a
            // State, the other must be lifted.
            if (testT !== Type.State)
                return [nestedReturnT, t.ConditionalExpression(test,
                    nestedReturnT === Type.State && consequentT !== Type.State ?
                        tδ_success(consequent) : consequent,
                    nestedReturnT === Type.State && alternateT !== Type.State ?
                        tδ_success(alternate) : alternate)];

            const d1 = consequentT === Type.State;
            const d2 = alternateT === Type.State;

            // This case is a bit trickier. We can't rely on depend's lifting
            // ability since depend expects to either always lift or not. But in
            // our case, we could be in a situation where only one side needs
            // lifting. As such, operators["if"] handles this for us, but we
            // have to specify for each.
            return [Type.State, tδ_depend(
                false,
                tMaybeδ(tδ_ternary, t_ds(false, d1, d2)),
                test,
                tδ_success(t_defer(consequent)),
                tδ_success(t_defer(alternate)))];
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
            const [isDeltaExpression, modified] =
                tryDeltaExpression(expression);

            if (isDeltaExpression)
                return [Type.fToState, mapAccum(modified)[1]];

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
        }
    }))(toLambdaForm.fromAST(fAST)[1]);

    // Delta Expressions are of the form:
    // δ[function-name] or [expression].δ[function-name]
    function tryDeltaExpression(expression)
    {
        // Both δ[function-name] and [expression].δ[function-name] are computed
        // MemberExpressions
        if (!t.isMemberExpression(expression) || !expression.computed)
            return [false];

        const { object, property } = expression;

        // Both δ[function-name] and [expression].δ[function-name] have a single
        // identifier as a property (the function name).
        if (!t.isIdentifier(property))
            return [false];

        // If the object is the δ-identifier, return the property as the new
        // representation of the entire expression:
        // δ[function-name] -> function-name
        if (t.isIdentifier(object) && object.name === "δ")
            return [true, property];

        // The only remaining case is [expression].δ[function-name], which means
        // the object must also be a member expression, but with the
        // δ-identifier as the property.
        if (!t.isMemberExpression(object) ||
            object.computed ||
            object.property.name !== "δ")
            return [false];

        // In this case, remove the intermediate δ-identifier.
        return [true, { ...object, property }];
    }

    function FunctionExpression(mapAccum, expression)
    {
        const [paramsT, params] = mapAccum(expression.params);
        const [bodyT, body] = mapAccum(expression.body);
        const type = bodyT === Type.State ? Type.fToState : Type.fValueToValue;

        return [type, { ...expression, params, body }];
    }

    function BinaryExpression(mapAccum, expression)
    {
        const callee = t.argumentPlaceholder();
        const arguments = [expression.left, expression.right];
        const [returnT, asCallExpression] =
            CallExpression(mapAccum, { callee, arguments });

        if (returnT === Type.Value)
            return [Type.Value, expression];

        const [lifted, _, left, right] = asCallExpression.arguments;
        const operator = pOperator(expression.operator);
        const pArguments = [lifted, operator, left, right];

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
/*
        if (is (Type.State, argumentsT))
        {
            const arguments = argumentPairs.map(
                ([argumentT, argument]) => is (Type.State, argumentT) ?
                    argument : pSuccess({ argument }));
            const delta = calleeT !== Type.fToState ?
                tδ(callee) : pSuccess(callee);
console.log("HERE!");
            return [Type.State, { ...expression, arguments, callee: delta }];
        }*/

        const dependenciesT = Type.concat(calleeT, argumentsT);

        if (is (Type.State, dependenciesT))
        {
            const arguments = argumentPairs.map(
                ([argumentT, argument]) => is (Type.State, argumentT) ?
                    argument : pSuccess({ argument }));
            const lifted = t.booleanLiteral(calleeT !== Type.fToState);
            const pCall = pDepend({ lifted, callee: wrappedCallee, arguments });

            return [Type.State, pCall];
        }

        const arguments = argumentPairs.map(([, argument]) => argument);
        const updated = { ...expression, callee, arguments };
        const wrapped = calleeT === Type.fToState ?
            pWrap({ argument: updated }) : updated;

        return [Type.returns(calleeT), wrapped];
    }
}
