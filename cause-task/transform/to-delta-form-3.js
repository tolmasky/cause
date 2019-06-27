const { boolean } = require("@algebraic/type");
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

const derived = Symbol("Derived");

const Derived = data `Derived` (
    wrt     => boolean );
Object.prototype[derived] = Derived({ wrt: false });

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

    const toComputedProperty = expression => !expression.computed ?
        t.stringLiteral(expression.property.name) : expression.property;
    const tδ = ((call, apply) =>
        (callee, ds, args) => 
            t.isMemberExpression(callee) ?
                apply(callee.object, toComputedProperty(callee), ds, args) :
                call(callee, ds, args))
        (template((value, ds, args) => δ.call(value, ds, args)),
         template((object, property, ds, args) =>
            δ.apply(object, property, ds, args)))

    const t_ds = (...args) => args
        .flatMap((value, index) => value ? [index] : []);
    const tMaybeδ = (value, ds) => ds.length > 0 ? tδ(value, ds) : value;

    const tδ_depend = template((lifted, ...args) => δ.depend(lifted, args));

    const t_thunk = template(expression => () => expression);
    const t_defer = expression =>
        t.isCallExpression(expression) &&
        expression.arguments.length === 0 ?
            expression.callee :
            t_thunk(expression);

    const tδ_success = template(expression => δ.success(expression));
    const tδ_operator = template(name => δ.operators[name]);
    const tδ_ternary = tδ_operator("?:");


    const isδ = node => t.isIdentifier(node) && node.name === "δ";

    const pWrap = template2(`δ(%%argument%%)`);

    const isWRT = node => t.isIdentifier(node) && node.name === "wrt";

    return babelMapAccum(Type, babelMapAccum.fromDefinitions(
    {
        Expression(mapAccum, expression)
        {
            console.log("EXPRESSION!" + require("@babel/generator").default(expression).code);
            return mapAccum.fallback(mapAccum, expression);
        },

        CallExpression(mapAccum, expression)
        {
            const [_, callee] = mapAccum(expression.callee);
            const [__, args] = mapAccum(expression.arguments);
            const ds = args.flatMap((argument, index) =>
                argument[derived].wrt ? [index] : []);

            if (ds.length > 0)
                return [Type.Value, tδ(callee, ds, args)];

            return [Type.Value, t.CallExpression(callee, args)];
        },
        
        MemberExpression(mapAccum, expression)
        {
            if (t.isIdentifier(expression.object, { name: "wrt" }) &&
                expression.computed)
            {
                const { property } = expression;

                property[derived] = Derived({ wrt: true });
    
                return [Type.fToState, property];
            }

            return mapAccum.fallback(mapAccum, expression);
        }
    }))(fAST);
    
    /*
        BinaryExpression,
        CallExpression,

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
                tδ_success(tMaybeδ(tδ_ternary, t_ds(false, d1, d2))),
                test,
                tδ_success(t_defer(consequent)),
                tδ_success(t_defer(alternate)))];
        },
/*
        AwaitExpression(mapAccum, expression)
        {
            const [, right] = mapAccum(expression.argument);
        //console.log(expression.right);
            return [Type.State, right];
        },

        ArrayExpression(mapAccum, expression)
        {
            const callee = t.argumentPlaceholder();
            const [returnT, asCallExpression] = CallExpression(mapAccum,
                { callee, arguments: expression.elements });

            if (returnT === Type.Value)
                return [Type.Value, expression];

            const [lifted, _, ...elements] = asCallExpression.arguments;
            const operator = tδ_operator("=([])");
            const pArguments = [lifted, operator, ...elements];

            return [returnT, { ...asCallExpression, arguments: pArguments }];
        },

        LogicalExpression(mapAccum, expression)
        {
            const [leftT, left] = mapAccum(expression.left);
            const [rightT, right] = mapAccum(expression.right);
            const d0 = leftT === Type.State;
            const d1 = rightT === Type.State;

            if (!d0 && !d1)
                return [Type.Value, expression];

            const fOperator = tδ_operator(expression.operator);
            const δoperator = tδ(fOperator, t_ds(d0, d1));
            const args = [t_defer(left), t_defer(right)];

            return [Type.State, t.CallExpression(δoperator, args)];
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
        }
    }))(toLambdaForm.fromAST(fAST)[1]);*/

    function tryDeltaMemberShorthand(expression)
    {
        // All three options are call expressions.
        if (!t.isCallExpression(expression))
            return [false];

        const [isCalleeDeltaMemberAccess, calleeAccess] =
            tryDeltaMemberAccess(expression.callee);

        if (isCalleeDeltaMemberAccess)
            return [true, tδ_apply(
                calleeAccess[0],
                t.stringLiteral(calleeAccess[1].name),
                calleeAccess[2],
                expression.arguments)];

        const [isDeltaMemberAccess, access] = tryDeltaMemberAccess(expression);

        return isDeltaMemberAccess ?
            [true, tδ(t.MemberExpression(access[0], access[1]), access[2])] : [false];
    }

    // We allow the following shorthand conversions:
    // 1. [expression].δ(f, ...ds) -> δ([expression].f, ...ds)
    // 2. [expression].δ(f, ...ds)(...args) -> δ.apply([expression], f, ...ds)(...args)
    // -3-. [expression].δδ(f, ...ds)(...args) -> δ.apply([expression], f, ds, ...args)
    function tryDeltaMemberAccess(expression)
    {
        // All three options are call expressions.
        if (!t.isCallExpression(expression))
            return [false];

        const { callee, arguments: args } = expression;

        // All three options are call expressions.
        if (!t.isMemberExpression(callee) || !isδ(callee.property))
            return [false];

        return [true, [callee.object, args[0], args.slice(1)]];
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
        const { operator } = expression;

        if (operator === "|" && isδ(expression.left))
        {
            const [, right] = mapAccum(expression.right);

            return [Type.State, right];
        }

        const callee = t.argumentPlaceholder();
        const args = [expression.left, expression.right];
        const [returnT, asCallExpression] =
            CallExpression(mapAccum, { callee, arguments: args });

        if (returnT === Type.Value)
            return [Type.Value, expression];

        const [lifted, _, left, right] = asCallExpression.arguments;
        const fOperator = tδ_success(tδ_operator(operator));
        const pArguments = [lifted, fOperator, left, right];

        return [returnT, { ...asCallExpression, arguments: pArguments }];
    }

    function CallExpression(mapAccum, expression)
    {
        const [isDeltaMemberShorthand, modified] =
            tryDeltaMemberShorthand(expression);

        if (isDeltaMemberShorthand)
            return mapAccum(modified);

        const [calleeT, callee] = mapAccum(expression.callee);
        const wrappedCallee = calleeT !== Type.State ?
            tδ_success(callee) : callee;
        const argumentPairs = expression.arguments.map(mapAccum);
        const argumentsT = argumentPairs.reduce(
            (T, [argumentT]) => Type.concat(T, argumentT),
            Type.identity);

        const dependenciesT = Type.concat(calleeT, argumentsT);

        if (is (Type.State, dependenciesT))
        {console.log("--> " + calleeT);
            const lifted = false;//calleeT !== Type.Value;//Type.fToState;
            const wrappedArguments = argumentPairs.map(
                ([argumentT, argument]) => is(Type.State, argumentT) ?
                    argument : tδ_success(argument));

            return [Type.State,
                tδ_depend(lifted, wrappedCallee, ...wrappedArguments)];
        }

        const args = argumentPairs.map(([, argument]) => argument);
        const updated = { ...expression, callee, arguments: args };
        const wrapped = calleeT === Type.fToState ?
            pWrap({ argument: updated }) : updated;
//if (calleeT === Type.fToState) { console.log(require("@babel/generator").default(updated).code); process.exit(1) }
        return [Type.returns(calleeT), updated];
    }
}
