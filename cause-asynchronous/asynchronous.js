const { data, union, parameterized, is, primitives } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Cause = require("@cause/cause");
const update = require("@cause/cause/update");
const getType = object => Object.getPrototypeOf(object).constructor;

const Any = union `Any` (
    Object,
    ...Object.values(primitives).filter(x => x !== primitives.primitive && x !== primitives) );


const Asynchronous = parameterized(T =>
{
    const CauseT = Cause(T);
    const Asynchronous = union `Asynchronous<${T}>` (
        data `Waiting` (
            cause => Cause(T) ),
        data `Running` (
            cause => Cause(T) ),
        data `Success` ( value => T ),
        data `Failure` ( error => Any ) );

    Asynchronous.Completed = union `Asynchronous<${T}>.Completed` (
        Asynchronous.Success,
        Asynchronous.Failure );

    Asynchronous.Waiting.update = update
        .on(CauseT.Started, (waiting, event, fromKeyPath) =>
        [
            Asynchronous.Running({ ...waiting }),
            [Asynchronous.Running({ ...waiting })]
        ]);

    Asynchronous.Running.update = update
        .on(CauseT.Completed.Succeeded, (waiting, event, fromKeyPath) =>
        [
            Asynchronous.Success({ ...event }),
            [Asynchronous.Success({ ...event })]
        ])
        .on(CauseT.Completed.Failed, (waiting, event, fromKeyPath) =>
        [
            Asynchronous.Failure({ ...event }),
            [Asynchronous.Failure({ ...event })]
        ]);

    return Asynchronous;
});

Asynchronous.from = function (T, fAsync)
{
T = Any;
    const CauseT = Cause(T);
    const start = function start (push)
    {
        fAsync()
            .then(value => push(CauseT.Completed.Succeeded({ value })))
            .catch(error => push(CauseT.Completed.Failed({ error })));

        push(CauseT.Started);
    };
    const cause = CauseT({ start });

    return Asynchronous(T).Waiting({ cause });
}

module.exports = Asynchronous;
console.log(Asynchronous(Any).Success);
const Dependent = union `Dependent` (
    data `Waiting` (
        action       => Function,
        dependencies => List(Dependency) ),
    data `DependenciesRunning` (
        action       => Function,
        dependencies => List(Dependency) ),
    data `Running` (
        action  => Asynchronous(Any) ),
    Asynchronous(Any).Success,
    Asynchronous(Any).Failure );

const Dependency = union `Dependency` (
    Asynchronous,
    Dependent );

Asynchronous.p = function p(actionOrOperator)
{
    return (...dependencies) => Dependent.from(
    {
        action: toAction(actionOrOperator),
        dependencies: List(Dependent)(dependencies)
    });
}

Asynchronous.p.success = function success(value)
{
    return Asynchronous(Any).Success({ value });
}

Asynchronous.p.state = Asynchronous.p;


Dependent.Waiting.update = update
    .on(Cause.Start, (waiting, event) =>
    {
        console.log("STARTED");
        return [waiting, []];
    })
    .on(Asynchronous(Any).Running, (waiting, event, fromKeyPath) =>
        [Dependent.from(waiting), []])
    .on(Dependent.DependenciesRunning, (waiting, event, fromKeyPath) =>
        [Dependent.from(waiting), []])
    .on(Asynchronous(Any).Success, (dependenciesRunning, event) =>
        Dependent.from(dependenciesRunning, true))
    .on(Asynchronous(Any).Failure, (dependenciesRunning, event) =>
        Dependent.from(dependenciesRunning, true))

Dependent.DependenciesRunning.update = update
    .on(Cause.Start, (waiting, event) =>
    {
        console.log("STARTED");
        return [waiting, []];
    })
    .on(Asynchronous(Any).Running, (dependenciesRunning, event) =>
        Dependent.from(dependenciesRunning, true))
    .on(Asynchronous(Any).Success, (dependenciesRunning, event) =>
        Dependent.from(dependenciesRunning, true))
    .on(Asynchronous(Any).Failure, (dependenciesRunning, event) =>
        Dependent.from(dependenciesRunning, true))


Dependent.from = function ({ dependencies, action }, FIXME_events = false)
{
    const result = toResult();

    return FIXME_events ? [result, [result]] : result;

    function toResult()
    {
        const { Success, Failure } = Asynchronous(Any);

        if (dependencies.some(is(Failure)))
            return Failure;

        if (dependencies.every(is(Success)))
        {
            const value = action(...dependencies.map(success => success.value));

            return Asynchronous(Any).Success({ value });
        }

        if (dependencies.every(item =>
            !is(Asynchronous(Any).Waiting, item) && !is(Dependent.Waiting, item)))
            return Dependent.DependenciesRunning({ dependencies, action });

        return Dependent.Waiting({ dependencies, action });
    }
}

const toAction = (function ()
{
    const operators =
    {
        "+": (lhs, rhs) => lhs + rhs,
        "-": (lhs, rhs) => lhs - rhs,
        "*": (lhs, rhs) => lhs * rhs,
        "/": (lhs, rhs) => lhs / rhs,
        "%": (lhs, rhs) => lhs / rhs,
        "**": (lhs, rhs) => lhs ** rhs,
        "u(-)": value => -value,
        "u(+)": value => +value,

        "&": (lhs, rhs) => lhs & rhs,
        "|": (lhs, rhs) => lhs | rhs,
        "^": (lhs, rhs) => lhs ^ rhs,
        "<<": (lhs, rhs) => lhs << rhs,
        ">>": (lhs, rhs) => lhs >> rhs,
        ">>>": (lhs, rhs) => lhs >> rhs,
        "u(~)": value => ~value,

        "==": (lhs, rhs) => lhs == rhs,
        "===": (lhs, rhs) => lhs === rhs,
        "!=": (lhs, rhs) => lhs != rhs,
        "!==": (lhs, rhs) => lhs !== rhs,
        ">": (lhs, rhs) => lhs > rhs,
        ">=": (lhs, rhs) => lhs >= rhs,
        "<": (lhs, rhs) => lhs < rhs,
        "<=": (lhs, rhs) => lhs <= rhs,

        "&&": (lhs, rhs) => lhs == rhs,
        "||": (lhs, rhs) => lhs === rhs,
        "u(!)": value => !value,

        "u(typeof)": value => typeof value,
        "in": (lhs, rhs) => lhs in rhs,
        "instancoef": (lhs, rhs) => lhs instanceof rhs,
    };

    return actionOrOperator =>
        typeof actionOrOperator === "function" ?
            actionOrOperator :
            operators[actionOrOperator];
})();
