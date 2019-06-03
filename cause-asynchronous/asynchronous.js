const { data, union, parameterized, is } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Cause = require("@cause/cause");
const update = require("@cause/cause/update");
const getType = object => Object.getPrototypeOf(object).constructor;


const Asynchronous = parameterized(T =>
{
    const CauseT = Cause(T);
    const Asynchronous = union `Asynchronous<${T}>` (
        data `Waiting` (
            cause => Cause(T) ),
        data `Running` (
            cause => Cause(T) ),
        data `Success` ( value => T ),
        data `Failure` ( error => Object ) );

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
console.log(Asynchronous(Object).Success);
const Dependent = union `Dependent` (
    data `Blocked` (
        action       => Function,
        dependencies => List(Dependency) ),
    data `DependenciesRunning` (
        action       => Function,
        dependencies => List(Dependency) ),
    data `Running` ( ),
    Asynchronous(Object).Success,
    Asynchronous(Object).Failure );

const Dependency = union `Dependency` (
    Asynchronous,
    Dependent );

Asynchronous.p = function p(actionOrOperator)
{
    return (...dependencies) => Dependent.Blocked(
    {
        action: toAction(actionOrOperator),
        dependencies: List(Dependent)(dependencies)
    });
}

Asynchronous.p.state = Asynchronous.p;


Dependent.Blocked.update = update
    .on(Cause.Start, (blocked, event) =>
    {
        console.log("STARTED");
        return [blocked, []];
    })
    .on(Asynchronous(Object).Running, (blocked, event, fromKeyPath) =>
        [Dependent.DependenciesRunning({ ...blocked }), []]);
console.log(Asynchronous(Object).Success);
Dependent.DependenciesRunning.update = update
    .on(Asynchronous(Object).Running, (dependenciesRunning, event) =>
        [dependenciesRunning, []])
    .on(Asynchronous(Object).Success, (dependenciesRunning, event, fromKeyPath) =>
    {console.log("HERE...");
        return dependenciesRunning.dependencies
            .every(item => is (Asynchronous(Object).Success, item)) ?
                [Asynchronous(Object).Success({ value: "DONE" }), []] :
                [dependenciesRunning, []];
    });

/*.state = function (actionOrOperator)
{
    const action = toAction(actionOrOperator);

    return function (...dependencies)
    {
        return Dependent.Blocked({ action, dependencies });
    }
}*/

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
